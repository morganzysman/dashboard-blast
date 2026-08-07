/**
 * BLAST — Smash Burgers · palette helpers for canvas/SVG rendering.
 *
 * Charts and calendars can't use CSS variables directly (Chart.js paints to a
 * canvas), so read the resolved token values off the document instead. That
 * keeps data visualisation in step with Fondo Crema / Fondo Verde Tattoo.
 *
 * Palette roles come from the brand manual: the green is the base, the mint is
 * the identity accent, and gold/brick/plum are the only supporting hues that
 * sit comfortably next to Crema Claro.
 */

import { ref } from 'vue'

/**
 * Bumped whenever [data-theme] changes, so chart computeds that call into this
 * module re-evaluate and repaint when the user flips to Fondo Verde Tattoo.
 */
export const themeVersion = ref(0)

if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
  new MutationObserver(() => { themeVersion.value++ })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
}

const FALLBACK = {
  '--mint': '#50C293',
  '--tattoo': '#075A2A',
  '--cream': '#FFF8E7',
  '--ceramic': '#FFFFFF',
  '--steel-line': '#D9D9D9',
  '--fg1': '#0B3A21',
  '--fg2': '#075A2A',
  '--fg3': '#5C6B62',
  '--border': '#EEEEEE',
  '--chart-1': '#50C293',
  '--chart-2': '#075A2A',
  '--chart-3': '#2F8E63',
  '--chart-4': '#9BD9BC',
  '--chart-5': '#0B7A3C',
  '--chart-6': '#C7A34A',
  '--chart-7': '#7E8B82',
  '--chart-8': '#B7382A',
  '--chart-grid': '#D9D9D9',
  '--success': '#1E8A4C',
  '--warning': '#B5810F',
  '--danger': '#B7382A',
}

/** Resolve a single design token to a concrete colour string. */
export function token(name) {
  if (typeof window === 'undefined') return FALLBACK[name] ?? '#075A2A'
  // Touch the signal so callers inside computed() re-run on theme change.
  void themeVersion.value
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || FALLBACK[name] || '#075A2A'
}

/** True when the app is on Fondo Verde Tattoo. */
export function isDark() {
  return typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-theme') === 'dark'
}

/**
 * Categorical series, ordered for maximum separation between neighbours while
 * staying green-led. Wraps around for longer datasets.
 */
export function series() {
  return [
    token('--chart-1'),
    token('--chart-2'),
    token('--chart-6'),
    token('--chart-3'),
    token('--chart-8'),
    token('--chart-4'),
    token('--chart-5'),
    token('--chart-7'),
    '#5F4A8C',
    '#E0B451',
  ]
}

/** Pick the nth categorical colour, wrapping around. */
export function seriesColor(index) {
  const s = series()
  return s[((index % s.length) + s.length) % s.length]
}

/** Chart chrome: axes, gridlines and tick labels. */
export function chartChrome() {
  return {
    axis: token('--chart-grid'),
    grid: token('--border'),
    label: token('--fg3'),
    surface: token('--ceramic'),
  }
}

/** Add an alpha channel to a #rrggbb value. */
export function alpha(hex, a) {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/**
 * Ten shift/event colours as border + translucent fill pairs, derived from the
 * categorical series so calendars match the charts.
 */
export function eventPalette() {
  return series().map((border) => ({ border, bg: alpha(border, 0.14) }))
}

/** Payment methods seen in OlaClick order data. */
export function paymentMethodColor(name) {
  const map = {
    cash: token('--chart-2'),
    card: token('--chart-1'),
    bitcoin: token('--chart-6'),
    yape: '#5F4A8C',
    plin: token('--chart-3'),
    transfer: token('--chart-8'),
  }
  return map[String(name || '').toLowerCase()] || token('--chart-7')
}

/** Service types (dine-in, takeaway, delivery…). */
export function serviceTypeColor(type) {
  const map = {
    TABLE: token('--chart-2'),
    ONSITE: token('--chart-1'),
    TAKEAWAY: token('--chart-6'),
    DELIVERY: token('--chart-8'),
    OTHER: token('--chart-7'),
  }
  return map[type] || token('--chart-7')
}
