import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, Heart, LayoutGrid, Plus, Settings, Shirt, Sparkles, Sun } from 'lucide-react';
import { useAppData } from '../AppData.jsx';
import { cx } from '../lib/format.js';
import UploadModal from './UploadModal.jsx';
import ItemModal from './ItemModal.jsx';
import SettingsModal from './SettingsModal.jsx';

const NAV = [
  { to: '/', label: 'Today', icon: Sun, end: true },
  { to: '/stylist', label: 'Stylist', icon: Sparkles },
  { to: '/wardrobe', label: 'Wardrobe', icon: Shirt },
  { to: '/outfits', label: 'Outfits', icon: LayoutGrid },
  { to: '/week', label: 'Planner', icon: CalendarDays },
  { to: '/saved', label: 'Saved', icon: Heart },
];

function Logo() {
  return (
    <NavLink to="/" className="flex shrink-0 items-center gap-2.5" aria-label="OutfitIQ home">
      <span className="grid size-8 place-items-center rounded-lg bg-ink text-white"><Shirt size={17} strokeWidth={2.2} /></span>
      <span className="font-display text-[19px] font-semibold tracking-tight">Outfit<span className="text-accent">IQ</span></span>
    </NavLink>
  );
}

export default function Layout() {
  const { ready, loadError, reload, toast, modal, openSettings, openUpload } = useAppData();

  return (
    <div className="flex min-h-dvh flex-col pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 sm:px-8">
          <Logo />
          <nav className="hidden h-full items-stretch gap-1 md:flex" aria-label="Main">
            {NAV.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => cx(
                  'relative flex items-center px-3 text-sm font-medium transition-colors',
                  isActive ? 'text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-ink' : 'text-muted hover:text-ink',
                )}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn btn-primary hidden h-9 sm:inline-flex" onClick={() => openUpload()}><Plus size={16} /> Add clothes</button>
            <button className="btn btn-ghost size-9 px-0" onClick={openSettings} aria-label="Settings"><Settings size={19} /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-8 pb-16 sm:px-8 sm:pt-10">
        {!ready ? (
          <div className="grid h-[60vh] place-items-center text-sm text-muted">Loading your wardrobe…</div>
        ) : loadError ? (
          <div className="card mx-auto mt-16 max-w-md p-8 text-center">
            <h1 className="font-display text-2xl font-semibold">Can’t reach the server</h1>
            <p className="mt-2 text-sm text-muted">{loadError}. Make sure the API is running (<code>npm run dev</code>).</p>
            <button className="btn btn-primary mt-6" onClick={reload}>Try again</button>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      <footer className="hidden border-t border-line bg-white md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-8 py-6 text-xs text-muted">
          <span>© {new Date().getFullYear()} OutfitIQ · Your wardrobe, styled daily.</span>
          <span>Weather data by Open-Meteo</span>
        </div>
      </footer>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden" aria-label="Main">
        <div className="grid grid-cols-6">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cx('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-ink' : 'text-muted')}>
              {({ isActive }) => (<><Icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />{label}</>)}
            </NavLink>
          ))}
        </div>
      </nav>

      {toast && (
        <div key={toast.id} role="status"
          className={cx('fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lift md:bottom-8',
            toast.kind === 'error' ? 'bg-red-600 text-white' : 'bg-ink text-white')}>
          {toast.text}
        </div>
      )}

      {modal?.type === 'upload' && <UploadModal initialFiles={modal.files} initialCategory={modal.category} />}
      {modal?.type === 'item' && <ItemModal id={modal.id} />}
      {modal?.type === 'settings' && <SettingsModal />}
    </div>
  );
}
