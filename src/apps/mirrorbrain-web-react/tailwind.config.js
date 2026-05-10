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