import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * An area of the app (Home, Health, Work...). Each area lives in its own
 * `src/areas/<name>.area.tsx` file and is picked up automatically, so a new
 * area such as Finance is added by adding one file.
 */
export type Area = {
  id: string;
  /** Route path, e.g. "/health". Sub-routes go under "/health/*". */
  path: string;
  label: string;
  icon: LucideIcon;
  /** Sort order in the tab bar and side bar. */
  order: number;
  /** true: one of the six tabs in the phone dock. false: listed under More. */
  dock: boolean;
  Screen: ComponentType;
};
