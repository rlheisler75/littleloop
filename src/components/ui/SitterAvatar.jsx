// src/components/ui/SitterAvatar.jsx
// Renders a sitter photo with a coloured initials fallback.
// Never shows a broken image or a generic icon.
//
// Props:
//   url     – avatar_url from DB (may be null / non-URL / broken)
//   name    – sitter name — used for initials + accessible alt text
//   size    – number of px (default 40)
//   radius  – CSS border-radius value (default '50%')
//   style   – extra style overrides applied to the outer element

import { useState } from 'react';

function isValidUrl(val) {
  if (!val || typeof val !== 'string') return false;
  return val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:');
}

// Deterministic background colour from name — same name always same colour
function nameToColor(name = '') {
  const colors = [
    ['#0B3D3A', '#0BA5AD'],  // teal
    ['#1A103A', '#8869F7'],  // violet
    ['#1C1008', '#F5924A'],  // amber
    ['#0A1E10', '#4CD99A'],  // green
    ['#1A0F20', '#C084F5'],  // purple
    ['#091520', '#2AA8D4'],  // sky
  ];
  const idx = (name.charCodeAt(0) || 0) % colors.length;
  return colors[idx];
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

export default function SitterAvatar({ url, name = '', size = 40, radius = '50%', style = {} }) {
  const [failed, setFailed] = useState(false);

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    flexShrink: 0,
    display: 'block',
    overflow: 'hidden',
    ...style,
  };

  // Show photo if URL is valid and hasn't errored
  if (isValidUrl(url) && !failed) {
    return (
      <img
        src={url}
        alt={name || 'Sitter'}
        style={{ ...baseStyle, objectFit: 'cover' }}
        onError={() => setFailed(true)}
      />
    );
  }

  // Initials fallback — coloured circle with text
  const [bg, fg] = nameToColor(name);
  const fontSize = Math.round(size * 0.36);

  return (
    <div style={{
      ...baseStyle,
      background: bg,
      border: `1px solid ${fg}40`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      fontWeight: 700,
      fontSize,
      color: fg,
      letterSpacing: '0.5px',
      userSelect: 'none',
    }}>
      {getInitials(name)}
    </div>
  );
}
