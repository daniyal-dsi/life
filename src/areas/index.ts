import type { Area } from './types';

// Every `*.area.tsx` file in this folder registers one area.
const files = import.meta.glob<{ default: Area }>('./*.area.tsx', { eager: true });

export const areas: Area[] = Object.values(files)
  .map((m) => m.default)
  .sort((a, b) => a.order - b.order);

export const dockAreas = areas.filter((a) => a.dock);
export const extraAreas = areas.filter((a) => !a.dock);

export type { Area };
