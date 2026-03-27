import { useState } from 'react';

// ─── Page header ──────────────────────────────────────────────────────────────
export function AdminHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#E4EAF4', marginBottom: 2 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: 'rgba(255,255,255,.35)' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, color = '#7BAAEE' }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
export function AdminTable({ columns, rows, onRowClick }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            {columns.map(c => (
              <th key={c.key} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', whiteSpace: 'nowrap' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: '32px 14px', textAlign: 'center', color: 'rgba(255,255,255,.25)', fontSize: 13 }}>
                No records found
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={i}
              onClick={() => onRowClick?.(row)}
              style={{ borderBottom: '1px solid rgba(255,255,255,.05)', cursor: onRowClick ? 'pointer' : 'default', transition: 'background .1s' }}
              onMouseEnter={e => { if (onRowClick) e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              {columns.map(c => (
                <td key={c.key} style={{ padding: '11px 14px', fontSize: 13, color: 'rgba(255,255,255,.75)', whiteSpace: c.wrap ? 'normal' : 'nowrap' }}>
                  {c.render ? c.render(row[c.key], row) : row[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
export function Badge({ status }) {
  const map = {
    active:   { bg: 'rgba(58,158,122,.2)',  color: '#88D8B8', border: 'rgba(58,158,122,.3)'  },
    paid:     { bg: 'rgba(58,158,122,.2)',  color: '#88D8B8', border: 'rgba(58,158,122,.3)'  },
    sent:     { bg: 'rgba(58,111,212,.2)',  color: '#7BAAEE', border: 'rgba(58,111,212,.3)'  },
    pending:  { bg: 'rgba(200,120,74,.2)',  color: '#F5C098', border: 'rgba(200,120,74,.3)'  },
    inactive: { bg: 'rgba(120,120,140,.15)',color: '#B0B8C8', border: 'rgba(120,120,140,.25)'},
    draft:    { bg: 'rgba(120,120,140,.15)',color: '#B0B8C8', border: 'rgba(120,120,140,.25)'},
    super:    { bg: 'rgba(58,111,212,.25)', color: '#7BAAEE', border: 'rgba(58,111,212,.4)'  },
    support:  { bg: 'rgba(255,255,255,.08)',color: 'rgba(255,255,255,.5)', border: 'rgba(255,255,255,.12)' },
  };
  const s = map[status] || map.inactive;
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}`, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
}

// ─── Admin modal ──────────────────────────────────────────────────────────────
export function AdminModal({ open, onClose, title, children, width = 480 }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#161F2E', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: 28, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 40px 80px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#E4EAF4' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.35)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
export function AdminConfirm({ open, title, message, onConfirm, onCancel, danger = false }) {
  return (
    <AdminModal open={open} onClose={onCancel} title={title} width={380}>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onConfirm} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: danger ? 'rgba(192,80,80,.9)' : 'linear-gradient(135deg,#3A6FD4,#2550A8)', color: '#fff' }}>Confirm</button>
        <button onClick={onCancel} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: 'rgba(255,255,255,.5)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
      </div>
    </AdminModal>
  );
}

// ─── Form field ───────────────────────────────────────────────────────────────
export function AdminField({ label, type = 'text', value, onChange, placeholder, required = true, as = 'input' }) {
  const base = { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#E4EAF4', fontSize: 13, outline: 'none', marginBottom: 14, boxSizing: 'border-box' };
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.35)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</label>
      {as === 'select'
        ? <select value={value} onChange={onChange} style={base}>{onChange.children}</select>
        : as === 'textarea'
          ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={3} style={{ ...base, resize: 'vertical' }}/>
          : <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} style={base}/>
      }
    </div>
  );
}

// ─── Search bar ───────────────────────────────────────────────────────────────
export function AdminSearch({ value, onChange, placeholder = 'Search…' }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ padding: '8px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#E4EAF4', fontSize: 13, outline: 'none', width: 260 }}/>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'primary', size = 'sm', disabled = false }) {
  const styles = {
    primary: { background: 'linear-gradient(135deg,#3A6FD4,#2550A8)', color: '#fff', border: 'none' },
    ghost:   { background: 'transparent', color: 'rgba(255,255,255,.5)', border: '1px solid rgba(255,255,255,.12)' },
    danger:  { background: 'rgba(192,80,80,.15)', color: '#F5AAAA', border: '1px solid rgba(192,80,80,.25)' },
    success: { background: 'rgba(58,158,122,.15)', color: '#88D8B8', border: '1px solid rgba(58,158,122,.25)' },
  };
  const pad = size === 'sm' ? '5px 12px' : '9px 18px';
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: pad, borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .5 : 1, whiteSpace: 'nowrap', ...styles[variant] }}>
      {children}
    </button>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function AdminSpinner() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,.15)', borderTopColor: '#7BAAEE', borderRadius: '50%', animation: 'spin .65s linear infinite', margin: '0 auto' }}/>
    </div>
  );
}
