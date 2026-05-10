# Webui Apple-Style Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor mirrorbrain-web-react to match Apple-style design specification from DESIGN.md.

**Architecture:** Hybrid Tailwind + CSS variable token system. Components use Tailwind utilities backed by CSS variables for runtime flexibility and dark tile support.

**Tech Stack:** React, Tailwind CSS 3.4, Vitest, TypeScript, Inter font (Google Fonts)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `tailwind.config.js` | Modify | Add all design tokens (colors, typography, spacing, radius, shadow) |
| `index.html` | Modify | Replace Fira fonts with Inter |
| `src/styles/index.css` | Modify | Add CSS variables, update body defaults |
| `src/components/common/Button.tsx` | Modify | Apple-style variants with pill shapes |
| `src/components/common/Card.tsx` | Modify | Tile variants, remove shadows |
| `src/components/forms/Input.tsx` | Modify | Search variant with pill shape |
| `src/components/layout/Header.tsx` | Modify | Black nav style |
| `src/components/layout/AppShell.tsx` | Modify | Parchment background |
| `src/components/layout/TabNavigation.tsx` | Modify | Token migration |
| `src/components/common/Pagination.tsx` | Modify | Token migration |
| `src/components/common/MetricTile.tsx` | Modify | Token migration |
| `src/components/common/EmptyState.tsx` | Modify | Token migration |
| `src/components/forms/TextArea.tsx` | Modify | Token migration |
| `src/components/forms/Checkbox.tsx` | Modify | Token migration |
| `src/components/artifacts/*.tsx` | Modify | Token migration (5 files) |
| `src/components/memory/*.tsx` | Modify | Token migration (4 files) |
| `src/components/review/*.tsx` | Modify | Token migration (7 files) |

---

## Phase 1: Foundation

### Task 1: Update index.html - Inter Font

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/index.html`

- [ ] **Step 1: Replace Google Fonts link**

Replace the Fira fonts with Inter:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MirrorBrain - Personal Memory & Knowledge System</title>
    <!-- Google Fonts: Inter -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
  </head>
  <body class="bg-canvas-parchment text-ink font-body">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/index.html
git commit -m "feat(webui): replace Fira fonts with Inter"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 2: Update index.css - CSS Variables

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/styles/index.css`

- [ ] **Step 1: Add CSS variables and update body styles**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Apple-style design tokens */
:root {
  /* Brand & Accent */
  --color-primary: #0066cc;
  --color-primary-focus: #0071e3;
  --color-primary-on-dark: #2997ff;

  /* Surfaces */
  --color-canvas: #ffffff;
  --color-canvas-parchment: #f5f5f7;
  --color-surface-pearl: #fafafc;
  --color-surface-tile-1: #272729;
  --color-surface-tile-2: #2a2a2c;
  --color-surface-tile-3: #252527;
  --color-surface-black: #000000;

  /* Text */
  --color-ink: #1d1d1f;
  --color-body: #1d1d1f;
  --color-body-on-dark: #ffffff;
  --color-body-muted: #cccccc;
  --color-ink-muted-80: #333333;
  --color-ink-muted-48: #7a7a7a;

  /* Borders */
  --color-divider-soft: #f0f0f0;
  --color-hairline: #e0e0e0;
}

/* Base body styles */
body {
  @apply bg-canvas-parchment text-ink font-body;
  margin: 0;
  line-height: 1.47;
  font-size: 17px;
  letter-spacing: -0.374px;
}

/* Focus states for accessibility */
*:focus {
  @apply outline-none ring-2 ring-primary-focus ring-offset-2;
}

/* Respect reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/styles/index.css
git commit -m "feat(webui): add Apple-style CSS variables and update body defaults"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 3: Update tailwind.config.js - All Design Tokens

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/tailwind.config.js`

- [ ] **Step 1: Replace entire config with Apple-style tokens**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        body: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Brand & Accent
        primary: {
          DEFAULT: 'var(--color-primary)',
          focus: 'var(--color-primary-focus)',
          onDark: 'var(--color-primary-on-dark)',
        },
        // Surfaces
        canvas: {
          DEFAULT: 'var(--color-canvas)',
          parchment: 'var(--color-canvas-parchment)',
        },
        surfacePearl: 'var(--color-surface-pearl)',
        surfaceTile: {
          1: 'var(--color-surface-tile-1)',
          2: 'var(--color-surface-tile-2)',
          3: 'var(--color-surface-tile-3)',
          black: 'var(--color-surface-black)',
        },
        // Text
        ink: 'var(--color-ink)',
        body: 'var(--color-body)',
        bodyOnDark: 'var(--color-body-on-dark)',
        bodyMuted: 'var(--color-body-muted)',
        inkMuted: {
          80: 'var(--color-ink-muted-80)',
          48: 'var(--color-ink-muted-48)',
        },
        // Borders
        dividerSoft: 'var(--color-divider-soft)',
        hairline: 'var(--color-hairline)',
      },
      fontSize: {
        // Display sizes (negative letter-spacing for "Apple tight")
        'hero-display': ['56px', { lineHeight: '1.07', letterSpacing: '-0.28px', fontWeight: '600' }],
        'display-lg': ['40px', { lineHeight: '1.10', letterSpacing: '0', fontWeight: '600' }],
        'display-md': ['34px', { lineHeight: '1.47', letterSpacing: '-0.374px', fontWeight: '600' }],
        // Lead paragraphs
        'lead': ['28px', { lineHeight: '1.14', letterSpacing: '0.196px', fontWeight: '400' }],
        'lead-airy': ['24px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '300' }],
        // Tagline
        'tagline': ['21px', { lineHeight: '1.19', letterSpacing: '0.231px', fontWeight: '600' }],
        // Body (17px default)
        'body': ['17px', { lineHeight: '1.47', letterSpacing: '-0.374px', fontWeight: '400' }],
        'body-strong': ['17px', { lineHeight: '1.24', letterSpacing: '-0.374px', fontWeight: '600' }],
        'dense-link': ['17px', { lineHeight: '2.41', letterSpacing: '0', fontWeight: '400' }],
        // Caption & Utility
        'caption': ['14px', { lineHeight: '1.43', letterSpacing: '-0.224px', fontWeight: '400' }],
        'caption-strong': ['14px', { lineHeight: '1.29', letterSpacing: '-0.224px', fontWeight: '600' }],
        'button-utility': ['14px', { lineHeight: '1.29', letterSpacing: '-0.224px', fontWeight: '400' }],
        // Fine print
        'fine-print': ['12px', { lineHeight: '1.0', letterSpacing: '-0.12px', fontWeight: '400' }],
        'micro-legal': ['10px', { lineHeight: '1.3', letterSpacing: '-0.08px', fontWeight: '400' }],
        // Nav
        'nav-link': ['12px', { lineHeight: '1.0', letterSpacing: '-0.12px', fontWeight: '400' }],
        // Button large
        'button-large': ['18px', { lineHeight: '1.0', letterSpacing: '0', fontWeight: '300' }],
      },
      spacing: {
        'xxs': '4px',
        'xs': '8px',
        'sm': '12px',
        'md': '17px',
        'lg': '24px',
        'xl': '32px',
        'xxl': '48px',
        'section': '80px',
        '5.5': '22px',
        '2.75': '11px',
        '3.5': '14px',
        '3.75': '15px',
      },
      borderRadius: {
        'xs': '5px',
        'sm': '8px',
        'md': '11px',
        'lg': '18px',
        'pill': '9999px',
      },
      boxShadow: {
        'product': 'rgba(0, 0, 0, 0.22) 3px 5px 30px 0',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/tailwind.config.js
git commit -m "feat(webui): add Apple-style design tokens to Tailwind config"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Phase 2: Core Components

### Task 4: Update Button Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/common/Button.tsx`

- [ ] **Step 1: Rewrite Button with Apple-style variants**

```tsx
import { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'default' | 'pearl'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  children: React.ReactNode
}

export default function Button({
  variant = 'default',
  loading = false,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses = `
    inline-flex items-center justify-center gap-2
    transition-all duration-200 cursor-pointer
    focus:ring-2 focus:ring-primary-focus focus:ring-offset-2 focus:outline-none
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-[0.95]
  `

  const variantClasses: Record<ButtonVariant, string> = {
    // Primary: Action Blue pill - main CTAs
    primary: `
      bg-primary text-white
      rounded-pill px-5.5 py-2.75
      text-body font-normal
    `,
    // Secondary: Ghost pill - second CTA with primary
    secondary: `
      bg-transparent text-primary
      border border-primary
      rounded-pill px-5.5 py-2.75
      text-body font-normal
    `,
    // Default: Dark utility - nav/utility buttons
    default: `
      bg-ink text-bodyOnDark
      rounded-sm px-3.75 py-2
      text-button-utility font-normal
    `,
    // Pearl: Secondary in cards
    pearl: `
      bg-surfacePearl text-inkMuted-80
      border-2 border-dividerSoft
      rounded-md px-3.5 py-2
      text-caption font-normal
    `,
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="animate-spin">⟳</span>
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/common/Button.tsx
git commit -m "feat(webui): update Button with Apple-style variants"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 5: Update Card Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/common/Card.tsx`

- [ ] **Step 1: Add tile variants, remove shadows**

```tsx
import type { HTMLAttributes } from 'react'

type CardVariant = 'utility' | 'tile-light' | 'tile-parchment' | 'tile-dark'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  children: React.ReactNode
  className?: string
}

export default function Card({
  variant = 'utility',
  children,
  className = '',
  ...props
}: CardProps) {
  const variantClasses: Record<CardVariant, string> = {
    // Utility: Store/accessories grid - hairline border, no shadow
    utility: 'bg-canvas border border-hairline rounded-lg p-lg',
    // Tile light: Full-bleed white product tile
    tileLight: 'bg-canvas rounded-none py-section px-lg',
    // Tile parchment: Alternating light tile
    tileParchment: 'bg-canvas-parchment rounded-none py-section px-lg',
    // Tile dark: Dark product tile with white text
    tileDark: 'bg-surfaceTile-1 rounded-none py-section px-lg text-bodyOnDark',
  }

  return (
    <div
      className={`${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/common/Card.tsx
git commit -m "feat(webui): update Card with tile variants, remove shadows"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 6: Update Input Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/forms/Input.tsx`

- [ ] **Step 1: Add search variant with pill shape, update colors**

```tsx
import { InputHTMLAttributes } from 'react'

type InputVariant = 'default' | 'search'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  variant?: InputVariant
  error?: string
  helpText?: string
}

export default function Input({
  label,
  variant = 'default',
  error,
  helpText,
  className = '',
  ...props
}: InputProps) {
  const inputId = props.id || props.name

  const baseClasses = `
    w-full font-body transition-colors duration-200
    focus:ring-2 focus:ring-primary-focus focus:ring-offset-2 focus:outline-none
  `

  const variantClasses: Record<InputVariant, string> = {
    // Default form input
    default: `
      px-4 py-3 rounded-lg text-body
      bg-canvas border border-hairline text-ink
      hover:border-dividerSoft
      ${error ? 'border-red-400 focus:ring-red-500' : ''}
    `,
    // Search: Pill-shaped matching CTA grammar
    search: `
      px-sm py-xs rounded-pill h-11
      bg-canvas border border-dividerSoft text-ink
      placeholder:text-inkMuted-48
    `,
  }

  const labelClasses = 'block text-caption-strong text-ink uppercase tracking-wide'
  const errorClasses = 'text-caption text-red-600'
  const helpClasses = 'text-caption text-inkMuted-48'

  return (
    <div className="space-y-xxs">
      {label && (
        <label htmlFor={inputId} className={labelClasses}>
          {label}
        </label>
      )}

      <input
        id={inputId}
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        {...props}
      />

      {error && <p className={errorClasses}>{error}</p>}
      {helpText && !error && <p className={helpClasses}>{helpText}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/forms/Input.tsx
git commit -m "feat(webui): update Input with search variant and Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Phase 3: Layout Components

### Task 7: Update Header Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/layout/Header.tsx`

- [ ] **Step 1: Black nav style with Apple typography**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/layout/Header.tsx
git commit -m "feat(webui): update Header with black nav style"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 8: Update AppShell Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/layout/AppShell.tsx`

- [ ] **Step 1: Parchment background, update structure**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/layout/AppShell.tsx
git commit -m "feat(webui): update AppShell with parchment background"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Phase 4: Common Component Token Migration

### Task 9: Update Pagination Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/common/Pagination.tsx`

- [ ] **Step 1: Replace teal/slate with Apple tokens**

Replace all `teal-*` with `primary`, all `slate-*` with `ink`/`canvas`:
- `focus:ring-teal-500` → `focus:ring-primary-focus`
- `text-slate-900` → `text-ink`
- `bg-white` → `bg-canvas`
- `border-slate-200` → `border-hairline`

Run this replacement:
```bash
# In Pagination.tsx:
sed -i '' 's/teal-500/primary-focus/g' src/apps/mirrorbrain-web-react/src/components/common/Pagination.tsx
sed -i '' 's/teal-600/primary/g' src/apps/mirrorbrain-web-react/src/components/common/Pagination.tsx
sed -i '' 's/slate-900/ink/g' src/apps/mirrorbrain-web-react/src/components/common/Pagination.tsx
sed -i '' 's/slate-600/inkMuted-80/g' src/apps/mirrorbrain-web-react/src/components/common/Pagination.tsx
sed -i '' 's/slate-500/inkMuted-48/g' src/apps/mirrorbrain-web-react/src/components/common/Pagination.tsx
sed -i '' 's/bg-white/bg-canvas/g' src/apps/mirrorbrain-web-react/src/components/common/Pagination.tsx
sed -i '' 's/slate-200/hairline/g' src/apps/mirrorbrain-web-react/src/components/common/Pagination.tsx
sed -i '' 's/slate-300/dividerSoft/g' src/apps/mirrorbrain-web-react/src/components/common/Pagination.tsx
sed -i '' 's/rounded-lg/rounded-md/g' src/apps/mirrorbrain-web-react/src/components/common/Pagination.tsx
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/common/Pagination.tsx
git commit -m "feat(webui): migrate Pagination to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 10: Update MetricTile Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/common/MetricTile.tsx`

- [ ] **Step 1: Replace slate tokens**

```bash
sed -i '' 's/slate-900/ink/g' src/apps/mirrorbrain-web-react/src/components/common/MetricTile.tsx
sed -i '' 's/slate-600/inkMuted-80/g' src/apps/mirrorbrain-web-react/src/components/common/MetricTile.tsx
sed -i '' 's/slate-500/inkMuted-48/g' src/apps/mirrorbrain-web-react/src/components/common/MetricTile.tsx
sed -i '' 's/bg-white/bg-canvas/g' src/apps/mirrorbrain-web-react/src/components/common/MetricTile.tsx
sed -i '' 's/slate-200/hairline/g' src/apps/mirrorbrain-web-react/src/components/common/MetricTile.tsx
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/common/MetricTile.tsx
git commit -m "feat(webui): migrate MetricTile to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 11: Update EmptyState Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/common/EmptyState.tsx`

- [ ] **Step 1: Replace slate tokens**

```bash
sed -i '' 's/slate-900/ink/g' src/apps/mirrorbrain-web-react/src/components/common/EmptyState.tsx
sed -i '' 's/slate-600/inkMuted-80/g' src/apps/mirrorbrain-web-react/src/components/common/EmptyState.tsx
sed -i '' 's/slate-500/inkMuted-48/g' src/apps/mirrorbrain-web-react/src/components/common/EmptyState.tsx
sed -i '' 's/bg-white/bg-canvas/g' src/apps/mirrorbrain-web-react/src/components/common/EmptyState.tsx
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/common/EmptyState.tsx
git commit -m "feat(webui): migrate EmptyState to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 12: Update LoadingSpinner Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/common/LoadingSpinner.tsx`

- [ ] **Step 1: Replace any teal/slate tokens**

If LoadingSpinner uses teal or slate, replace:
- `teal-*` → `primary`
- `slate-*` → `ink` or `inkMuted-*`

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/common/LoadingSpinner.tsx
git commit -m "feat(webui): migrate LoadingSpinner to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Phase 5: Layout Component Token Migration

### Task 13: Update TabNavigation Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/layout/TabNavigation.tsx`

- [ ] **Step 1: Replace teal/slate tokens**

```bash
sed -i '' 's/teal-500/primary/g' src/apps/mirrorbrain-web-react/src/components/layout/TabNavigation.tsx
sed -i '' 's/teal-600/primary/g' src/apps/mirrorbrain-web-react/src/components/layout/TabNavigation.tsx
sed -i '' 's/teal-700/primary/g' src/apps/mirrorbrain-web-react/src/components/layout/TabNavigation.tsx
sed -i '' 's/teal-50/bg-canvas/g' src/apps/mirrorbrain-web-react/src/components/layout/TabNavigation.tsx
sed -i '' 's/teal-100/dividerSoft/g' src/apps/mirrorbrain-web-react/src/components/layout/TabNavigation.tsx
sed -i '' 's/slate-900/ink/g' src/apps/mirrorbrain-web-react/src/components/layout/TabNavigation.tsx
sed -i '' 's/slate-600/inkMuted-80/g' src/apps/mirrorbrain-web-react/src/components/layout/TabNavigation.tsx
sed -i '' 's/slate-500/inkMuted-48/g' src/apps/mirrorbrain-web-react/src/components/layout/TabNavigation.tsx
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/layout/TabNavigation.tsx
git commit -m "feat(webui): migrate TabNavigation to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 14: Update FeedbackBanner Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/layout/FeedbackBanner.tsx`

- [ ] **Step 1: Replace any teal/slate tokens**

Check file and replace:
- `bg-green-100` → `bg-green-50` (keep semantic success)
- `bg-red-100` → `bg-red-50` (keep semantic error)
- `bg-blue-100` → `bg-primary/10` for info banners
- Any slate → ink/inkMuted

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/layout/FeedbackBanner.tsx
git commit -m "feat(webui): migrate FeedbackBanner to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Phase 6: Forms Component Token Migration

### Task 15: Update TextArea Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/forms/TextArea.tsx`

- [ ] **Step 1: Replace slate tokens**

```bash
sed -i '' 's/slate-900/ink/g' src/apps/mirrorbrain-web-react/src/components/forms/TextArea.tsx
sed -i '' 's/slate-600/inkMuted-80/g' src/apps/mirrorbrain-web-react/src/components/forms/TextArea.tsx
sed -i '' 's/slate-500/inkMuted-48/g' src/apps/mirrorbrain-web-react/src/components/forms/TextArea.tsx
sed -i '' 's/bg-white/bg-canvas/g' src/apps/mirrorbrain-web-react/src/components/forms/TextArea.tsx
sed -i '' 's/slate-200/hairline/g' src/apps/mirrorbrain-web-react/src/components/forms/TextArea.tsx
sed -i '' 's/slate-300/dividerSoft/g' src/apps/mirrorbrain-web-react/src/components/forms/TextArea.tsx
sed -i '' 's/ring-blue-500/ring-primary-focus/g' src/apps/mirrorbrain-web-react/src/components/forms/TextArea.tsx
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/forms/TextArea.tsx
git commit -m "feat(webui): migrate TextArea to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 16: Update Checkbox Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/forms/Checkbox.tsx`

- [ ] **Step 1: Replace slate tokens**

```bash
sed -i '' 's/slate-900/ink/g' src/apps/mirrorbrain-web-react/src/components/forms/Checkbox.tsx
sed -i '' 's/slate-600/inkMuted-80/g' src/apps/mirrorbrain-web-react/src/components/forms/Checkbox.tsx
sed -i '' 's/slate-500/inkMuted-48/g' src/apps/mirrorbrain-web-react/src/components/forms/Checkbox.tsx
sed -i '' 's/bg-white/bg-canvas/g' src/apps/mirrorbrain-web-react/src/components/forms/Checkbox.tsx
sed -i '' 's/slate-200/hairline/g' src/apps/mirrorbrain-web-react/src/components/forms/Checkbox.tsx
sed -i '' 's/ring-blue-500/ring-primary-focus/g' src/apps/mirrorbrain-web-react/src/components/forms/Checkbox.tsx
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/forms/Checkbox.tsx
git commit -m "feat(webui): migrate Checkbox to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Phase 7: Artifacts Component Token Migration

### Task 17: Update ArtifactsPanel Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/artifacts/ArtifactsPanel.tsx`

- [ ] **Step 1: Replace teal/slate tokens**

Check file and replace all color tokens following the migration table.

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/artifacts/ArtifactsPanel.tsx
git commit -m "feat(webui): migrate ArtifactsPanel to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 18: Update HistoryTopics Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTopics.tsx`

- [ ] **Step 1: Replace teal/slate tokens**

```bash
sed -i '' 's/teal-500/primary/g' src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTopics.tsx
sed -i '' 's/teal-600/primary/g' src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTopics.tsx
sed -i '' 's/teal-700/primary/g' src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTopics.tsx
sed -i '' 's/teal-50/bg-canvas/g' src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTopics.tsx
sed -i '' 's/teal-100/dividerSoft/g' src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTopics.tsx
sed -i '' 's/slate-800/ink/g' src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTopics.tsx
sed -i '' 's/slate-900/ink/g' src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTopics.tsx
sed -i '' 's/slate-600/inkMuted-80/g' src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTopics.tsx
sed -i '' 's/slate-500/inkMuted-48/g' src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTopics.tsx
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTopics.tsx
git commit -m "feat(webui): migrate HistoryTopics to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 19: Update HistoryTable Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTable.tsx`

- [ ] **Step 1: Replace slate tokens**

```bash
sed -i '' 's/slate-900/ink/g' src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTable.tsx
sed -i '' 's/slate-600/inkMuted-80/g' src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTable.tsx
sed -i '' 's/slate-500/inkMuted-48/g' src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTable.tsx
sed -i '' 's/bg-white/bg-canvas/g' src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTable.tsx
sed -i '' 's/slate-200/hairline/g' src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTable.tsx
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/artifacts/HistoryTable.tsx
git commit -m "feat(webui): migrate HistoryTable to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 20: Update KnowledgeGraphPanel Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeGraphPanel.tsx`

- [ ] **Step 1: Replace teal/slate tokens**

```bash
sed -i '' 's/teal-100/dividerSoft/g' src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeGraphPanel.tsx
sed -i '' 's/teal-500/primary/g' src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeGraphPanel.tsx
sed -i '' 's/teal-600/primary/g' src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeGraphPanel.tsx
sed -i '' 's/slate-900/ink/g' src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeGraphPanel.tsx
sed -i '' 's/slate-600/inkMuted-80/g' src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeGraphPanel.tsx
sed -i '' 's/slate-500/inkMuted-48/g' src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeGraphPanel.tsx
sed -i '' 's/bg-white/bg-canvas/g' src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeGraphPanel.tsx
sed -i '' 's/slate-200/hairline/g' src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeGraphPanel.tsx
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeGraphPanel.tsx
git commit -m "feat(webui): migrate KnowledgeGraphPanel to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 21: Update Remaining Artifacts Components

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeMarkdownRenderer.tsx`
- Modify: `src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeDetailModal.tsx`
- Modify: `src/apps/mirrorbrain-web-react/src/components/artifacts/WikiLinkHoverCard.tsx`

- [ ] **Step 1: Replace tokens in each file**

For each file, apply sed replacements for slate → ink variants.

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/artifacts/*.tsx
git commit -m "feat(webui): migrate remaining artifacts components to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Phase 8: Memory Component Token Migration

### Task 22: Update MemoryPanel Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/memory/MemoryPanel.tsx`

- [ ] **Step 1: Replace slate tokens**

Apply slate → ink replacements.

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/memory/MemoryPanel.tsx
git commit -m "feat(webui): migrate MemoryPanel to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 23: Update MemoryList, MemoryRecord, SyncActions

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/memory/MemoryList.tsx`
- Modify: `src/apps/mirrorbrain-web-react/src/components/memory/MemoryRecord.tsx`
- Modify: `src/apps/mirrorbrain-web-react/src/components/memory/SyncActions.tsx`

- [ ] **Step 1: Replace tokens in each file**

Apply slate → ink replacements for each.

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/memory/*.tsx
git commit -m "feat(webui): migrate memory components to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Phase 9: Review Component Token Migration

### Task 24: Update ReviewPanel Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.tsx`

- [ ] **Step 1: Replace slate tokens**

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.tsx
git commit -m "feat(webui): migrate ReviewPanel to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 25: Update CandidateCard Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/CandidateCard.tsx`

- [ ] **Step 1: Replace teal/slate tokens**

```bash
sed -i '' 's/teal-500/primary/g' src/apps/mirrorbrain-web-react/src/components/review/CandidateCard.tsx
sed -i '' 's/slate-900/ink/g' src/apps/mirrorbrain-web-react/src/components/review/CandidateCard.tsx
sed -i '' 's/slate-600/inkMuted-80/g' src/apps/mirrorbrain-web-react/src/components/review/CandidateCard.tsx
sed -i '' 's/slate-500/inkMuted-48/g' src/apps/mirrorbrain-web-react/src/components/review/CandidateCard.tsx
sed -i '' 's/bg-white/bg-canvas/g' src/apps/mirrorbrain-web-react/src/components/review/CandidateCard.tsx
sed -i '' 's/slate-200/hairline/g' src/apps/mirrorbrain-web-react/src/components/review/CandidateCard.tsx
sed -i '' 's/rounded-xl/rounded-lg/g' src/apps/mirrorbrain-web-react/src/components/review/CandidateCard.tsx
# Remove shadows
sed -i '' 's/shadow-sm//g' src/apps/mirrorbrain-web-react/src/components/review/CandidateCard.tsx
sed -i '' 's/hover:shadow-md//g' src/apps/mirrorbrain-web-react/src/components/review/CandidateCard.tsx
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/CandidateCard.tsx
git commit -m "feat(webui): migrate CandidateCard to Apple-style tokens, remove shadows"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 26: Update SelectedCandidate Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.tsx`

- [ ] **Step 1: Replace all tokens (41 occurrences)**

This file has the most slate usage. Apply comprehensive replacement.

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.tsx
git commit -m "feat(webui): migrate SelectedCandidate to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 27: Update ReviewGuidance Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/ReviewGuidance.tsx`

- [ ] **Step 1: Replace slate tokens (31 occurrences)**

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/ReviewGuidance.tsx
git commit -m "feat(webui): migrate ReviewGuidance to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 28: Update Remaining Review Components

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/KeptCandidateCard.tsx`
- Modify: any other review/*.tsx files

- [ ] **Step 1: Replace tokens**

- [ ] **Step 2: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/*.tsx
git commit -m "feat(webui): migrate remaining review components to Apple-style tokens"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Phase 10: Verification

### Task 29: Run TypeScript Check

- [ ] **Step 1: Verify no TypeScript errors**

```bash
cd src/apps/mirrorbrain-web-react && tsc --noEmit
```

Expected: No errors

---

### Task 30: Run Tests

- [ ] **Step 1: Run Vitest**

```bash
cd src/apps/mirrorbrain-web-react && pnpm test run
```

Expected: All tests pass

- [ ] **Step 2: If tests fail, update expectations**

Check test files for class name expectations and update to match new tokens.

---

### Task 31: Visual Verification

- [ ] **Step 1: Start dev server**

```bash
cd src/apps/mirrorbrain-web-react && pnpm dev
```

- [ ] **Step 2: Manually verify**

Open browser and check:
1. Inter font rendering with letter-spacing
2. Action Blue (#0066cc) color on buttons
3. Pill-shaped primary buttons
4. Parchment background (#f5f5f7)
5. Black header bar
6. No shadows on cards
7. Hairline borders on utility cards

---

### Task 32: Final Commit

- [ ] **Step 1: Ensure all changes committed**

```bash
git status
```

- [ ] **Step 2: Create summary commit if needed**

```bash
git add -A
git commit -m "feat(webui): complete Apple-style design refactor"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Migration Reference Table

| Old Token | New Token |
|-----------|-----------|
| `bg-teal-600` | `bg-primary` |
| `bg-teal-700` | `bg-primary` |
| `bg-teal-500` | `bg-primary` |
| `text-teal-600` | `text-primary` |
| `text-teal-700` | `text-primary` |
| `border-teal-600` | `border-primary` |
| `border-teal-500` | `border-primary` |
| `bg-teal-50` | `bg-canvas` |
| `bg-teal-100` | `bg-canvas` or `border-dividerSoft` |
| `ring-teal-500` | `ring-primary-focus` |
| `focus:ring-teal-500` | `focus:ring-primary-focus` |
| `bg-white` | `bg-canvas` |
| `bg-slate-50` | `bg-canvas-parchment` |
| `bg-slate-100` | `bg-canvas` |
| `text-slate-900` | `text-ink` |
| `text-slate-800` | `text-ink` |
| `text-slate-700` | `text-ink` |
| `text-slate-600` | `text-inkMuted-80` |
| `text-slate-500` | `text-inkMuted-48` |
| `border-slate-200` | `border-hairline` |
| `border-slate-300` | `border-dividerSoft` |
| `ring-blue-500` | `ring-primary-focus` |
| `rounded-xl` | `rounded-lg` |
| `shadow-sm` | (remove) |
| `hover:shadow-md` | (remove) |