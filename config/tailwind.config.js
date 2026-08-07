/** @type {import('tailwindcss').Config} */
import { resolve } from 'path'

/**
 * BLAST — Smash Burgers · Tailwind theme.
 *
 * - Numeric scales are realigned to the brandbook palette so existing utility
 *   markup is recoloured automatically. Legacy families (blue/indigo/teal…)
 *   alias onto the brand ramps rather than shipping off-brand hues.
 * - Semantic, theme-aware colors are backed by CSS variables in
 *   client/src/styles/tokens.css and flip on Fondo Verde Tattoo (dark).
 * - Dark mode is driven by the [data-theme="dark"] attribute.
 */

// Verde Menta (#50C293) at 400 · Verde Tattoo (#075A2A) at 600.
const brandGreen = {
  50: '#EFF9F4',
  100: '#D8F1E4',
  200: '#B2E4CB',
  300: '#86D4B0',
  400: '#50C293',
  500: '#2C9C6C',
  600: '#075A2A',
  700: '#054A22',
  800: '#043A1B',
  900: '#042E15',
}

// Success reads slightly brighter than the brand green so state stays legible.
const successGreen = {
  50: '#F0FAF4',
  100: '#DFF3E7',
  200: '#BCE7CE',
  300: '#8FD6AE',
  400: '#58BE86',
  500: '#1E8A4C',
  600: '#157A3D',
  700: '#0B5B2C',
  800: '#094B25',
  900: '#06371B',
}

// Mustard/gold — the only warm accent that sits comfortably on Crema Claro.
const brandGold = {
  50: '#FEFAEE',
  100: '#FBF1D8',
  200: '#F5E2AE',
  300: '#EACF83',
  400: '#DCB753',
  500: '#C7A34A',
  600: '#B5810F',
  700: '#77540A',
  800: '#5E4308',
  900: '#3F2D05',
}

// Brick red — muted enough to avoid the "tono gritón" the brandbook forbids.
const brandBrick = {
  50: '#FDF3F1',
  100: '#FBE9E6',
  200: '#F5CFC9',
  300: '#EDAEA4',
  400: '#DE8375',
  500: '#C64B39',
  600: '#B7382A',
  700: '#8C2015',
  800: '#6F1911',
  900: '#4A110B',
}

// Warm neutrals built from Crema Claro, Gris claro and Gris Acero.
const warmGray = {
  50: '#FFFCF4',
  100: '#F8F2E3',
  200: '#EEEEEE',
  300: '#D9D9D9',
  400: '#7E8B82',
  500: '#5C6B62',
  600: '#4A574E',
  700: '#33403A',
  800: '#0F2E1C',
  900: '#071F12',
}

const plum = {
  50: '#F6F4FB',
  100: '#ECE7F5',
  200: '#D6CCEB',
  300: '#B9A9DC',
  400: '#9A85C8',
  500: '#7B63AE',
  600: '#5F4A8C',
  700: '#4C3A73',
  800: '#3B2D5A',
  900: '#2E2547',
}

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    resolve(__dirname, '../client/index.html'),
    resolve(__dirname, '../client/src/**/*.{vue,js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        primary: brandGreen,
        gray: warmGray,
        slate: warmGray,
        zinc: warmGray,
        neutral: warmGray,
        stone: warmGray,
        // Feedback families keep their numeric ramp (fixed hues) and gain
        // theme-aware DEFAULT/bg/fg entries: `text-success` flips with the
        // theme, `text-success-600` stays pinned.
        success: { ...successGreen, DEFAULT: 'var(--success)', bg: 'var(--success-bg)', fg: 'var(--success-fg)' },
        green: successGreen,
        emerald: successGreen,
        lime: successGreen,
        warning: { ...brandGold, DEFAULT: 'var(--warning)', bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' },
        amber: brandGold,
        yellow: brandGold,
        orange: brandGold,
        error: { ...brandBrick, DEFAULT: 'var(--danger)', bg: 'var(--danger-bg)', fg: 'var(--danger-fg)' },
        red: brandBrick,
        rose: brandBrick,
        pink: brandBrick,
        pending: { bg: 'var(--pending-bg)', fg: 'var(--pending-fg)' },
        info: { bg: 'var(--info-bg)', fg: 'var(--info-fg)' },
        // Legacy blues alias onto the brand green ramp.
        blue: brandGreen,
        indigo: brandGreen,
        sky: brandGreen,
        cyan: brandGreen,
        teal: brandGreen,
        purple: plum,
        violet: plum,
        fuchsia: plum,

        // ---- Theme-aware semantic tokens (auto flip via CSS vars) ----
        brand: {
          DEFAULT: 'var(--brand)',
          fg: 'var(--brand-fg)',
          press: 'var(--brand-press)',
          mint: 'var(--mint)',
          'mint-press': 'var(--mint-press)',
          tattoo: 'var(--tattoo)',
          'tattoo-deep': 'var(--tattoo-deep)',
          cream: 'var(--cream)',
          ceramic: 'var(--ceramic)',
          steel: 'var(--steel-line)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          fg: 'var(--accent-fg)',
          wash: 'var(--accent-wash)',
        },
        canvas: 'var(--canvas)',
        surface: {
          DEFAULT: 'var(--bg)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
        },
        tint: 'var(--tint)',
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
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
          6: 'var(--chart-6)',
          7: 'var(--chart-7)',
          8: 'var(--chart-8)',
          grid: 'var(--chart-grid)',
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
        // Quicksand educa · Anton lidera sin levantar la voz · Space Mono es la barra.
        sans: ['Quicksand', 'system-ui', '-apple-system', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Anton', 'Arial Narrow', 'Impact', 'sans-serif'],
        mono: ['Space Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Type roles. Anton always runs at 1.10 line-height, uppercase.
        'micro': ['10px', { lineHeight: '1.2', fontWeight: '500' }],
        'small': ['12px', { lineHeight: '1.3', fontWeight: '500' }],
        'label': ['12px', { lineHeight: '1.2', fontWeight: '500' }],
        'body': ['14px', { lineHeight: '1.55', fontWeight: '500' }],
        'h3': ['15px', { lineHeight: '1.1', fontWeight: '400' }],
        'h2': ['18px', { lineHeight: '1.1', fontWeight: '400' }],
        'h1': ['22px', { lineHeight: '1.1', fontWeight: '400' }],
        'display': ['40px', { lineHeight: '1.1', fontWeight: '400' }],
        // Standard scale retained for existing markup
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.3rem' }],
        'base': ['1rem', { lineHeight: '1.55rem' }],
        'lg': ['1.125rem', { lineHeight: '1.6rem' }],
        'xl': ['1.25rem', { lineHeight: '1.6rem' }],
        '2xl': ['1.5rem', { lineHeight: '1.2' }],
        '3xl': ['1.875rem', { lineHeight: '1.15' }],
        '4xl': ['2.25rem', { lineHeight: '1.1' }],
        '5xl': ['3rem', { lineHeight: '1.05' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      letterSpacing: {
        display: '0.005em',
        label: '0.06em',
        mono: '0.02em',
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
        'inner': 'inset 0 1px 2px 0 rgba(7, 90, 42, 0.06)',
        'glass-sm': 'var(--shadow-card)',
        'glass': 'var(--shadow-card)',
        'glass-lg': 'var(--shadow-pop)',
      },
      ringColor: {
        DEFAULT: 'var(--accent)',
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
