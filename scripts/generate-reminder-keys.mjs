// Makes the keys reminders need. Run it yourself in Terminal:
//   node scripts/generate-reminder-keys.mjs
// It prints them on your screen only. Nothing is saved or sent anywhere.
// Paste them where it says, then close the Terminal window.

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const publicKey = b64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d;
const cronSecret = b64url(crypto.getRandomValues(new Uint8Array(32)));

console.log(`
Reminder keys (keep the private key and cron secret to yourself)

1. Vercel > your project > Settings > Environment Variables
   (Production, Preview and Development), then redeploy:

   VITE_VAPID_PUBLIC_KEY = ${publicKey}

2. Supabase > Edge Functions > Secrets (Add new secret, one each):

   VAPID_PUBLIC_KEY  = ${publicKey}
   VAPID_PRIVATE_KEY = ${privateKey}
   VAPID_SUBJECT     = mailto:your-email@example.com   (use your own email)
   CRON_SECRET       = ${cronSecret}

3. Use the same CRON_SECRET in supabase/setup/schedule_reminders.sql
   when you run it in the SQL Editor (don't save the file with it in).
`);
