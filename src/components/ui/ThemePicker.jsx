import { PALETTES } from '../../lib/theme';
import SectionLabel from './SectionLabel';

export default function ThemePicker({ currentTheme, onSelect }) {
  const dark  = PALETTES.filter(p => p.dark);
  const light = PALETTES.filter(p => !p.dark);

  return (
    <div>
      <SectionLabel>Dark themes</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 20 }}>
        {dark.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            style={{
              border:      `2px solid ${currentTheme === p.id ? 'var(--accent,#7BAAEE)' : 'rgba(255,255,255,.1)'}`,
              borderRadius: 12,
              padding:     '10px 8px',
              cursor:      'pointer',
              background:  p.body,
              transition:  'all .2s',
              boxShadow:   currentTheme === p.id ? '0 0 0 2px var(--accent,#7BAAEE)22' : 'none',
              position:    'relative',
              overflow:    'hidden',
            }}
          >
            <div style={{ width: '100%', height: 28, borderRadius: 6, background: p.accentGrad, marginBottom: 6 }}/>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '.5px' }}>
              {p.name}
            </div>
            {currentTheme === p.id && (
              <div style={{ position: 'absolute', top: 6, right: 6, width: 14, height: 14, borderRadius: '50%', background: 'var(--accent,#7BAAEE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>
                ✓
              </div>
            )}
          </button>
        ))}
      </div>

      <SectionLabel>Light themes</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {light.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            style={{
              border:      `2px solid ${currentTheme === p.id ? '#666' : 'rgba(0,0,0,.12)'}`,
              borderRadius: 12,
              padding:     '10px 8px',
              cursor:      'pointer',
              background:  p.body,
              transition:  'all .2s',
              boxShadow:   currentTheme === p.id ? '0 0 0 2px #66666622' : 'none',
              position:    'relative',
              overflow:    'hidden',
            }}
          >
            <div style={{ width: '100%', height: 28, borderRadius: 6, background: p.accentGrad, marginBottom: 6 }}/>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(20,36,58,.6)', letterSpacing: '.5px' }}>
              {p.name}
            </div>
            {currentTheme === p.id && (
              <div style={{ position: 'absolute', top: 6, right: 6, width: 14, height: 14, borderRadius: '50%', background: p.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff' }}>
                ✓
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
