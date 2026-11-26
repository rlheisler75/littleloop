import { useState } from 'react';
import { RESOURCE_CATEGORIES, openResourceFile, hostOf } from './resources';

// Resources grouped by category. Read-only for parents; staff pass onEdit.
export default function ResourceList({ items, onEdit = null, showHidden = false }) {
  const [err, setErr] = useState(null);
  const visible = showHidden ? items : items.filter(r => r.published);
  if (!visible.length) return null;

  async function openFile(r) {
    setErr(null);
    const e = await openResourceFile(r.file_path);
    if (e) setErr(e);
  }

  return (
    <div>
      {err && <div className="al al-e">{err}</div>}
      {RESOURCE_CATEGORIES.map(cat => {
        const list = visible.filter(r => r.category === cat.id);
        if (!list.length) return null;
        return (
          <div key={cat.id} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 6 }}>
              {cat.icon} {cat.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map(r => (
                <div key={r.id} className="card" style={{ padding: '11px 14px', opacity: r.published ? 1 : .6 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>
                        {r.pinned && <span title="Pinned">📍 </span>}{r.title}
                        {!r.published && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)' }}> · hidden from parents</span>}
                      </div>
                      {r.description && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{r.description}</div>}
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                            🔗 {hostOf(r.url)} ↗
                          </a>
                        )}
                        {r.file_path && (
                          <button onClick={() => openFile(r)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                            📎 {r.file_name || 'Open file'}
                          </button>
                        )}
                      </div>
                    </div>
                    {onEdit && <button className="bg" style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }} onClick={() => onEdit(r)}>Edit</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
