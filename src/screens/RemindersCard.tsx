import { useEffect, useState } from 'react';
import { Bell, BellOff, Send } from 'lucide-react';
import { Button, Card, Notice, Switch } from '@/components/ui';
import { pushStatus, sendTestPush, turnOffPush, turnOnPush, type PushStatus } from '@/lib/push';
import { useSettings, type ReminderPrefs } from '@/lib/settings';

// More > Reminders: turn phone notifications on for this device, choose which
// reminders to get (shared by all your devices), and send a test.

const KINDS: { key: keyof ReminderPrefs; title: string; when: string }[] = [
  { key: 'daily', title: 'Milestones due today', when: '08:00' },
  { key: 'p1', title: 'P1 milestones due tomorrow', when: '08:00' },
  { key: 'overdue', title: 'Milestones that became overdue', when: '18:00' },
  { key: 'weekly', title: 'Weekly summary', when: 'Sunday 19:00' },
  { key: 'nudges', title: 'Nudges', when: 'No workout by Thursday, calories not logged by 20:00' }
];

const STATUS_TEXT: Record<PushStatus, string> = {
  unconfigured: 'Reminders need setting up first (see the README).',
  unsupported: "This browser can't show notifications.",
  'needs-home-screen': 'On iPhone, add the app to your home screen (Share > Add to Home Screen), then open it from the icon to turn reminders on.',
  denied: 'Notifications are blocked for this app. Allow them in your phone settings, then come back.',
  off: 'Reminders are off on this device.',
  on: 'Reminders are on for this device.'
};

export default function RemindersCard() {
  const { settings, update } = useSettings();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'green' | 'rose'; text: string } | null>(null);

  useEffect(() => {
    pushStatus().then(setStatus, () => setStatus('unsupported'));
  }, []);

  async function run(action: () => Promise<string | void>, ok?: string) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      setMessage({ tone: 'green', text: result || ok || 'Done.' });
    } catch (err) {
      setMessage({ tone: 'rose', text: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setStatus(await pushStatus().catch(() => 'unsupported' as const));
      setBusy(false);
    }
  }

  const setPref = (key: keyof ReminderPrefs, value: boolean) => void update({ reminders: { ...settings.reminders, [key]: value } });

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl ${status === 'on' ? 'bg-green-soft text-green-ink' : 'bg-chip'}`}>
          {status === 'on' ? <Bell size={18} aria-hidden /> : <BellOff size={18} aria-hidden />}
        </span>
        <p className="text-[14px]">{status ? STATUS_TEXT[status] : 'Checking…'}</p>
      </div>

      {status === 'off' && (
        <Button icon={Bell} disabled={busy} onClick={() => void run(turnOnPush, 'Reminders are on. Try "Send a test".')}>
          Turn on reminders
        </Button>
      )}
      {status === 'on' && (
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" icon={Send} disabled={busy} onClick={() => void run(sendTestPush)}>
            Send a test
          </Button>
          <Button variant="secondary" icon={BellOff} disabled={busy} onClick={() => void run(turnOffPush, 'Reminders are off on this device.')}>
            Turn off
          </Button>
        </div>
      )}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <div>
        <p className="mb-1 text-[13px] font-semibold text-muted">Send me (UK time, on every device with reminders on)</p>
        <ul className="divide-y divide-line">
          {KINDS.map((k) => (
            <li key={k.key} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold">{k.title}</span>
                <span className="block text-[13px] text-muted">{k.when}</span>
              </span>
              <Switch checked={settings.reminders[k.key]} onChange={(v) => setPref(k.key, v)} label={k.title} />
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
