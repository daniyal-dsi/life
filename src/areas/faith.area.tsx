import { Moon } from 'lucide-react';
import FaithScreen from '@/screens/Faith';
import type { Area } from './types';

export default { id: 'faith', path: '/faith', label: 'Faith', icon: Moon, order: 50, dock: true, Screen: FaithScreen } satisfies Area;
