import { BriefcaseBusiness } from 'lucide-react';
import WorkScreen from '@/screens/Work';
import type { Area } from './types';

export default {
  id: 'work',
  path: '/work',
  label: 'Work',
  icon: BriefcaseBusiness,
  order: 40,
  dock: true,
  Screen: WorkScreen
} satisfies Area;
