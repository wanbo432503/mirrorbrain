---
name: webui-apple-style-refactor
description: Refactor mirrorbrain-web-react to match Apple-style design specification from DESIGN.md
type: project
---

# Webui Apple-Style Refactor Design

## Summary

Refactor the React webui (`mirrorbrain-web-react`) to align with the Apple-style design specification documented in `DESIGN.md`. Replace the current Teal accent palette with Action Blue, adopt Inter typography with "Apple tight" letter-spacing, and implement full dark tile support for alternating section rhythm.

## Why

**Product alignment:** DESIGN.md defines the target visual identity — photography-first presentation, near-invisible UI, single blue accent, alternating light/dark tiles. Current implementation uses Teal accent and slate-based surfaces that don't match this specification.

**User experience:** Apple's design language creates a museum-gallery feel where content takes precedence over chrome. The 17px body text and editorial leading improve readability.

**How to apply:** All future webui work should use the tokens defined in this refactor. No inline hex colors, no second accent colors, no shadows on cards/buttons.

---

## Scope

### In Scope

- Tailwind config extension with DESIGN.md tokens (colors, typography, spacing, radius, shadow)
- CSS variables backing Tailwind tokens for runtime flexibility
- Font replacement: Fira Code/Fira Sans → Inter
- Button component: 4 Apple-style variants (primary pill, secondary ghost pill, dark utility, pearl capsule)
- Card component: utility-card and product-tile variants (no shadows)
- Input/Search component: pill-shaped for search variant
- Header component: black global nav style
- AppShell: parchment canvas background
- All domain components: color token migration (teal → primary, slate → ink)
- Test updates for new class expectations

### Out of Scope

- New components (TileSection, SubNav) — can be added later
- Mobile responsive breakpoints — already defined in DESIGN.md but implementation deferred
- Dark mode toggle — tiles are surface-level, not a global mode
- Non-React webui (`mirrorbrain-web`) — separate effort if needed

---

## Architecture

### Token System

**Hybrid approach:** Tailwind config references CSS variables, components use Tailwind utilities.

```
tailwind.config.js  → colors.primary = 'var(--color-primary)'
index.css           → :root { --color-primary: #0066cc; }
components          → className="bg-primary text-ink"
```

This enables:
- Single source of truth in Tailwind config
- Runtime flexibility for future tile switching
- Easy dark tile variant support via CSS variable overrides

### Color Tokens

| Token | CSS Variable | Hex | Use |
|-------|-------------|-----|-----|
| `primary` | `--color-primary` | #0066cc | All interactive elements (links, buttons, focus) |
| `primary-focus` | `--color-primary-focus` | #0071e3 | Focus ring on buttons |
| `primary-onDark` | `--color-primary-on-dark` | #2997ff | Links on dark tiles |
| `canvas` | `--color-canvas` | #ffffff | Pure white canvas |
| `canvasParchment` | `--color-canvas-parchment` | #f5f5f7 | Off-white, alternating light tiles |
| `surfacePearl` | `--color-surface-pearl` | #fafafc | Ghost button fill |
| `surfaceTile-1` | `--color-surface-tile-1` | #272729 | Primary dark tile |
| `surfaceTile-2` | `--color-surface-tile-2` | #2a2a2c | Dark tile variant for separation |
| `surfaceTile-3` | `--color-surface-tile-3` | #252527 | Dark tile for bottom/video frames |
| `surface-black` | `--color-surface-black` | #000000 | Global nav, video backgrounds |
| `ink` | `--color-ink` | #1d1d1f | Headlines, body text on light surfaces |
| `bodyOnDark` | `--color-body-on-dark` | #ffffff | All text on dark tiles |
| `bodyMuted` | `--color-body-muted` | #cccccc | Secondary copy on dark tiles |
| `inkMuted-80` | `--color-ink-muted-80` | #333333 | Pearl button text |
| `inkMuted-48` | `--color-ink-muted-48` | #7a7a7a | Disabled button text, fine print |
| `dividerSoft` | `--color-divider-soft` | #f0f0f0 | Secondary button border |
| `hairline` | `--color-hairline` | #e0e0e0 | Utility card border |

### Typography Tokens

**Font stack:** Inter (Google Fonts) with fallback to system-ui/-apple-system.

| Tailwind Class | Size | Weight | Line Height | Letter Spacing | Use |
|----------------|------|--------|-------------|----------------|-----|
| `text-hero-display` | 56px | 600 | 1.07 | -0.28px | Hero headline |
| `text-display-lg` | 40px | 600 | 1.10 | 0 | Tile headlines |
| `text-display-md` | 34px | 600 | 1.47 | -0.374px | Section heads |
| `text-lead` | 28px | 400 | 1.14 | 0.196px | Product tile subcopy |
| `text-lead-airy` | 24px | 300 | 1.5 | 0 | Editorial paragraphs |
| `text-tagline` | 21px | 600 | 1.19 | 0.231px | Sub-tile tagline |
| `text-body` | 17px | 400 | 1.47 | -0.374px | Default paragraph |
| `text-body-strong` | 17px | 600 | 1.24 | -0.374px | Inline emphasis |
| `text-dense-link` | 17px | 400 | 2.41 | 0 | Footer link columns |
| `text-caption` | 14px | 400 | 1.43 | -0.224px | Secondary captions |
| `text-caption-strong` | 14px | 600 | 1.29 | -0.224px | Emphasized captions |
| `text-button-utility` | 14px | 400 | 1.29 | -0.224px | Utility button labels |
| `text-fine-print` | 12px | 400 | 1.0 | -0.12px | Footer body |
| `text-nav-link` | 12px | 400 | 1.0 | -0.12px | Global nav links |
| `text-button-large` | 18px | 300 | 1.0 | 0 | Store hero CTAs |

### Spacing Tokens

| Token | Value | Use |
|-------|-------|-----|
| `xxs` | 4px | Micro adjustments |
| `xs` | 8px | Base unit |
| `sm` | 12px | Tight gaps |
| `md` | 17px | Body-line-height-derived |
| `lg` | 24px | Card padding |
| `xl` | 32px | Larger sections |
| `xxl` | 48px | Major separations |
| `section` | 80px | Product tile vertical padding |

### Border Radius Tokens

| Token | Value | Use |
|-------|-------|-----|
| `none` | 0px | Full-bleed product tiles |
| `xs` | 5px | Inline link chips (rare) |
| `sm` | 8px | Dark utility buttons, card imagery |
| `md` | 11px | Pearl button capsules |
| `lg` | 18px | Utility cards, accessories grid |
| `pill` | 9999px | Primary CTAs, search input, chips |

### Shadow Token

**Single shadow** reserved for product imagery only:

```css
shadow-product: rgba(0, 0, 0, 0.22) 3px 5px 30px 0
```

No shadows on cards, buttons, or text. Elevation via surface color change.

---

## Component Changes

### Button (`src/components/common/Button.tsx`)

**Current variants:**
- `default`: slate gray, `rounded-lg`
- `primary`: teal-600, `rounded-lg`
- `success`: green-600, `rounded-lg`
- `ghost`: transparent teal border

**New variants:**
| Variant | Classes | Use |
|---------|---------|-----|
| `primary` | `bg-primary text-white rounded-pill px-5.5 py-2.75 text-body` | "Learn more", "Buy" CTAs |
| `secondary` | `bg-transparent text-primary border border-primary rounded-pill px-5.5 py-2.75 text-body` | Second CTA with primary |
| `default` | `bg-ink text-bodyOnDark rounded-sm px-3.75 py-2 text-button-utility` | Nav utility buttons |
| `pearl` | `bg-surfacePearl text-inkMuted-80 border-3 border-dividerSoft rounded-md px-3.5 py-2 text-caption` | Secondary in cards |

**Active state:** Add `active:scale-[0.95]` to all variants.

**Focus state:** `focus:ring-2 focus:ring-primary-focus`

### Card (`src/components/common/Card.tsx`)

**Current:** `bg-white border-slate-200 rounded-xl shadow-sm hover:shadow-md`

**New variants:**
| Variant | Classes | Use |
|---------|---------|-----|
| `utility` | `bg-canvas border border-hairline rounded-lg p-lg` | Store/accessories grid |
| `tile-light` | `bg-canvas rounded-none py-section px-auto` | Full-bleed light product tile |
| `tile-parchment` | `bg-canvasParchment rounded-none py-section px-auto` | Alternating light tile |
| `tile-dark` | `bg-surfaceTile-1 rounded-none py-section px-auto text-bodyOnDark` | Dark product tile |

Remove all shadow classes. Product imagery inside tiles gets `shadow-product`.

### Input (`src/components/forms/Input.tsx`)

**Add search variant:**
- `variant="search"` → `rounded-pill h-11 px-sm bg-canvas border border-dividerSoft`
- Focus: `focus:ring-2 focus:ring-primary-focus`

### Header (`src/components/layout/Header.tsx`)

**New style:**
- Background: `bg-surface-black`
- Height: `h-11` (44px)
- Text: `text-bodyOnDark text-nav-link`
- Links: quiet, spaced ~20px apart

### AppShell (`src/components/layout/AppShell.tsx`)

**Change default background:**
- From: `bg-slate-50`
- To: `bg-canvasParchment`

---

## Domain Component Migration

All components in `artifacts/`, `memory/`, `review/`, `forms/` need color token updates:

| Old Class | New Class |
|-----------|-----------|
| `text-teal-600` | `text-primary` |
| `text-teal-700` | `text-primary` |
| `bg-teal-600` | `bg-primary` |
| `bg-teal-700` | `bg-primary` |
| `border-teal-600` | `border-primary` |
| `text-slate-900` | `text-ink` |
| `text-slate-600` | `text-inkMuted-80` |
| `text-slate-500` | `text-inkMuted-48` |
| `bg-slate-50` | `bg-canvasParchment` |
| `bg-slate-100` | `bg-canvas` |
| `bg-white` | `bg-canvas` |

---

## File Changes

### Modified Files

| File | Changes |
|------|---------|
| `tailwind.config.js` | Add color, typography, spacing, radius, shadow tokens |
| `index.html` | Replace Fira fonts with Inter Google Font link |
| `src/styles/index.css` | Add `:root` CSS variables, update body defaults |
| `src/components/common/Button.tsx` | New Apple-style variants, scale active state |
| `src/components/common/Button.test.tsx` | Update class expectations |
| `src/components/common/Card.tsx` | Remove shadow, add tile variants |
| `src/components/common/Card.test.tsx` | Update class expectations |
| `src/components/common/Input.tsx` | Add search variant with pill shape |
| `src/components/common/Input.test.tsx` | Update class expectations |
| `src/components/common/MetricTile.tsx` | Update color tokens |
| `src/components/layout/Header.tsx` | Black nav style |
| `src/components/layout/Header.test.tsx` | Update class expectations |
| `src/components/layout/AppShell.tsx` | Parchment background |
| `src/components/artifacts/*.tsx` | Color token migration |
| `src/components/memory/*.tsx` | Color token migration |
| `src/components/review/*.tsx` | Color token migration |
| `src/components/forms/*.tsx` | Color token migration |

---

## Migration Strategy

### Phase 1: Foundation

1. Update `index.html` — Inter font import
2. Update `src/styles/index.css` — CSS variables + body defaults
3. Update `tailwind.config.js` — All tokens

### Phase 2: Core Components

1. Button.tsx + Button.test.tsx
2. Card.tsx + Card.test.tsx
3. Input.tsx + Input.test.tsx

### Phase 3: Layout Components

1. Header.tsx + Header.test.tsx
2. AppShell.tsx

### Phase 4: Domain Components

Batch update all artifacts/memory/review/forms components with color token replacements.

### Phase 5: Verification

1. `tsc --noEmit`
2. `pnpm test` (or Vitest equivalent)
3. Dev server visual check

---

## Test Strategy

### Unit Tests

Each modified component's test file expects new Tailwind classes:
- Button: `rounded-pill`, `bg-primary`, `active:scale-[0.95]`
- Card: `rounded-lg`, `border-hairline`, no `shadow-*`
- Header: `bg-surface-black`, `h-11`

### Type Verification

`tsc --noEmit` after all changes.

### Visual Verification

Manual check in dev server:
- Inter font rendering with letter-spacing
- Action Blue (#0066cc) contrast on white/parchment/dark
- Button scale active state
- Dark tile text visibility (white on #272729)

---

## Risks

| Risk | Mitigation |
|------|------------|
| Inter font not loaded | Fallback stack `system-ui, -apple-system` |
| Dark tile contrast | Verify all dark-section text uses `text-bodyOnDark` |
| Breaking tests | Update tests in same commit as component |
| Pill buttons unfamiliar | Apple spec — intentional, trust design |
| Inline hardcoded colors | Audit components for hex/slate classes |

---

## Success Criteria

1. All tokens defined in Tailwind config backed by CSS variables
2. All components use token classes, no inline hex colors
3. Button primary = Action Blue pill (#0066cc, rounded-pill)
4. Cards have no shadows, only hairline borders
5. Dark tile sections render white text correctly
6. Typography: Inter with negative letter-spacing on display sizes
7. All tests pass (`tsc --noEmit` + Vitest)
8. Dev server renders correctly with new palette