/**
 * Maps the legacy emoji achievement icons (emitted by the server) to
 * OlaClick Design System Material Symbols. The DS forbids emoji in product UI,
 * so badges render a monochrome symbol that inherits the tier color instead.
 */
const EMOJI_TO_SYMBOL = {
  '🔔': 'notifications',
  '💵': 'attach_money',
  '🎉': 'celebration',
  '🏆': 'emoji_events',
  '✅': 'check_circle',
  '🎯': 'flag',
  '🚀': 'rocket_launch',
  '📦': 'package_2',
  '🔥': 'local_fire_department',
  '⚡': 'bolt',
  '📈': 'trending_up',
  '📊': 'bar_chart',
  '🛒': 'shopping_cart',
  '👑': 'workspace_premium',
  '💎': 'diamond',
  '🌟': 'star',
  '🔗': 'link',
  '📅': 'calendar_today',
  '🗓': 'calendar_month',
  '🏢': 'storefront',
  '🌐': 'public',
  '🎊': 'celebration',
  '🛰': 'satellite_alt',
  '✨': 'auto_awesome',
  '🤝': 'handshake',
  '🏛': 'account_balance',
  '🏗': 'apartment',
  '🎖': 'military_tech',
  '💫': 'auto_awesome',
  '💼': 'work',
  '🏅': 'military_tech'
}

/**
 * Resolve an achievement icon (emoji or already-a-symbol-name) to a
 * Material Symbols Rounded ligature name. Falls back to a trophy.
 */
export function achievementSymbol(icon) {
  if (!icon) return 'emoji_events'
  const stripped = String(icon).replace(/\uFE0F/g, '')
  if (EMOJI_TO_SYMBOL[stripped]) return EMOJI_TO_SYMBOL[stripped]
  // Already a symbol name (lowercase letters / underscores) — pass through.
  if (/^[a-z0-9_]+$/.test(stripped)) return stripped
  return 'emoji_events'
}
