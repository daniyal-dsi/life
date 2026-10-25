// Cross-checks our Web Push code against the independent http_ece decoder
// (a dependency of the web-push library). Run with: npm test
import { createRequire } from 'node:module';
import { createECDH, randomBytes } from 'node:crypto';
import { encryptPayload, vapidAuthorization, b64urlDecode, b64urlEncode } from './webpush.ts';
const require = createRequire(import.meta.url);
const ece = require('http_ece');
const webpushLib = require('web-push');

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`); if (!ok) failures++; };

// A "browser" subscription: its own P-256 key pair and auth secret.
const ua = createECDH('prime256v1'); ua.generateKeys();
const auth = randomBytes(16);
const sub = { p256dh: b64urlEncode(ua.getPublicKey()), auth: b64urlEncode(auth) };

for (const text of ['hello', JSON.stringify({ title: 'Milestones due today', body: 'Draft copy, Launch page', url: '/work' }), 'x'.repeat(3000)]) {
  const body = await encryptPayload(sub, new TextEncoder().encode(text));
  const out = ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: ua, authSecret: auth });
  check(`decrypts with http_ece (${text.length} chars)`, out.toString() === text);
}

// Two encryptions of the same message must differ (fresh key + salt each time).
const a = await encryptPayload(sub, new TextEncoder().encode('same'));
const b = await encryptPayload(sub, new TextEncoder().encode('same'));
check('fresh salt and key per message', b64urlEncode(a) !== b64urlEncode(b));

// Wrong auth secret must fail to decrypt.
let rejected = false;
try { ece.decrypt(Buffer.from(a), { version: 'aes128gcm', privateKey: ua, authSecret: randomBytes(16) }); } catch { rejected = true; }
check('wrong auth secret is rejected', rejected);

// VAPID: keys in the standard web-push format, JWT verifies with the public key.
const keys = webpushLib.generateVAPIDKeys();
const vapid = { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: 'mailto:test@example.com' };
const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc123', vapid, Date.UTC(2026, 9, 25));
const m = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
check('VAPID header shape', !!m);
if (m) {
  const [, h, c, sig, k] = m;
  check('k is the public key', k === vapid.publicKey);
  const claims = JSON.parse(Buffer.from(b64urlDecode(c)).toString());
  check('aud is the push service origin', claims.aud === 'https://fcm.googleapis.com', claims.aud);
  check('exp is 12h ahead', claims.exp === Date.UTC(2026, 9, 25) / 1000 + 12 * 3600);
  const pub = await crypto.subtle.importKey('raw', b64urlDecode(vapid.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64urlDecode(sig), new TextEncoder().encode(`${h}.${c}`));
  check('ES256 signature verifies', ok);
}
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
