import { GROUPS, type Exercise } from './types';

/** Exercise picker grouped by muscle group. */
export default function ExerciseSelect({
  exercises,
  value,
  onChange,
  placeholder,
  label,
  className = ''
}: {
  exercises: Exercise[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-12 w-full min-w-0 rounded-ctl border border-line2 bg-bg px-3 text-[16px] text-ink ${className}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {GROUPS.map((g) => {
        const list = exercises.filter((e) => e.group === g.id);
        if (!list.length) return null;
        return (
          <optgroup key={g.id} label={g.label}>
            {list.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </optgroup>
        );
      })}
      {value && !exercises.some((e) => e.id === value) && <option value={value}>Removed exercise</option>}
    </select>
  );
}
