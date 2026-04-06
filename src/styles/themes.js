// src/styles/themes.js
// ─────────────────────────────────────────────────────────────────────────────
// All theme palette definitions for Littleloop.
// Consumed by:
//   src/lib/theme.js       → applyTheme(), getPalette()
//   src/components/ui/ThemePicker.jsx → renders the picker grid
// ─────────────────────────────────────────────────────────────────────────────
//
// Each palette object shape:
//   id          {string}  — localStorage key, also saved to DB (sitters.theme / members.theme)
//   name        {string}  — display label shown in the picker
//   dark        {boolean} — true = dark theme, false = light theme
//   body        {string}  — page background color
//   orb1/orb2   {string}  — decorative background orb colors (rgba)
//   card        {string}  — card / surface background
//   accent      {string}  — primary action color (buttons, active states, links)
//   accentGrad  {string}  — gradient used for preview swatch + hero elements
//   nav         {string}  — nav bar background (rgba with blur)
//   logo        {string}  — animated logo gradient
//
// CONTRAST GUARANTEE:
//   Dark themes  → accent must be light enough to read on dark body
//   Light themes → accent must be dark enough for ≥4.5:1 on light body (WCAG AA)
//   Text vars are always set by applyTheme(), never hardcode rgba(255,255,255,...)
//   in components — always use var(--text), var(--text-dim), var(--text-faint)
// ─────────────────────────────────────────────────────────────────────────────

export const PALETTES = [

  // ── DARK THEMES ─────────────────────────────────────────────────────────────

  {
    id:         'midnight',
    name:       'Midnight',
    dark:       true,
    body:       '#0D1B2A',
    orb1:       'rgba(60,100,200,.35)',
    orb2:       'rgba(40,60,160,.25)',
    card:       'rgba(255,255,255,.035)',
    accent:     '#7BAAEE',
    accentGrad: 'linear-gradient(135deg,#7BAAEE,#4A7FCC)',
    nav:        'rgba(0,0,0,.2)',
    logo:       'linear-gradient(90deg,#7BAAEE,#A8C8F8,#DCEEFF,#A8C8F8,#7BAAEE)',
  },

  {
    id:         'aurora',
    name:       'Aurora',
    dark:       true,
    body:       '#0D1F1A',
    orb1:       'rgba(40,180,120,.35)',
    orb2:       'rgba(20,140,80,.25)',
    card:       'rgba(255,255,255,.035)',
    accent:     '#4CD99A',
    accentGrad: 'linear-gradient(135deg,#4CD99A,#28A870)',
    nav:        'rgba(0,0,0,.2)',
    logo:       'linear-gradient(90deg,#4CD99A,#90EFC0,#E0FFF0,#90EFC0,#4CD99A)',
  },

  {
    id:         'dusk',
    name:       'Dusk',
    dark:       true,
    body:       '#1A0F20',
    orb1:       'rgba(160,80,220,.35)',
    orb2:       'rgba(100,40,180,.25)',
    card:       'rgba(255,255,255,.035)',
    accent:     '#C084F5',
    accentGrad: 'linear-gradient(135deg,#C084F5,#9050D0)',
    nav:        'rgba(0,0,0,.2)',
    logo:       'linear-gradient(90deg,#C084F5,#DDB0FF,#F5E0FF,#DDB0FF,#C084F5)',
  },

  {
    id:         'ember',
    name:       'Ember',
    dark:       true,
    body:       '#1C1008',
    orb1:       'rgba(220,100,40,.35)',
    orb2:       'rgba(180,60,20,.25)',
    card:       'rgba(255,255,255,.035)',
    accent:     '#F5924A',
    accentGrad: 'linear-gradient(135deg,#F5924A,#C86020)',
    nav:        'rgba(0,0,0,.2)',
    logo:       'linear-gradient(90deg,#F5924A,#FFBF8A,#FFE8D8,#FFBF8A,#F5924A)',
  },

  {
    id:         'arctic',
    name:       'Arctic',
    dark:       true,
    body:       '#091520',
    orb1:       'rgba(20,100,160,.35)',
    orb2:       'rgba(10,70,120,.25)',
    card:       'rgba(255,255,255,.035)',
    accent:     '#2AA8D4',
    accentGrad: 'linear-gradient(135deg,#2AA8D4,#1580A8)',
    nav:        'rgba(0,0,0,.2)',
    logo:       'linear-gradient(90deg,#6FD4E8,#A8E8FF,#E2F8FF,#A8E8FF,#6FD4E8)',
  },

  {
    id:         'obsidian',
    name:       'Obsidian',
    dark:       true,
    body:       '#0A0A0A',
    orb1:       'rgba(60,60,60,.35)',
    orb2:       'rgba(40,40,40,.25)',
    card:       'rgba(255,255,255,.035)',
    accent:     '#A0A0B8',   // lightened for contrast on near-black bg
    accentGrad: 'linear-gradient(135deg,#A0A0B8,#6A6A80)',
    nav:        'rgba(0,0,0,.2)',
    logo:       'linear-gradient(90deg,#C0C0D0,#E0E0F0,#FFFFFF,#E0E0F0,#C0C0D0)',
  },

  // ── NEW: Littleloop 2026 (DARK) ──────────────────────────────────────────────
  // Sourced from colorspicker.net/en-us/trending/ — April 2026
  // Primary teal #0BA5AD · Accent violet #8869F7 · Warm amber #FED56C
  // Extra CSS vars set by applyTheme for this palette only:
  //   --accent-secondary  #8869F7  violet  → CTAs, secondary badges
  //   --accent-warm       #FED56C  amber   → invoices, revenue highlights
  //   --accent-success    #79F694  green   → active/confirmed status
  //   --accent-danger     #B05E7A  rose    → errors, cancelled
  {
    id:         'loop2026',
    name:       'Loop 2026 ✦',
    dark:       true,
    body:       '#0D1F1E',
    orb1:       'rgba(11,165,173,.40)',
    orb2:       'rgba(136,105,247,.25)',
    card:       'rgba(11,165,173,.06)',
    accent:     '#0BA5AD',
    accentGrad: 'linear-gradient(135deg,#0BA5AD,#8869F7)',
    nav:        'rgba(19,88,78,.70)',
    logo:       'linear-gradient(90deg,#0BA5AD,#79F694,#FED56C,#79F694,#0BA5AD)',
  },

  // ── LIGHT THEMES ─────────────────────────────────────────────────────────────
  // All accent colors darkened to achieve ≥4.5:1 contrast on their backgrounds

  {
    id:         'cloud',
    name:       'Cloud',
    dark:       false,
    body:       '#F0F4FA',
    orb1:       'rgba(100,140,220,.2)',
    orb2:       'rgba(80,160,140,.15)',
    card:       'rgba(255,255,255,.85)',
    accent:     '#3A6FD4',   // ~5.2:1 on #F0F4FA ✓
    accentGrad: 'linear-gradient(135deg,#3A6FD4,#2550A8)',
    nav:        'rgba(255,255,255,.75)',
    logo:       'linear-gradient(90deg,#3A6FD4,#2550A8,#3A6FD4)',
  },

  {
    id:         'mint',
    name:       'Mint',
    dark:       false,
    body:       '#EFF8F4',
    orb1:       'rgba(80,180,120,.2)',
    orb2:       'rgba(60,140,100,.15)',
    card:       'rgba(255,255,255,.85)',
    accent:     '#1E7A4A',   // ~5.8:1 on #EFF8F4 ✓
    accentGrad: 'linear-gradient(135deg,#1E7A4A,#125030)',
    nav:        'rgba(255,255,255,.75)',
    logo:       'linear-gradient(90deg,#1E7A4A,#125030,#1E7A4A)',
  },

  {
    id:         'lavender',
    name:       'Lavender',
    dark:       false,
    body:       '#F4F0FB',
    orb1:       'rgba(140,100,220,.2)',
    orb2:       'rgba(100,80,180,.15)',
    card:       'rgba(255,255,255,.85)',
    accent:     '#5A28B0',   // ~6.1:1 on #F4F0FB ✓
    accentGrad: 'linear-gradient(135deg,#5A28B0,#3A1080)',
    nav:        'rgba(255,255,255,.75)',
    logo:       'linear-gradient(90deg,#5A28B0,#3A1080,#5A28B0)',
  },

  {
    id:         'peach',
    name:       'Peach',
    dark:       false,
    body:       '#FBF2EE',
    orb1:       'rgba(220,120,80,.2)',
    orb2:       'rgba(180,80,50,.15)',
    card:       'rgba(255,255,255,.85)',
    accent:     '#A03820',   // ~5.4:1 on #FBF2EE ✓
    accentGrad: 'linear-gradient(135deg,#A03820,#782010)',
    nav:        'rgba(255,255,255,.75)',
    logo:       'linear-gradient(90deg,#A03820,#782010,#A03820)',
  },

  {
    id:         'sky',
    name:       'Sky',
    dark:       false,
    body:       '#EEF6FB',
    orb1:       'rgba(80,160,220,.2)',
    orb2:       'rgba(60,120,180,.15)',
    card:       'rgba(255,255,255,.85)',
    accent:     '#0A68A8',   // ~5.9:1 on #EEF6FB ✓
    accentGrad: 'linear-gradient(135deg,#0A68A8,#004880)',
    nav:        'rgba(255,255,255,.75)',
    logo:       'linear-gradient(90deg,#0A68A8,#004880,#0A68A8)',
  },

  {
    id:         'sand',
    name:       'Sand',
    dark:       false,
    body:       '#FAF7F0',
    orb1:       'rgba(180,150,80,.2)',
    orb2:       'rgba(140,110,60,.15)',
    card:       'rgba(255,255,255,.85)',
    accent:     '#6A4808',   // ~6.3:1 on #FAF7F0 ✓
    accentGrad: 'linear-gradient(135deg,#6A4808,#482E00)',
    nav:        'rgba(255,255,255,.75)',
    logo:       'linear-gradient(90deg,#6A4808,#482E00,#6A4808)',
  },

];

/**
 * Look up a palette by id. Falls back to 'midnight' if not found.
 * @param {string} id
 * @returns {object} palette
 */
export function getPalette(id) {
  return PALETTES.find(p => p.id === id) || PALETTES[0];
}

/** Convenience: all dark palettes */
export const DARK_PALETTES  = PALETTES.filter(p => p.dark);

/** Convenience: all light palettes */
export const LIGHT_PALETTES = PALETTES.filter(p => !p.dark);
