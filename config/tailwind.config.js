/** @type {import('tailwindcss').Config} */
import { resolve } from 'path'

/**
 * OlaClick Design System — Tailwind theme.
 * - Numeric scales (primary/gray/success/warning/error) are realigned to DS hex
 *   so existing utility-class markup is recolored to the DS automatically.
 * - Semantic, theme-aware colors (surface/canvas/fg/border/brand/tint/tag-*)
 *   are backed by CSS variables in client/src/styles/tokens.css and flip in dark mode.
 * - Dark mode is driven by the [data-theme="dark"] attribute (DS spec).
 */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    resolve(__dirname, '../client/index.html'),
    resolve(__dirname, '../client/src/**/*.{vue,js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        // Brand blue ramp centered on --brand-blue (#006FFF) at 600.
        primary: {
          50: '#EBF2FF',
          100: '#D6E6FF',
          200: '#ADC9FF',
          300: '#7FA9FF',
          400: '#4D8AFF',
          500: '#1A75FF',
          600: '#006FFF',
          700: '#0058CC',
          800: '#004BA8',
          900: '#003C85',
        },
        // Neutrals realigned to DS surfaces/borders/text.
        gray: {
          50: '#F9F9F9',
          100: '#F5F5F5',
          200: '#EBEBEB',
          300: '#D4D4D4',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#242424',
          900: '#1D252F',
        },
        success: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#28B84F',
          600: '#1F9D42',
          700: '#157A3D',
          800: '#166534',
          900: '#14532D',
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF9C3',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#FF9F00',
          600: '#D98213',
          700: '#A16207',
          800: '#92400E',
          900: '#78350F',
        },
        error: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },

        // ---- Theme-aware semantic tokens (auto flip via CSS vars) ----
        brand: {
          DEFAULT: 'var(--brand-blue)',
          alt: 'var(--brand-blue-alt)',
          press: 'var(--brand-blue-press)',
          active: 'var(--brand-blue-active)',
          orange: 'var(--brand-orange)',
          teal: 'var(--brand-teal)',
          green: 'var(--brand-active-green)',
        },
        canvas: 'var(--canvas)',
        surface: {
          DEFAULT: 'var(--bg)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
        },
        tint: 'var(--tint-blue)',
        fg: {
          DEFAULT: 'var(--fg1)',
          strong: 'var(--fg2)',
          muted: 'var(--fg3)',
          faint: 'var(--fg-muted)',
        },
        hairline: 'var(--border)',
        'input-border': 'var(--border-input)',
        nav: {
          text: 'var(--nav-text)',
          muted: 'var(--nav-muted)',
          bg: 'var(--nav-bg)',
          hover: 'var(--nav-hover)',
          'active-bg': 'var(--nav-active-bg)',
          'active-fg': 'var(--nav-active-fg)',
          border: 'var(--nav-border)',
        },
        tag: {
          'default-bg': 'var(--tag-default-bg)', 'default-fg': 'var(--tag-default-fg)',
          'blue-bg': 'var(--tag-blue-bg)', 'blue-fg': 'var(--tag-blue-fg)',
          'green-bg': 'var(--tag-green-bg)', 'green-fg': 'var(--tag-green-fg)',
          'red-bg': 'var(--tag-red-bg)', 'red-fg': 'var(--tag-red-fg)',
          'orange-bg': 'var(--tag-orange-bg)', 'orange-fg': 'var(--tag-orange-fg)',
          'yellow-bg': 'var(--tag-yellow-bg)', 'yellow-fg': 'var(--tag-yellow-fg)',
          'purple-bg': 'var(--tag-purple-bg)', 'purple-fg': 'var(--tag-purple-fg)',
          'cyan-bg': 'var(--tag-cyan-bg)', 'cyan-fg': 'var(--tag-cyan-fg)',
        },
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Poppins', 'Roboto', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // DS type role scale
        'micro': ['10px', { lineHeight: '1', fontWeight: '400' }],
        'small': ['12px', { lineHeight: '1', fontWeight: '500' }],
        'label': ['14px', { lineHeight: '1', fontWeight: '500' }],
        'body': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'h3': ['16px', { lineHeight: '1.3', fontWeight: '700' }],
        'h2': ['18px', { lineHeight: '1.25', fontWeight: '700' }],
        'h1': ['20px', { lineHeight: '1.2', fontWeight: '700' }],
        'display': ['40px', { lineHeight: '1.05', fontWeight: '700' }],
        // Standard scale retained for existing markup
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      borderRadius: {
        'xs': 'var(--r-xs)',
        'sm': 'var(--r-sm)',
        'md': 'var(--r-md)',
        'lg': 'var(--r-lg)',
        'xl': 'var(--r-lg)',
        '2xl': 'var(--r-lg)',
        '3xl': 'var(--r-lg)',
        '4xl': 'var(--r-lg)',
        'btn': 'var(--r-btn)',
        'full': 'var(--r-full)',
      },
      boxShadow: {
        'card': 'var(--shadow-card)',
        'pop': 'var(--shadow-pop)',
        'thumb': 'var(--shadow-thumb)',
        'sidebar': 'var(--shadow-sidebar)',
        // Standard scale kept but flattened toward the subtle border-led system
        'sm': 'var(--shadow-card)',
        'md': 'var(--shadow-card)',
        'lg': 'var(--shadow-pop)',
        'xl': 'var(--shadow-pop)',
        '2xl': 'var(--shadow-pop)',
        'inner': 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'glass-sm': 'var(--shadow-card)',
        'glass': 'var(--shadow-card)',
        'glass-lg': 'var(--shadow-pop)',
      },
      ringColor: {
        DEFAULT: 'var(--brand-blue)',
      },
      transitionTimingFunction: {
        'ds': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
