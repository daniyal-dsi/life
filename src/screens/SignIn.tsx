import { useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { Button, Field, Header, Notice, inputClass } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function SignIn() {
  const { sendMagicLink, verifyCode } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function onSend(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await sendMagicLink(email);
      setSent(true);
    });
  }

  function onVerify(e: FormEvent) {
    e.preventDefault();
    void run(() => verifyCode(email, code));
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-app flex-col px-4 pb-10 pt-[max(24px,env(safe-area-inset-top))]">
      <Header label="Life Organiser" title="Sign in" />
      {!sent ? (
        <form onSubmit={onSend} className="flex flex-col gap-4">
          <p className="text-[15px] text-muted">
            We'll email you a sign-in link. You only need to do this once on each device.
          </p>
          <Field label="Email">
            {(id) => (
              <input
                id={id}
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            )}
          </Field>
          {error && <Notice tone="rose">{error}</Notice>}
          <Button type="submit" icon={Mail} disabled={busy || !email.trim()}>
            {busy ? 'Sending…' : 'Email me a link'}
          </Button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="flex flex-col gap-4">
          <Notice tone="green">
            Sent to <b>{email}</b>. Open the link on this device, or type the 6-digit code from the email.
          </Notice>
          <p className="text-[13px] text-muted">
            Using the app from your home screen? Links open in Safari, so use the code here instead.
          </p>
          <Field label="Code">
            {(id) => (
              <input
                id={id}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${inputClass} tnum tracking-[0.3em]`}
                placeholder="123456"
                maxLength={8}
              />
            )}
          </Field>
          {error && <Notice tone="rose">{error}</Notice>}
          <Button type="submit" disabled={busy || code.replace(/\D/g, '').length < 6}>
            {busy ? 'Checking…' : 'Sign in'}
          </Button>
          <Button variant="ghost" onClick={() => setSent(false)}>
            Use a different email
          </Button>
        </form>
      )}
    </div>
  );
}
