import Spinner from './Spinner';

export function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="mo" onClick={onClose}>
      <div className="mb" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ open, title, message, onConfirm, onCancel, danger = false }) {
  return (
    <Modal open={open} onClose={onCancel}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
        {title}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24, lineHeight: 1.6 }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className={danger ? 'bd' : 'bp full'}
          style={danger ? { padding: '11px 20px' } : {}}
          onClick={onConfirm}
        >
          Confirm
        </button>
        <button className="bg" onClick={onCancel}>Cancel</button>
      </div>
    </Modal>
  );
}
