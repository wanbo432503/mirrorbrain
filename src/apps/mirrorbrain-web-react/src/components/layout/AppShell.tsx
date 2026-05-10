import Header from './Header'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-dvh min-h-screen flex-col overflow-hidden bg-canvas-parchment">
      <Header />
      <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-lg py-md">
        {children}
      </main>
    </div>
  )
}
