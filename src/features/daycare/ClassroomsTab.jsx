import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { ROOM_COLORS, errText } from './api';

// Classrooms: name, age group, capacity and the staff ratio the Today board checks.
export default function ClassroomsTab({ facilityId }) {
  const [rooms,   setRooms]   = useState([]);
  const [counts,  setCounts]  = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // room or {} for new
  const [alert,   setAlert]   = useState(null);

  const load = useCallback(async () => {
    const [{ data: rm }, { data: en }] = await Promise.all([
      supabase.from('classrooms').select('*').eq('facility_id', facilityId).order('active', { ascending: false }).order('sort').order('name'),
      supabase.from('facility_enrollments').select('classroom_id').eq('facility_id', facilityId).eq('status', 'active'),
    ]);
    setRooms(rm || []);
    setCounts((en || []).reduce((c, e) => (e.classroom_id && (c[e.classroom_id] = (c[e.classroom_id] || 0) + 1), c), {}));
    setLoading(false);
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  async function setActive(room, active) {
    setAlert(null);
    if (!active && counts[room.id]) { setAlert(`Move the ${counts[room.id]} children in ${room.name} to another room first.`); return; }
    const { error } = await supabase.from('classrooms').update({ active }).eq('id', room.id);
    if (error) setAlert(errText(error));
    load();
  }

  async function move(room, dir) {
    const list = rooms.filter(r => r.active);
    const i = list.findIndex(r => r.id === room.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const reordered = [...list];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    await Promise.all(reordered.map((r, k) => r.sort === k ? null : supabase.from('classrooms').update({ sort: k }).eq('id', r.id)));
    load();
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;

  const active   = rooms.filter(r => r.active);
  const archived = rooms.filter(r => !r.active);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600 }}>Classrooms</div>
        <button className="bp" onClick={() => setEditing({})}>+ Add classroom</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 14, lineHeight: 1.6 }}>
        The ratio is how many children one staff member may watch in that room. Use your state's licensing ratios; the Today board warns when a room needs more staff.
      </p>
      {alert && <div className="al al-e">{alert}</div>}

      {active.length === 0 && <div className="es"><div className="ic">🧸</div><h3>No classrooms yet</h3><p>Add your rooms with their age groups and ratios.</p></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {active.map((r, i) => (
          <div key={r.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: r.color || '#8B78D4', flexShrink: 0 }}/>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{r.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                {[r.age_group, `1:${r.ratio}`, r.capacity ? `${counts[r.id] || 0} of ${r.capacity} spots` : `${counts[r.id] || 0} children`].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="bg" style={smallBtn} disabled={i === 0} onClick={() => move(r, -1)} aria-label={`Move ${r.name} up`}>↑</button>
              <button className="bg" style={smallBtn} disabled={i === active.length - 1} onClick={() => move(r, 1)} aria-label={`Move ${r.name} down`}>↓</button>
              <button className="bg" style={smallBtn} onClick={() => setEditing(r)}>Edit</button>
              <button className="bg" style={smallBtn} onClick={() => setActive(r, false)}>Archive</button>
            </div>
          </div>
        ))}
      </div>

      {archived.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-faint)', marginBottom: 8 }}>Archived</div>
          {archived.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13, color: 'var(--text-dim)' }}>
              <span style={{ flex: 1 }}>{r.name}</span>
              <button className="bg" style={smallBtn} onClick={() => setActive(r, true)}>Restore</button>
            </div>
          ))}
        </div>
      )}

      <RoomModal room={editing} facilityId={facilityId} nextSort={active.length} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }}/>
    </div>
  );
}

const smallBtn = { fontSize: 11, padding: '5px 10px' };

function RoomModal({ room, facilityId, nextSort, onClose, onSaved }) {
  const [form,   setForm]   = useState({});
  const [saving, setSaving] = useState(false);
  const [alert,  setAlert]  = useState(null);

  useEffect(() => {
    if (room) setForm({ name: room.name || '', age_group: room.age_group || '', capacity: room.capacity ?? '', ratio: room.ratio ?? 4, color: room.color || ROOM_COLORS[nextSort % ROOM_COLORS.length] });
    setAlert(null);
  }, [room]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save(e) {
    e.preventDefault();
    const ratio = parseInt(form.ratio, 10);
    const capacity = form.capacity === '' ? null : parseInt(form.capacity, 10);
    if (!form.name.trim()) { setAlert('Give the room a name.'); return; }
    if (!(ratio >= 1 && ratio <= 40)) { setAlert('The ratio must be between 1 and 40 children per staff member.'); return; }
    if (capacity !== null && !(capacity >= 1 && capacity <= 200)) { setAlert('Capacity must be between 1 and 200.'); return; }
    setSaving(true); setAlert(null);
    const row = { name: form.name.trim(), age_group: form.age_group.trim() || null, capacity, ratio, color: form.color };
    const { error } = room.id
      ? await supabase.from('classrooms').update(row).eq('id', room.id)
      : await supabase.from('classrooms').insert({ ...row, facility_id: facilityId, sort: nextSort });
    setSaving(false);
    if (error) { setAlert(errText(error)); return; }
    onSaved();
  }

  return (
    <Modal open={!!room} onClose={() => !saving && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 22, fontWeight: 600, marginBottom: 14 }}>{room?.id ? 'Edit classroom' : 'Add a classroom'}</div>
      {alert && <div className="al al-e">{alert}</div>}
      <form onSubmit={save}>
        <label className="fl">Name</label>
        <input className="fi" value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="Toddlers" maxLength={60} autoFocus/>
        <label className="fl">Age group (optional)</label>
        <input className="fi" value={form.age_group || ''} onChange={e => set('age_group', e.target.value)} placeholder="1 – 2 yrs" maxLength={60}/>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="fl">Children per staff</label>
            <input className="fi" type="number" min={1} max={40} value={form.ratio ?? ''} onChange={e => set('ratio', e.target.value)}/>
          </div>
          <div>
            <label className="fl">Capacity (optional)</label>
            <input className="fi" type="number" min={1} max={200} value={form.capacity ?? ''} onChange={e => set('capacity', e.target.value)}/>
          </div>
        </div>
        <label className="fl">Color</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {ROOM_COLORS.map(c => (
            <button key={c} type="button" onClick={() => set('color', c)} aria-label={`Color ${c}`} aria-pressed={form.color === c}
              style={{ width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '3px solid var(--text)' : '3px solid transparent' }}/>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="bp full" disabled={saving}>{saving ? <Spinner/> : 'Save'}</button>
          <button type="button" className="bg" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
