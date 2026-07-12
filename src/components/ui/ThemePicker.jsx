// src/components/ui/ThemePicker.jsx
// Drop into any Profile / Settings tab.
//
// Props:
//   currentTheme  {string}    active palette id, e.g. 'midnight'
//   onSelect      {function}  called with new palette id on selection
//
// Example usage:
//   import ThemePicker from '../components/ui/ThemePicker';
//   import { applyTheme }  from '../../lib/theme';
//
//   const [theme, setTheme] = useState(localStorage.getItem('ll_theme') || 'midnight');
//
//   function handleThemeSelect(id) {
//     setTheme(id);
//     applyTheme(id);
//     localStorage.setItem('ll_theme', id);
//     // persist to DB if desired:
//     // supabase.from('sitters').update({ theme: id }).eq('id', userId)
//     // supabase.from('members').update({ theme: id }).eq('id', userId)
//   }
//
//   <ThemePicker currentTheme={theme} onSelect={handleThemeSelect} />

import { DARK_PALETTES, LIGHT_PALETTES } from '../../styles/themes';

function Swatch({ p, isActive, onSelect }) {
  // Label color is locked to each palette's own background so it's always
  // readable inside the swatch regardless of the app's current theme.
  // Dark palette swatch → light label. Light palette swatch → dark label.
  const labelColor = p.dark ? 'rgba(255,255,255,.80)' : 'rgba(20,36,58,.70)';

  return (
    <button
      className="theme-swatch"
      onClick={() => onSelect(p.id)}
      title={p.name}
      style={{
        background: p.body,
        border: isActive
          ? '2px solid var(--accent)'
          : '2px solid var(--border)',
        boxShadow: isActive
          ? '0 0 0 3px var(--accent), 0 4px 14px rgba(0,0,0,.3)'
          : '0 2px 8px rgba(0,0,0,.15)',
      }}
    >
      {/* Gradient preview bar */}
      <div className="theme-swatch-bar" style={{ background: p.accentGrad }} />

      {/* Name — always readable on this swatch's own background */}
      <div className="theme-swatch-label" style={{ color: labelColor }}>
        {p.name}
      </div>

      {/* Active checkmark */}
      {isActive && (
        <div className="theme-swatch-check" style={{ background: p.accent }}>
          ✓
        </div>
      )}
    </button>
  );
}

export default function ThemePicker({ currentTheme, onSelect }) {
  return (
    <div>
      <div className="theme-section-label">Dark themes</div>
      <div className="theme-picker-grid">
        {DARK_PALETTES.map(p => (
          <Swatch key={p.id} p={p} isActive={currentTheme === p.id} onSelect={onSelect} />
        ))}
      </div>

      <div className="theme-section-label">Light themes</div>
      <div className="theme-picker-grid" style={{ marginBottom: 0 }}>
        {LIGHT_PALETTES.map(p => (
          <Swatch key={p.id} p={p} isActive={currentTheme === p.id} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
