import { useState } from 'react';

// A section someone can fold up by tapping its title. What they fold stays folded on this
// device (localStorage, per section id); nothing is saved anywhere else.
const KEY = 'll_folded_sections';
const readFolded = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };

export function useFolded(id) {
  const [folded, setFolded] = useState(() => !!readFolded()[id]);
  const toggle = () => setFolded(f => {
    const next = !f;
    try {
      const all = readFolded();
      if (next) all[id] = 1; else delete all[id];
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch { /* private window etc.: folding still works for this visit */ }
    return next;
  });
  return [folded, toggle];
}

export const Chevron = ({ folded }) => (
  <span aria-hidden="true" style={{ display: 'inline-block', width: 10, fontSize: 10, transition: 'transform .15s', transform: folded ? 'rotate(-90deg)' : 'none' }}>▾</span>
);

//   id       — unique per section (what's remembered)
//   title    — the section label
//   summary  — short text shown beside the title while folded (e.g. "2", "1 to sign")
//   actions  — buttons on the right (hidden while folded)
//   forceOpen — show the contents anyway (e.g. coming back from a payment page)
export default function Collapsible({ id, title, summary, actions, forceOpen = false, style, children }) {
  const [folded, toggle] = useFolded(id);
  const shut = folded && !forceOpen;
  return (
    <div style={{ marginBottom: 20, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: shut ? 0 : 8, minHeight: 24 }}>
        <button type="button" onClick={toggle} aria-expanded={!shut}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', color: 'var(--text-faint)', minWidth: 0, textAlign: 'left' }}>
          <Chevron folded={shut}/>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.9px', textTransform: 'uppercase' }}>{title}</span>
          {shut && summary ? <span style={{ fontSize: 11 }}>· {summary}</span> : null}
        </button>
        {!shut && actions}
      </div>
      {!shut && children}
    </div>
  );
}
