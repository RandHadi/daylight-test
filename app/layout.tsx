import type { Metadata } from 'next';
import './globals.css';
import './appearance.css';
export const metadata: Metadata = { title: 'Daylight · Make room for what matters', description: 'Your personal daily planner. Organize your tasks, protect your focus, and end the day with a little more space.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
