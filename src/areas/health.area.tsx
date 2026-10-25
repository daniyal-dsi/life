import { HeartPulse } from 'lucide-react';
import HealthScreen from '@/screens/Health';
import type { Area } from './types';

export default {
  id: 'health',
  path: '/health',
  label: 'Health',
  icon: HeartPulse,
  order: 30,
  dock: true,
  Screen: HealthScreen
} satisfies Area;
