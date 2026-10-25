import { useState, type FormEvent } from 'react';
import { Home, KeyRound } from 'lucide-react';
import { Button, Card, Field, Header, Notice, Segmented, inputClass } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useHousehold } from '@/lib/household';

// Shown once after first sign-in: start a household, or join your partner's
// with the invite code shown in their More tab.

export default function HouseholdSetup({ loadError }: { loadError?: string | null }) {
  const { signOut, user } = useAuth();
  const { create, join } = useHousehold();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('Our household');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') await create(name);
      else await join(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-app flex-col gap-5 px-4 pb-10 pt-[max(24px,env(safe-area-inset-top))]">
      <Header label={user?.email ?? 'Welcome'} title="Your household" />
      <p className="-mt-2 text-[15px] text-muted">
        Your own logs stay private to you. Meal Prep, Masjid Mubarak times and the dua library are shared with the
        people in your household.
      </p>
      {loadError && <Notice tone="rose">{loadError}</Notice>}
      <Segmented
        label="Household"
        options={[
          { id: 'create', label: 'Start one' },
          { id: 'join', label: 'Join with a code' }
        ]}
        value={mode}
        onChange={setMode}
      />
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {mode === 'create' ? (
            <Field label="Household name" hint="You'll get an invite code to share.">
              {(id) => (
                <input id={id} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={80} />
              )}
            </Field>
          ) : (
            <Field label="Invite code" hint="Find it in More on the other person's phone.">
              {(id) => (
                <input
                  id={id}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className={`${inputClass} tnum uppercase tracking-[0.25em]`}
                  placeholder="ABC234"
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={12}
                />
              )}
            </Field>
          )}
          {error && <Notice tone="rose">{error}</Notice>}
          <Button
            type="submit"
            icon={mode === 'create' ? Home : KeyRound}
            disabled={busy || (mode === 'create' ? !name.trim() : code.trim().length < 6)}
          >
            {busy ? 'Working…' : mode === 'create' ? 'Create household' : 'Join household'}
          </Button>
        </form>
      </Card>
      <Button variant="ghost" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  );
}
