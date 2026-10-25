import { Home } from 'lucide-react';
import HomeScreen from '@/screens/Home';
import type { Area } from './types';

export default { id: 'home', path: '/', label: 'Home', icon: Home, order: 10, dock: true, Screen: HomeScreen } satisfies Area;
