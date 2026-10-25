import { CalendarDays } from 'lucide-react';
import CalendarScreen from '@/screens/Calendar';
import type { Area } from './types';

export default {
  id: 'calendar',
  path: '/calendar',
  label: 'Calendar',
  icon: CalendarDays,
  order: 20,
  dock: true,
  Screen: CalendarScreen
} satisfies Area;
