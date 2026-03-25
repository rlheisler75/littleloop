import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import Spinner from '../ui/Spinner';

// ─── Checkin History (parent side view) ──────────────────────────────────────
// Note: imports SessionsList lazily to avoid circular deps — SessionsList is in features/children

export function CheckinHistoryModal({ open, onClose, familyId, children }) {
  // SessionsList is imported here rather than at the top to keep the modal layer
  // free of feature-layer imports. Consumers can also pass SessionsList as a prop
  // if they prefer — but the dynamic import approach works fine for a modal.
  const [SessionsList, setSessionsList] = useState(null);

  useEffect(() => {
    if (open && !SessionsList) {
      import('../../features/children/SessionsList').then(m => setSessionsList(() => m.default));
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Hours & Check-ins</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16 }}>Sessions, hours logged, and editable times.</div>
      {SessionsList
        ? <SessionsList familyId={familyId} childrenMap={{}} showTitle={true}/>
        : <div style={{ textAlign: 'center', padding: 20 }}><Spinner size={20}/></div>
      }
    </Modal>
  );
}

// ─── Edit a single checkin timestamp ─────────────────────────────────────────

export function EditCheckinModal({ open, onClose, entry, label, onSaved }) {
  const [val,    setVal]    = useState('');
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [alert,  setAlert]  = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    if (open && entry) {
      const d     = new Date(entry.checked_at);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setVal(local);
      setNote('');
      setAlert(null);
    }
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id));
  }, [open, entry]);

  async function save(e) {
    e.preventDefault();
    if (!val) return;
    setSaving(true);
    const { error } = await supabase.from('checkins').update({
      checked_at:     new Date(val).toISOString(),
      edited:         true,
      edited_by:      userId,
      edited_by_name: entry?.checked_by_name,
      edit_note:      note.trim() || null,
    }).eq('id', entry.id);
    setSaving(false);
    if (error) { setAlert({ t: 'e', m: error.message }); return; }
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
        Edit {label} Time
      </div>
      {alert && <div className={`al al-${alert.t}`}>{alert.m}</div>}
      <form onSubmit={save}>
        <div style={{ marginBottom: 14 }}>
          <label className="fl">Time</label>
          <input className="fi" type="datetime-local" value={val} onChange={e => setVal(e.target.value)} required/>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="fl">Reason (optional)</label>
          <input className="fi" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Forgot to check out"/>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="bp full" disabled={saving}>{saving ? <Spinner/> : 'Save'}</button>
          <button type="button" className="bg" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Manual Checkout (add a missing checkout) ─────────────────────────────────

export function ManualCheckoutModal({ open, onClose, session, familyId, onSaved }) {
  const [val,    setVal]    = useState('');
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const now   = new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setVal(local);
      setNote('');
    }
  }, [open]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('checkins').insert({
      child_id:        session.child_id,
      family_id:       familyId,
      status:          'out',
      checked_by:      user?.id,
      checked_by_name: user?.email?.split('@')[0] || 'unknown',
      checked_by_role: 'manual',
      checked_at:      new Date(val).toISOString(),
      edited:          true,
      edit_note:       note.trim() || 'Manual checkout',
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Add Missing Checkout</div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16, lineHeight: 1.6 }}>Set the actual time this child was picked up.</p>
      <form onSubmit={save}>
        <div style={{ marginBottom: 14 }}>
          <label className="fl">Checkout time</label>
          <input className="fi" type="datetime-local" value={val} onChange={e => setVal(e.target.value)} required/>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="fl">Note (optional)</label>
          <input className="fi" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Forgot to check out yesterday"/>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="bp full" disabled={saving}>{saving ? <Spinner/> : 'Save Checkout'}</button>
          <button type="button" className="bg" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
