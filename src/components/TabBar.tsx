import { NavLink } from 'react-router-dom';
import { areas, dockAreas } from '@/areas';

// Phone: a dark floating dock with the six main tabs; the active tab is a
// white tile. Laptop widths: a side bar listing every area instead.

export function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] lg:hidden"
    >
      <div
        className="pointer-events-auto mx-auto grid max-w-app gap-[3px] rounded-dock border border-tab-line bg-tab-bg p-1.5 shadow-[var(--shadow)]"
        style={{ gridTemplateColumns: `repeat(${dockAreas.length}, minmax(0, 1fr))` }}
      >
        {dockAreas.map(({ id, path, label, icon: Icon }) => (
          <NavLink
            key={id}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              [
                'flex h-[50px] flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11px] transition-colors',
                isActive ? 'bg-tab-on font-extrabold text-tab-on-fg' : 'font-semibold text-tab-fg'
              ].join(' ')
            }
          >
            <Icon size={20} strokeWidth={2} aria-hidden />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function SideBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col gap-1 border-r border-tab-line bg-tab-bg p-4 lg:flex"
    >
      <p className="disp mb-6 mt-2 px-3 text-[20px] text-tab-on">Life Organiser</p>
      {areas.map(({ id, path, label, icon: Icon }) => (
        <NavLink
          key={id}
          to={path}
          end={path === '/'}
          className={({ isActive }) =>
            [
              'flex h-11 items-center gap-3 rounded-btn px-3 text-[14px] transition-colors',
              isActive ? 'bg-tab-on font-bold text-tab-on-fg' : 'font-semibold text-tab-fg hover:bg-white/5'
            ].join(' ')
          }
        >
          <Icon size={18} strokeWidth={2} aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default TabBar;
