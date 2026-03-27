import { useState } from 'react';

// Default SVG avatar — renders inline, no external dependency, never breaks
export const DEFAULT_SITTER_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23152033'/%3E%3Ccircle cx='40' cy='32' r='14' fill='%23304060'/%3E%3Cellipse cx='40' cy='72' rx='22' ry='18' fill='%23304060'/%3E%3Ctext x='40' y='37' font-family='system-ui' font-size='18' fill='%23A8CCFF' text-anchor='middle'%3E%E2%9E%BF%3C/text%3E%3C/svg%3E`;

/**
 * SitterAvatar — renders a sitter photo with graceful fallback.
 *
 * Props:
 *   url        – avatar_url from DB (may be null/undefined/broken)
 *   name       – sitter name for alt text
 *   size       – px number, default 40
 *   radius     – border-radius value, default '50%'
 *   style      – extra style overrides
 */
export default function SitterAvatar({ url, name = 'Sitter', size = 40, radius = '50%', style = {} }) {
  const [failed, setFailed] = useState(false);

  const base = {
    width: size,
    height: size,
    borderRadius: radius,
    objectFit: 'cover',
    flexShrink: 0,
    display: 'block',
    background: '#152033',
    ...style,
  };

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        style={base}
        onError={() => setFailed(true)}
      />
    );
  }

  // Fallback: inline SVG rendered as an img (always works)
  return (
    <img
      src={DEFAULT_SITTER_SVG}
      alt={name}
      style={base}
    />
  );
}
