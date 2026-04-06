// src/lib/theme.js
// ─────────────────────────────────────────────────────────────────────────────
// Applies a palette to the document by setting CSS custom properties on :root.
// Import applyTheme wherever you need to switch themes (App.jsx, ThemePicker).
// ─────────────────────────────────────────────────────────────────────────────
//
// CSS VARIABLE REFERENCE — use these in ALL components, never hardcode colors:
//
//   Text
//     var(--text)           primary body text
//     var(--text-dim)       secondary / muted text
//     var(--text-faint)     placeholders, hints, timestamps
//
//   Surfaces
//     var(--body-bg)        page background
//     var(--card-bg)        card / panel surface
//     var(--nav-bg)         nav bar background (with blur)
//     var(--input-bg)       input field background
//
//   Borders & Dividers
//     var(--border)         standard border / divider
//     var(--input-border)   input field border
//
//   Accent & Actions
//     var(--accent)         primary action color (teal in Loop 2026)
//     var(--accent-grad)    gradient version of accent (hero, swatch)
//     var(--accent-secondary) secondary CTA (violet in Loop 2026, = accent otherwise)
//     var(--accent-warm)    warm highlight (amber in Loop 2026, = accent otherwise)
//     var(--accent-success) positive / active state color
//     var(--accent-success-deep) darker success for text on light badge bg
//     var(--accent-danger)  error / cancelled color
//
//   Badges & Pills
//     var(--pill-bg)        pill / tag background
//     var(--pill-text)      pill / tag text — always legible on --pill-bg
//     var(--badge-text)     badge text — always legible regardless of theme
//     var(--btn-text)       text on accent-colored buttons (always #fff)
//
//   Decorative
//     var(--orb1)           background orb 1
//     var(--orb2)           background orb 2
//     var(--logo-grad)      animated logo gradient
//     var(--dot-color)      background dot pattern
//     var(--shadow)         standard box shadow
//
// ─────────────────────────────────────────────────────────────────────────────

import { getPalette } from '../styles/themes';

/**
 * Apply a palette to the document root.
 * @param {string|object} palette  palette id string, or a palette object directly
 */
export function applyTheme(palette) {
  const p   = typeof palette === 'string' ? getPalette(palette) : palette;
  const root = document.documentElement;

  // ── Core palette vars ──────────────────────────────────────────────────────
  root.style.setProperty('--body-bg',     p.body);
  root.style.setProperty('--card-bg',     p.card);
  root.style.setProperty('--accent',      p.accent);
  root.style.setProperty('--accent-grad', p.accentGrad);
  root.style.setProperty('--nav-bg',      p.nav);
  root.style.setProperty('--orb1',        p.orb1);
  root.style.setProperty('--orb2',        p.orb2);
  root.style.setProperty('--logo-grad',   p.logo);

  // ── Contrast-safe text + UI vars ───────────────────────────────────────────
  if (!p.dark) {
    // LIGHT MODE — dark ink on light bg, never white-on-white
    root.style.setProperty('--text',           '#14243A');
    root.style.setProperty('--text-dim',       'rgba(20,36,58,.58)');
    root.style.setProperty('--text-faint',     'rgba(20,36,58,.35)');
    root.style.setProperty('--border',         'rgba(20,36,58,.10)');
    root.style.setProperty('--input-bg',       'rgba(20,36,58,.04)');
    root.style.setProperty('--input-border',   'rgba(20,36,58,.14)');
    root.style.setProperty('--dot-color',      'rgba(20,36,58,.06)');
    root.style.setProperty('--pill-bg',        'rgba(20,36,58,.08)');
    root.style.setProperty('--pill-text',      '#14243A');
    root.style.setProperty('--badge-text',     '#14243A');
    root.style.setProperty('--nav-text',       'rgba(20,36,58,.65)');
    root.style.setProperty('--nav-text-active','#14243A');
    root.style.setProperty('--btn-text',       '#FFFFFF');
    root.style.setProperty('--shadow',         '0 2px 12px rgba(20,36,58,.10)');
  } else {
    // DARK MODE — light ink on dark bg, never dark-on-dark
    root.style.setProperty('--text',           '#E4EAF4');
    root.style.setProperty('--text-dim',       'rgba(255,255,255,.55)');
    root.style.setProperty('--text-faint',     'rgba(255,255,255,.32)');
    root.style.setProperty('--border',         'rgba(255,255,255,.08)');
    root.style.setProperty('--input-bg',       'rgba(255,255,255,.05)');
    root.style.setProperty('--input-border',   'rgba(255,255,255,.10)');
    root.style.setProperty('--dot-color',      'rgba(255,255,255,.05)');
    root.style.setProperty('--pill-bg',        'rgba(255,255,255,.10)');
    root.style.setProperty('--pill-text',      '#E4EAF4');
    root.style.setProperty('--badge-text',     '#E4EAF4');
    root.style.setProperty('--nav-text',       'rgba(255,255,255,.60)');
    root.style.setProperty('--nav-text-active','#FFFFFF');
    root.style.setProperty('--btn-text',       '#FFFFFF');
    root.style.setProperty('--shadow',         '0 2px 16px rgba(0,0,0,.35)');
  }

  // ── Loop 2026 extended accent palette ─────────────────────────────────────
  // These extra vars are only meaningful for loop2026 but safe to reference
  // in components on any theme (they'll just equal --accent on other themes)
  if (p.id === 'loop2026') {
    root.style.setProperty('--accent-secondary',   '#8869F7');  // violet
    root.style.setProperty('--accent-warm',         '#FED56C');  // amber
    root.style.setProperty('--accent-warm-deep',    '#C38228');  // amber text on badges
    root.style.setProperty('--accent-success',      '#79F694');  // green pop
    root.style.setProperty('--accent-success-deep', '#418B45');  // green text on badges
    root.style.setProperty('--accent-danger',       '#B05E7A');  // dusty rose
  } else {
    root.style.setProperty('--accent-secondary',    p.accent);
    root.style.setProperty('--accent-warm',         p.accent);
    root.style.setProperty('--accent-warm-deep',    p.accent);
    root.style.setProperty('--accent-success',      p.dark ? '#4CD99A' : '#1E7A4A');
    root.style.setProperty('--accent-success-deep', p.dark ? '#4CD99A' : '#1E7A4A');
    root.style.setProperty('--accent-danger',       p.dark ? '#F08080' : '#A03820');
  }

  // ── Apply to body element ──────────────────────────────────────────────────
  document.body.style.background = p.body;
  document.body.style.color      = p.dark ? '#E4EAF4' : '#14243A';
}
