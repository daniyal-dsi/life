import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  Download,
  Inbox,
  KeyRound,
  LogOut,
  MessageSquareText,
  Upload
} from 'lucide-react';
import { extraAreas } from '@/areas';
import { BottomSheet, Button, Card, Field, Header, Notice, Page, SectionTitle, Segmented, inputClass } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { buildBackup, downloadBackup, importBackup } from '@/lib/backup';
import { formatStamp } from '@/lib/date';
import { useHousehold } from '@/lib/household';
import { listInbox, type InboxItem } from '@/lib/inbox';
import { useSettings, type Theme } from '@/lib/settings';
import RemindersCard from './RemindersCard';

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function NameField() {
  const { settings, update } = useSettings();
  const [name, setName] = useState(settings.name);
  const [saved, setSaved] = useState(false);
  useEffect(() => setName(settings.name), [settings.name]);

  async function save() {
    const next = name.trim();
    if (next === settings.name) return;
    await update({ name: next });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Field label="Your name" hint={saved ? 'Saved' : undefined}>
      {(id) => (
        <input
          id={id}
          value={name}
          autoComplete="name"
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={inputClass}
        />
      )}
    </Field>
  );
}

function HouseholdCard() {
  const { household, members, join } = useHousehold();
  const { demo, user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!household) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(household!.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the code is visible anyway */
    }
  }

  async function onJoin() {
    setBusy(true);
    setError(null);
    try {
      await join(code);
      setSheet(false);
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join that household.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <p className="text-[13px] text-muted">Household</p>
      <p className="text-[17px] font-extrabold">{household.name}</p>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-btn bg-chip px-4 py-3">
        <div>
          <p className="text-[12px] font-semibold text-muted">Invite code</p>
          <p className="disp tnum text-[24px] tracking-[0.2em]">{household.invite_code}</p>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex h-[38px] items-center gap-1.5 rounded-ctl border border-line bg-surface px-3.5 text-[13px] font-bold"
        >
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-2 text-[12px] text-muted">Share this with Natascha so she can join from her phone.</p>

      <p className="mt-5 text-[13px] font-semibold text-muted">Members</p>
      <ul className="mt-1 divide-y divide-line">
        {members.map((m) => {
          const name = m.display_name || m.email || (m.user_id === user?.id ? 'You' : 'Member');
          return (
            <li key={m.user_id} className="flex items-center gap-3 py-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-ctl bg-violet text-[13px] font-bold text-white">
                {initials(name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {name}
                  {m.user_id === user?.id && <span className="font-normal text-muted"> (you)</span>}
                </span>
                <span className="block text-[12px] text-muted">
                  {m.role === 'owner' ? 'Owner' : 'Member'} · joined {formatStamp(m.joined_at)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <Button variant="secondary" icon={KeyRound} className="mt-3" onClick={() => setSheet(true)} disabled={demo}>
        Join with a code
      </Button>
      {demo && <p className="mt-2 text-[12px] text-muted">Joining a household needs a Supabase connection.</p>}

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Join a household">
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-muted">
            You'll move to the other household. Your personal data stays with you.
          </p>
          <Field label="Invite code">
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
          {error && <Notice tone="rose">{error}</Notice>}
          <Button onClick={() => void onJoin()} disabled={busy || code.trim().length < 6}>
            {busy ? 'Joining…' : 'Join household'}
          </Button>
        </div>
      </BottomSheet>
    </Card>
  );
}

function DataCard() {
  const { user } = useAuth();
  const { household } = useHousehold();
  const { reload } = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: 'green' | 'rose'; text: string } | null>(null);

  async function onExport() {
    if (!user) return;
    try {
      downloadBackup(await buildBackup(user.id, household));
    } catch (err) {
      setMessage({ tone: 'rose', text: err instanceof Error ? err.message : 'Export failed.' });
    }
  }

  async function onImport(file: File) {
    if (!user) return;
    try {
      const added = await importBackup(await file.text(), user.id, household?.id ?? null);
      await reload();
      const total = added.settings + added.inbox + added.records;
      setMessage({
        tone: 'green',
        text: total ? `Imported ${total} new record${total === 1 ? '' : 's'}.` : 'Nothing new to import.'
      });
    } catch (err) {
      setMessage({ tone: 'rose', text: err instanceof Error ? err.message : 'Import failed.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-[14px] text-muted">
        Export everything as a JSON file. Importing only adds records you don't already have; nothing is overwritten.
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" icon={Download} onClick={() => void onExport()}>
          Export
        </Button>
        <Button variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()}>
          Import
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && void onImport(e.target.files[0])}
      />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </Card>
  );
}

function InboxCard() {
  const { user } = useAuth();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  useEffect(() => {
    if (!user) return;
    listInbox(user.id)
      .then(setItems)
      .catch(() => setItems([]));
  }, [user]);

  return (
    <Card>
      {items && items.length > 0 ? (
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.id} className="py-2.5">
              <p className="line-clamp-2 text-[14px]">{i.text}</p>
              <p className="text-[12px] text-muted">
                {formatStamp(i.created_at)} · {i.source}
                {i.used_for ? ` · ${i.used_for}` : ''}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-3">
          <Inbox size={20} className="text-muted" aria-hidden />
          <p className="text-[14px] text-muted">
            {items === null ? 'Loading…' : 'Messages sent from the iPhone Shortcut will wait here.'}
          </p>
        </div>
      )}
    </Card>
  );
}

const CONNECTIONS = [
  { icon: MessageSquareText, title: 'WhatsApp Shortcut', body: 'Send Masjid Mubarak times from WhatsApp. Step 7.' },
  { icon: CalendarDays, title: 'Google Calendar', body: 'Two-way sync with your main calendar. Step 6.' }
];

export default function MoreScreen() {
  const { user, demo, signOut } = useAuth();
  const { settings, update } = useSettings();

  return (
    <Page>
      <Header label="Settings" title="More" />

      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-btn bg-violet text-[15px] font-bold text-white">
            {initials(settings.name)}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] text-muted">Signed in as</p>
            <p className="truncate text-[17px] font-extrabold">{demo ? 'Demo (this device only)' : user?.email}</p>
          </div>
        </div>
        <NameField />
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-muted">Theme</p>
          <Segmented<Theme>
            label="Theme"
            options={[
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
              { id: 'system', label: 'System' }
            ]}
            value={settings.theme}
            onChange={(theme) => void update({ theme })}
          />
        </div>
      </Card>

      <section>
        <SectionTitle>Household</SectionTitle>
        <HouseholdCard />
      </section>

      {extraAreas.length > 0 && (
        <section>
          <SectionTitle>Areas</SectionTitle>
          <Card className="!py-1">
            {extraAreas.map((a) => (
              <Link key={a.id} to={a.path} className="flex items-center gap-3 border-line py-3 [&+&]:border-t">
                <a.icon size={18} aria-hidden />
                <span className="flex-1 font-semibold">{a.label}</span>
                <ChevronRight size={16} className="text-muted" aria-hidden />
              </Link>
            ))}
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>Reminders</SectionTitle>
        <RemindersCard />
      </section>

      <section>
        <SectionTitle>Connections</SectionTitle>
        <Card className="!py-1">
          {CONNECTIONS.map((c) => (
            <div key={c.title} className="flex items-center gap-3 border-line py-3 [&+&]:border-t">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl bg-chip">
                <c.icon size={18} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{c.title}</span>
                <span className="block text-[13px] text-muted">{c.body}</span>
              </span>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <SectionTitle>Inbox</SectionTitle>
        <InboxCard />
      </section>

      <section>
        <SectionTitle>Your data</SectionTitle>
        <DataCard />
      </section>

      {!demo && (
        <Button variant="danger" icon={LogOut} onClick={() => void signOut()}>
          Sign out
        </Button>
      )}
    </Page>
  );
}
