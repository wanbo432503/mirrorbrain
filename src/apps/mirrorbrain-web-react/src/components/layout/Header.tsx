export default function Header() {
  return (
    <header className="bg-surface-black h-11 flex items-center justify-between px-lg mb-0">
      <h1 className="text-display-lg text-bodyOnDark font-semibold tracking-tight">
        MirrorBrain
      </h1>
      <nav className="flex items-center gap-xs">
        <span className="text-nav-link text-bodyOnDark">Personal Memory & Knowledge</span>
      </nav>
    </header>
  )
}