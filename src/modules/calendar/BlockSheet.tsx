import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Dumbbell } from 'lucide-react';
import { Badge, BottomSheet, Button, Field, Notice, Switch, inputClass } from '@/components/ui';
import { fromISODate, todayISO } from '@/lib/date';
import { useLiftLog } from '@/modules/liftlog/store';
import { relDue } from '@/modules/workflow/stats';
import { projectMilestones, useWorkflow } from '@/modules/workflow/store';
import { chipKeys, look, type ChipKey } from './buckets';
import { useCalendar } from './store';
import { hhmm, toMin, workFor } from './time';
import { CAL_END, CAL_START, type Block } from './types';

// Plan a block (pick a bucket, then its task or workout), edit or remove one,
// or change a day's work hours.

export type SheetState =
  | { mode: 'plan'; date: string; start: number }
  | { mode: 'new'; chip: ChipKey; date: string; start: number }
  | { mode: 'edit'; block: Block }
  | { mode: 'work'; date: string };

const longDate = (iso: string) => fromISODate(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const defaultLen = (chip: ChipKey) => (chip === 'gym' ? 90 : chip === 'work' ? 480 : 60);

export default function BlockSheet({ state, onClose, onMessage }: { state: SheetState | null; onClose: () => void; onMessage: (m: string) => void }) {
  const { saveBlock, deleteBlock, work, setWorkDay, workOff, setUsualHours, clearWorkDay } = useCalendar();
  const { buckets, projects, milestones } = useWorkflow();
  const { templates } = useLiftLog();
  const navigate = useNavigate();
  const [chip, setChip] = useState<ChipKey | null>(null);
  const [date, setDate] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [usual, setUsual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!state) return;
    setError(null);
    setConfirm(false);
    setUsual(false);
    if (state.mode === 'edit') {
      const b = state.block;
      setChip(b.kind === 'gym' ? 'gym' : `bucket:${b.bucket_id}`);
      setDate(b.date);
      setStart(hhmm(b.start_min));
      setEnd(hhmm(b.end_min));
      setTaskId(b.task_id);
      setTemplateId(b.template_id);
    } else if (state.mode === 'work') {
      const w = workFor(work, state.date);
      setChip('work');
      setDate(state.date);
      setStart(hhmm(w?.start_min ?? 540));
      setEnd(hhmm(w?.end_min ?? 1020));
    } else {
      const c = state.mode === 'new' ? state.chip : null;
      setChip(c);
      setDate(state.date);
      setStart(hhmm(state.start));
      setEnd(hhmm(Math.min(state.start + (c ? defaultLen(c) : 60), CAL_END * 60)));
      setTaskId(null);
      setTemplateId(null);
    }
  }, [state]);

  if (!state) return <BottomSheet open={false} onClose={onClose} title="">{null}</BottomSheet>;

  const bucketId = chip?.startsWith('bucket:') ? chip.slice(7) : null;
  // Open tasks in the bucket, soonest due first.
  const tasks = bucketId
    ? projects
        .filter((p) => p.bucket_id === bucketId && p.status !== 'Done')
        .flatMap((p) => projectMilestones(milestones, p.id).filter((m) => !m.done).map((m) => ({ m, p })))
        .sort((a, b) => (a.m.due ?? 'z').localeCompare(b.m.due ?? 'z'))
    : [];
  const today = todayISO();

  function pick(c: ChipKey) {
    if (c === 'work') {
      onClose();
      return void addWork(date, toMin(start));
    }
    setChip(c);
    setEnd(hhmm(Math.min(toMin(start) + defaultLen(c), CAL_END * 60)));
  }

  async function addWork(d: string, min: number) {
    if (workFor(work, d)) return onMessage('Work is already on that day. Drag it, or tap it, to change the hours.');
    await setWorkDay(d, min, Math.min(min + 480, CAL_END * 60));
    onMessage(`Work added on ${longDate(d)}.`);
  }

  async function save() {
    const s = toMin(start);
    const e = toMin(end);
    if (!(e > s)) return setError('The end time must be after the start.');
    if (s < CAL_START * 60 || e > CAL_END * 60) return setError(`Keep it between ${CAL_START}:00 and ${CAL_END}:00.`);
    try {
      if (chip === 'work') {
        if (usual) {
          await setUsualHours(s, e);
          await clearWorkDay(date);
          onMessage(`Usual work hours are now ${start}–${end}.`);
        } else await setWorkDay(date, s, e);
      } else {
        if (chip === 'gym' && templates.length && !templateId) return setError('Pick which workout.');
        const task = tasks.find((t) => t.m.id === taskId)?.m;
        const tpl = templates.find((t) => t.id === templateId);
        await saveBlock(
          {
            date,
            start_min: s,
            end_min: e,
            kind: chip === 'gym' ? 'gym' : 'bucket',
            bucket_id: bucketId,
            task_id: task?.id ?? null,
            task_title: task?.title ?? (state!.mode === 'edit' && taskId === state!.block.task_id ? state!.block.task_title : null),
            template_id: tpl?.id ?? null,
            template_name: tpl?.name ?? null,
            google_event_id: state!.mode === 'edit' ? state!.block.google_event_id : null
          },
          state!.mode === 'edit' ? state!.block.id : undefined
        );
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  async function remove() {
    if (!confirm) return setConfirm(true);
    if (state!.mode === 'edit') await deleteBlock(state!.block.id);
    if (state!.mode === 'work') await workOff(date);
    onClose();
  }

  const L = chip ? look(chip, buckets) : null;
  const title = state.mode === 'plan' && !chip ? 'Plan a block' : chip === 'work' ? 'Work hours' : L?.name ?? 'Block';

  return (
    <BottomSheet open onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        {!chip ? (
          <>
            <p className="text-[13px] text-muted">
              {longDate(date)} at {start}
            </p>
            <div className="flex flex-col gap-2">
              {chipKeys(buckets).map((c) => {
                const l = look(c, buckets);
                return (
                  <button key={c} type="button" onClick={() => pick(c)} className="flex items-center justify-between gap-2 rounded-btn border border-line bg-bg px-3.5 py-3 text-left">
                    <span className="flex items-center gap-2.5">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-ctl ${l.cls}`}>
                        <l.icon size={16} aria-hidden />
                      </span>
                      <span className="font-bold">{l.name}</span>
                    </span>
                    <ChevronRight size={18} aria-hidden />
                  </button>
                );
              })}
              {buckets.length === 0 && <p className="text-[13px] text-muted">Add buckets in Work and they appear here too.</p>}
            </div>
          </>
        ) : (
          <>
            {chip !== 'work' && (
              <Field label="Date">{(id) => <input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />}</Field>
            )}
            {chip === 'work' && <p className="text-[13px] text-muted">{longDate(date)}</p>}
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Start">{(id) => <input id={id} type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />}</Field>
              <Field label="End">{(id) => <input id={id} type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />}</Field>
            </div>

            {chip === 'work' && (
              <div className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold">Make these my usual hours</span>
                  <span className="text-[13px] text-muted">Used on every weekday without its own times</span>
                </span>
                <Switch checked={usual} onChange={setUsual} label="Make these my usual hours" />
              </div>
            )}

            {chip === 'gym' && (
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-muted">Which workout?</p>
                {templates.length ? (
                  <div className="flex flex-wrap gap-2">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={templateId === t.id}
                        onClick={() => setTemplateId(t.id)}
                        className={`h-10 rounded-ctl border px-4 font-semibold ${templateId === t.id ? 'border-coral bg-coral-soft text-coral-ink' : 'border-line2 bg-surface'}`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted">No workout templates yet. Add them in Health › Lift Log › Templates.</p>
                )}
              </div>
            )}

            {bucketId && (
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-muted">Which task will you work on?</p>
                <div className="flex max-h-[34dvh] flex-col gap-2 overflow-y-auto">
                  {tasks.map(({ m, p }) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={taskId === m.id}
                      onClick={() => setTaskId(m.id)}
                      className={`flex items-center justify-between gap-2 rounded-btn border px-3.5 py-2.5 text-left ${taskId === m.id ? 'border-violet bg-violet-soft' : 'border-line bg-bg'}`}
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold">{m.title}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                          <Badge kind={p.priority} /> {p.name}
                        </span>
                      </span>
                      <span className="whitespace-nowrap text-[12px] font-bold text-muted">{relDue(m.due, today)}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={!taskId}
                    onClick={() => setTaskId(null)}
                    className={`rounded-btn border px-3.5 py-2.5 text-left font-semibold ${!taskId ? 'border-violet bg-violet-soft' : 'border-line bg-bg'}`}
                  >
                    No specific task
                  </button>
                </div>
                {tasks.length === 0 && <p className="mt-1.5 text-[13px] text-muted">No open tasks in this bucket. Add some in Work.</p>}
                <p className="mt-1.5 text-[12px] text-muted">The block only shows the task; it doesn't tick anything off in Work.</p>
              </div>
            )}

            {error && <Notice tone="rose">{error}</Notice>}
            <Button variant={chip === 'gym' ? 'coral' : 'primary'} onClick={() => void save()}>
              {state.mode === 'edit' || state.mode === 'work' ? 'Save' : 'Add to calendar'}
            </Button>
            {state.mode === 'edit' && chip === 'gym' && state.block.template_id && (
              <Button
                variant="secondary"
                icon={Dumbbell}
                onClick={() => navigate(`/health?m=lift&start=${state.block.template_id}`)}
              >
                Log workout: {state.block.template_name}
              </Button>
            )}
            {state.mode === 'work' && workFor(work, date)?.custom && (
              <Button
                variant="ghost"
                onClick={async () => {
                  await clearWorkDay(date);
                  onClose();
                }}
              >
                Back to usual hours
              </Button>
            )}
            {(state.mode === 'edit' || state.mode === 'work') && (
              <Button variant="danger" onClick={() => void remove()}>
                {confirm ? 'Tap again to confirm' : state.mode === 'work' ? 'Not working this day' : 'Remove block'}
              </Button>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
