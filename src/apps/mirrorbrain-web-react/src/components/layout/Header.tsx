type ThemeMode = 'light' | 'dark'

interface HeaderProps {
  theme: ThemeMode
  onThemeToggle: () => void
}

export default function Header({ theme, onThemeToggle }: HeaderProps) {
  const nextTheme = theme === 'light' ? 'dark' : 'light'

  return (
    <header className="shrink-0 border-b border-hairline bg-canvas-parchment mb-0">
      <div
        data-testid="app-header-content"
        className="mx-auto flex h-11 w-full max-w-7xl items-center justify-between px-lg"
      >
        <div className="flex min-w-0 items-baseline gap-sm">
          <h1 className="text-display-lg text-ink font-semibold tracking-tight">
            MirrorBrain
          </h1>
          <span className="text-nav-link text-ink">Personal Memory & Knowledge</span>
        </div>
        <button
          type="button"
          onClick={onThemeToggle}
          className="rounded-pill border border-hairline bg-canvas px-3.75 py-2 text-button-utility text-ink transition-colors hover:border-primary hover:text-primary"
          aria-label={`Switch to ${nextTheme} theme`}
        >
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </div>
    </header>
  )
}
