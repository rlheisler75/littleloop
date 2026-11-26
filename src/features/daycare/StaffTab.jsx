import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal, Confirm } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { STAFF_ROLES, roleLabel, errText, sendFacilityInvite, isChildcareRole } from './api';

// Invite staff by email and set their role. Office managers handle office and teacher
// accounts; only a director adds, changes or removes directors (the database enforces it).
export default function StaffTab({ facilityId, me, director }) {
  const [staff,    setStaff]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [alert,    setAlert]    = useState(null);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [busy,     setBusy]     = useState({});

  const [rooms,    setRooms]    = useState([]);

  const load = useCallback(async () => {
    const [{ data }, { data: rm }] = await Promise.all([
      supabase.from('facility_staff').select('*').eq('facility_id', facilityId).order('status').order('name'),
      supabase.from('classrooms').select('id, name').eq('facility_id', facilityId).eq('active', true).order('sort').order('name'),
    ]);
    setStaff(data || []);
    setRooms(rm || []);
    setLoading(false);
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  const canManage = s => s.id !== me.id && (director || s.role !== 'director');

  async function update(s, patch, okMsg) {
    setBusy(b => ({ ...b, [s.id]: true })); setAlert(null);
    const { error } = await supabase.from('facility_staff').update(patch).eq('id', s.id);
    setBusy(b => ({ ...b, [s.id]: false }));
    if (error) setAlert(errText(error));
    else if (okMsg) setAlert({ ok: okMsg });
    load();
  }

  async function resend(s) {
    setBusy(b => ({ ...b, [s.id]: true })); setAlert(null);
    const r = await sendFacilityInvite({ kind: 'staff', staffId: s.id });
    setBusy(b => ({ ...b, [s.id]: false }));
    setAlert(r.ok ? { ok: `Invite sent to ${s.email}.` } : r.error);
  }

  async function remove() {
    const s = removing;
    setRemoving(null); setAlert(null);
    const { error } = s.status === 'invited'
      ? await supabase.from('facility_staff').delete().eq('id', s.id)
      : await supabase.from('facility_staff').update({ status: 'removed' }).eq('id', s.id);
    if (error) setAlert(errText(error));
    load();
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;

  const current = staff.filter(s => s.status !== 'removed');
  const former  = staff.filter(s => s.status === 'removed');
  const roleOptions = STAFF_ROLES.filter(r => director || r.id !== 'director');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600 }}>Staff <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>{current.length}</span></div>
        <button className="bp" onClick={() => setInviting(true)}>+ Invite staff</button>
      </div>
      {alert && <div className={`al ${alert.ok ? 'al-s' : 'al-e'}`}>{alert.ok || alert}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {current.map(s => (
          <div key={s.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{s.name || s.email}{s.id === me.id && <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 500 }}> (you)</span>}</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', wordBreak: 'break-all' }}>{s.email}</div>
            </div>
            {s.status === 'invited' && <span className="sb sb-p">Invited</span>}
            {(director || s.role !== 'director') && rooms.length > 0 && isChildcareRole(s.role) && (
              <select className="fi" value={s.classroom_id || ''} disabled={busy[s.id]} onChange={e => update(s, { classroom_id: e.target.value || null })}
                aria-label={`Home room for ${s.name || s.email}`} title="Home room: teachers can open the documents of children in this room"
                style={{ width: 'auto', marginBottom: 0, padding: '6px 10px', fontSize: 12 }}>
                <option value="">No home room</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
            {canManage(s) ? (
              <select className="fi" value={s.role} disabled={busy[s.id]} onChange={e => update(s, { role: e.target.value, ...(isChildcareRole(e.target.value) ? {} : { classroom_id: null }) })} aria-label={`Role for ${s.name || s.email}`}
                style={{ width: 'auto', marginBottom: 0, padding: '6px 10px', fontSize: 12 }}>
                {roleOptions.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            ) : <span className="chip" style={{ fontSize: 11 }}>{roleLabel(s.role)}</span>}
            {canManage(s) && (
              <div style={{ display: 'flex', gap: 6 }}>
                {s.status === 'invited' && <button className="bg" style={smallBtn} disabled={busy[s.id]} onClick={() => resend(s)}>{busy[s.id] ? <Spinner size={10}/> : 'Resend'}</button>}
                <button className="bg" style={smallBtn} onClick={() => setRemoving(s)}>{s.status === 'invited' ? 'Cancel invite' : 'Remove'}</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {former.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-faint)', marginBottom: 8 }}>Former staff</div>
          {former.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 160 }}>{s.name || s.email} <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>· {roleLabel(s.role)}</span></span>
              {canManage(s) && (
                <button className="bg" style={smallBtn} disabled={busy[s.id]}
                  onClick={() => s.user_id ? update(s, { status: 'active' }, `${s.name || s.email} is back on staff.`) : update(s, { status: 'invited' }).then(() => resend(s))}>
                  {s.user_id ? 'Reinstate' : 'Invite again'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <InviteModal open={inviting} onClose={() => setInviting(false)} facilityId={facilityId} roleOptions={roleOptions} onDone={load}/>
      <Confirm open={!!removing} danger
        title={removing?.status === 'invited' ? 'Cancel this invite?' : `Remove ${removing?.name || removing?.email}?`}
        message={removing?.status === 'invited' ? 'The invite link will stop working.' : 'They lose access to your daycare right away. Their past check-ins and updates are kept, and you can reinstate them later.'}
        onConfirm={remove} onCancel={() => setRemoving(null)}/>
    </div>
  );
}

const smallBtn = { fontSize: 11, padding: '5px 10px' };

function InviteModal({ open, onClose, facilityId, roleOptions, onDone }) {
  const [name,   setName]   = useState('');
  const [email,  setEmail]  = useState('');
  const [role,   setRole]   = useState('teacher');
  const [saving, setSaving] = useState(false);
  const [alert,  setAlert]  = useState(null);

  function close() { if (saving) return; setName(''); setEmail(''); setRole('teacher'); setAlert(null); onClose(); }

  async function submit(e) {
    e.preventDefault();
    setAlert(null);
    if (!name.trim()) { setAlert('Enter their name.'); return; }
    if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email.trim())) { setAlert('Enter a valid email.'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('facility_staff')
      .insert({ facility_id: facilityId, name: name.trim(), email: email.trim(), role }).select('id').single();
    if (error) { setAlert(errText(error)); setSaving(false); return; }
    const r = await sendFacilityInvite({ kind: 'staff', staffId: data.id });
    setSaving(false);
    onDone();
    if (!r.ok) { setAlert(`Added, but the email didn't send (${r.error}). Use Resend on their row.`); return; }
    close();
  }

  return (
    <Modal open={open} onClose={close}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Invite staff</div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16, lineHeight: 1.6 }}>
        We'll email them a link. They create a login with this email (or sign in, if they already use littleloop) and land on your daycare.
      </p>
      {alert && <div className="al al-e">{alert}</div>}
      <form onSubmit={submit}>
        <label className="fl">Name</label>
        <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="Ms. Jenny Park" maxLength={80} autoFocus autoComplete="off"/>
        <label className="fl">Email</label>
        <input className="fi" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jenny@example.com" autoComplete="off"/>
        <label className="fl">Role</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {roleOptions.map(r => (
            <label key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
              border: `1px solid ${role === r.id ? 'var(--accent)' : 'var(--border)'}`, background: role === r.id ? 'color-mix(in srgb,var(--accent) 10%,transparent)' : 'var(--input-bg)' }}>
              <input type="radio" name="staff-role" checked={role === r.id} onChange={() => setRole(r.id)} style={{ marginTop: 3 }}/>
              <span><span style={{ fontSize: 13, fontWeight: 700 }}>{r.label}</span><span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)' }}>{r.desc}</span></span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="bp full" disabled={saving}>{saving ? <><Spinner/> Sending…</> : 'Send invite'}</button>
          <button type="button" className="bg" onClick={close}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
