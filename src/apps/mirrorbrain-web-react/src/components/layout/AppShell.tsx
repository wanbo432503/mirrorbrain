import Header from './Header'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="bg-canvas-parchment min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-lg py-md flex-1">
        {children}
      </main>
    </div>
  )
}