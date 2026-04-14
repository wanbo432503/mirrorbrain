import Header from './Header'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-14">
      <Header />
      <main>
        {children}
      </main>
    </div>
  )
}