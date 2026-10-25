// Web Push sending with only the standard Web Crypto API, so it runs the same
// in Supabase Edge Functions (Deno) and in Node (for tests).
//   - Message encryption: RFC 8291 (aes128gcm content encoding, RFC 8188)
//   - Sender identification: RFC 8292 (VAPID, ES256 JWT)
// Keys use the common web-push format: base64url raw P-256 keys
// (public 65 bytes uncompressed, private 32 bytes).

export type PushSubscription = { endpoint: string; p256dh: string; auth: string };
export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

/** Private P-256 key from raw d plus raw uncompressed public key. */
async function importPrivate(d: Uint8Array, pub: Uint8Array, usage: 'sign' | 'ecdh'): Promise<CryptoKey> {
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: b64urlEncode(d),
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
    ext: true
  };
  return usage === 'sign'
    ? crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
    : crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}

/**
 * Encrypts a payload for one subscription (RFC 8291). `local` and `salt` are
 * only passed in tests; normally a fresh key pair and salt are made per message.
 */
export async function encryptPayload(
  sub: { p256dh: string; auth: string },
  plaintext: Uint8Array,
  opts: { local?: { publicKey: Uint8Array; privateKey: Uint8Array }; salt?: Uint8Array } = {}
): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(sub.p256dh);
  const authSecret = b64urlDecode(sub.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('Bad p256dh key');

  let asPublic: Uint8Array;
  let asPrivate: CryptoKey;
  if (opts.local) {
    asPublic = opts.local.publicKey;
    asPrivate = await importPrivate(opts.local.privateKey, asPublic, 'ecdh');
  } else {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    asPrivate = pair.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  }
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivate, 256));

  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0 || ua_public || as_public, 32)
  const ikm = await hkdf(authSecret, ecdhSecret, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  // One record: plaintext followed by the 0x02 "last record" delimiter.
  const record = concat(plaintext, new Uint8Array([2]));
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, record));

  // Header: salt (16) | record size (uint32, 4096) | key id length (1) | key id (as_public)
  const header = new Uint8Array(16 + 4 + 1);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  return concat(header, asPublic, cipher);
}

/** VAPID Authorization header value for a push service (RFC 8292). */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, now = Date.now()): Promise<string> {
  const pub = b64urlDecode(vapid.publicKey);
  const key = await importPrivate(b64urlDecode(vapid.privateKey), pub, 'sign');
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: vapid.subject }))
  );
  const signing = `${header}.${claims}`;
  // Web Crypto ECDSA signatures are raw r||s, which is what JWS ES256 uses.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signing)));
  return `vapid t=${signing}.${b64urlEncode(sig)}, k=${vapid.publicKey}`;
}

export type SendResult = { ok: boolean; status: number; gone: boolean; body?: string };

/** Sends one encrypted message. `gone` means the subscription no longer exists. */
export async function sendPush(sub: PushSubscription, payload: unknown, vapid: VapidKeys, ttlSeconds = 12 * 3600): Promise<SendResult> {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(payload)));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttlSeconds),
      Urgency: 'normal'
    },
    body
  });
  const text = res.ok ? undefined : (await res.text()).slice(0, 300);
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410, body: text };
}
