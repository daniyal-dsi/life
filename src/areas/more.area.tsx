import { Ellipsis } from 'lucide-react';
import MoreScreen from '@/screens/More';
import type { Area } from './types';

export default { id: 'more', path: '/more', label: 'More', icon: Ellipsis, order: 1000, dock: true, Screen: MoreScreen } satisfies Area;
