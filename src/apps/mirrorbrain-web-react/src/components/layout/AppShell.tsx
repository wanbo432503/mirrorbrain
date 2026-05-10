import Header from './Header'

type ThemeMode = 'light' | 'dark'

interface AppShellProps {
  children: React.ReactNode
  theme: ThemeMode
  onThemeToggle: () => void
}

export default function AppShell({ children, theme, onThemeToggle }: AppShellProps) {
  return (
    <div className="flex h-dvh min-h-screen flex-col overflow-hidden bg-canvas-parchment">
      <Header theme={theme} onThemeToggle={onThemeToggle} />
      <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-lg py-md">
        {children}
      </main>
    </div>
  )
}
