import { Menu, Home, FolderOpen, HelpCircle, Settings as SettingsIcon, Plus } from 'lucide-react';
import type { Page } from '../../App';
import { cn } from '../ui/utils';

interface TopNavProps {
  page: Page;
  onNavigate: (p: Page) => void;
  showMenuButton: boolean;
  onMenuClick: () => void;
}

const NAV: { page: Page; label: string; icon: React.ReactNode }[] = [
  { page: 'home', label: 'New Design', icon: <Plus size={16} aria-hidden="true" /> },
  { page: 'library', label: 'My Designs', icon: <FolderOpen size={16} aria-hidden="true" /> },
  { page: 'how', label: 'How It Works', icon: <HelpCircle size={16} aria-hidden="true" /> },
  { page: 'settings', label: 'Settings', icon: <SettingsIcon size={16} aria-hidden="true" /> },
];

export function TopNav({ page, onNavigate, showMenuButton, onMenuClick }: TopNavProps) {
  return (
    <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur border-b border-line">
      <div className="flex items-center gap-2 px-3 sm:px-5 h-16">
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open design tools menu"
            className="lg:hidden p-2 -ml-1 rounded-xl text-charcoal hover:bg-sand"
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 mr-2"
          aria-label="RoomVision AI Studio — home"
        >
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-moss to-bronze flex items-center justify-center shadow-sm" aria-hidden="true">
            <Home size={18} className="text-white" />
          </span>
          <span className="font-bold text-charcoal text-base sm:text-lg tracking-tight whitespace-nowrap">
            RoomVision <span className="text-bronze font-semibold">AI Studio</span>
          </span>
        </button>
        <nav aria-label="Primary" className="ml-auto">
          <ul className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.page}>
                <button
                  type="button"
                  onClick={() => onNavigate(n.page)}
                  aria-current={page === n.page ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors',
                    page === n.page
                      ? 'bg-moss text-white shadow-sm'
                      : 'text-charcoal-soft hover:bg-sand hover:text-charcoal',
                  )}
                >
                  {n.icon}
                  {n.label}
                </button>
              </li>
            ))}
          </ul>
          {/* mobile: compact nav */}
          <ul className="flex md:hidden items-center gap-0.5">
            {NAV.map((n) => (
              <li key={n.page}>
                <button
                  type="button"
                  onClick={() => onNavigate(n.page)}
                  aria-current={page === n.page ? 'page' : undefined}
                  aria-label={n.label}
                  title={n.label}
                  className={cn(
                    'p-2.5 rounded-xl transition-colors',
                    page === n.page ? 'bg-moss text-white' : 'text-charcoal-soft hover:bg-sand',
                  )}
                >
                  {n.icon}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
