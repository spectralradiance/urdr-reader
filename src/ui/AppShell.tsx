import { BookOpen, Library, MessagesSquare, Quote, Search } from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router'
import { useSettings } from '../features/reader/settings.ts'

/** Applies the reading theme to the whole document. */
export function RootLayout() {
  const [settings] = useSettings()
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'system') delete root.dataset.theme
    else root.dataset.theme = settings.theme
  }, [settings.theme])
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  )
}

const NAV = [
  { to: '/', label: 'Discover', icon: Search, end: true },
  { to: '/library', label: 'Library', icon: Library, end: false },
  { to: '/quotes', label: 'Quotes', icon: Quote, end: false },
  { to: '/room', label: 'Reading Room', icon: MessagesSquare, end: false },
]

export function AppShell() {
  return (
    <div className="min-h-dvh pb-16 sm:pb-0">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2 text-fg">
            <BookOpen className="size-6 text-accent" aria-hidden />
            <span className="font-serif text-xl font-semibold tracking-tight">Echtra</span>
          </Link>
          <nav className="ml-auto hidden gap-1 sm:flex" aria-label="Main">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm transition-colors ${isActive ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-muted">
        Books from{' '}
        <a className="underline" href="https://www.gutenberg.org" target="_blank" rel="noreferrer">
          Project Gutenberg
        </a>
        , public domain in the USA. Check the laws of your country before redistributing.
      </footer>

      {/* Mobile tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-bg/95 backdrop-blur-md sm:hidden"
        aria-label="Main"
      >
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-accent' : 'text-muted'}`
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-serif text-3xl">Lost in the labyrinth</h1>
      <p className="mt-3 text-muted">That page doesn't exist.</p>
      <Link to="/" className="mt-6 inline-block text-accent underline">
        Back to Discover
      </Link>
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted" role="status">
      <div className="size-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-2 text-sm text-muted">
        {error instanceof Error ? error.message : String(error)}
      </p>
    </div>
  )
}
