import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CHILD_AVATARS } from '../../lib/constants';
import { Modal } from '../ui/Modal';
import { Confirm } from '../ui/Modal';
import Field from '../ui/Field';
import Spinner from '../ui/Spinner';
import SectionLabel from '../ui/SectionLabel';

// ─── Child Profile (view notes, allergies, medical info) ──────────────────────

export function ChildProfileModal({ open, onClose, child, sitterId, canEdit, isParent }) {
  const [tab,          setTab]          = useState('info');
  const [notes,        setNotes]        = useState([]);
  const [newNote,      setNewNote]      = useState('');
  const [visible,      setVisible]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  useEffect(() => { if (open && child) loadNotes(); }, [open, child]);

  async function loadNotes() {
    setLoadingNotes(true);
    if (isParent) {
      const { data } = await supabase.from('sitter_child_notes').select('*')
        .eq('child_id', child.id).eq('visible_to_family', true)
        .order('created_at', { ascending: false });
      setNotes(data || []);
    } else {
      const { data } = await supabase.from('sitter_child_notes').select('*')
        .eq('child_id', child.id).eq('sitter_id', sitterId)
        .order('created_at', { ascending: false });
      setNotes(data || []);
    }
    setLoadingNotes(false);
  }

  async function addNote() {
    if (!newNote.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('sitter_child_notes').insert({
      sitter_id: sitterId, child_id: child.id,
      note: newNote.trim(), visible_to_family: visible,
    });
    setSaving(false);
    if (!error) { setNewNote(''); setVisible(false); loadNotes(); }
  }

  async function toggleVisibility(note) {
    await supabase.from('sitter_child_notes')
      .update({ visible_to_family: !note.visible_to_family }).eq('id', note.id);
    loadNotes();
  }

  async function deleteNote(id) {
    await supabase.from('sitter_child_notes').delete().eq('id', id);
    loadNotes();
  }

  if (!child) return null;

  const today = new Date();
  const dob   = child.dob ? new Date(child.dob) : null;
  const age   = dob ? Math.floor((today - dob) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: `${child.color || '#8B78D4'}22`, border: `2px solid ${child.color || '#8B78D4'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
          {child.avatar || '🌟'}
        </div>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600 }}>{child.name}</div>
          {age !== null && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Age {age} · Born {dob.toLocaleDateString()}</div>}
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.07)', marginBottom: 20 }}>
        {[['info', '📋 Info'], ['notes', isParent ? '📝 Sitter Notes' : '📝 My Notes']].map(([id, label]) => (
          <div key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</div>
        ))}
      </div>

      {tab === 'info' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {child.allergies?.length > 0 && (
            <div>
              <SectionLabel>Allergies</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {child.allergies.map((a, i) => (
                  <span key={i} className="chip" style={{ background: 'rgba(192,80,80,.1)', borderColor: 'rgba(192,80,80,.2)', color: '#F5AAAA' }}>⚠️ {a}</span>
                ))}
              </div>
            </div>
          )}
          {child.dietary_restrictions && (
            <div>
              <SectionLabel>Dietary Restrictions</SectionLabel>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>{child.dietary_restrictions}</p>
            </div>
          )}
          {child.medical_notes && (
            <div>
              <SectionLabel>Medical Notes</SectionLabel>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>{child.medical_notes}</p>
            </div>
          )}
          {!child.allergies?.length && !child.dietary_restrictions && !child.medical_notes && (
            <p style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>No medical info added yet.</p>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div>
          {!isParent && (
            <div style={{ marginBottom: 16 }}>
              <Field label="Add a note" as="textarea" rows={3} value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Write a note about this child…" required={false}/>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: -8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)' }}>
                  <input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} style={{ accentColor: '#7BAAEE' }}/>
                  Visible to family
                </label>
                <button className="bp" onClick={addNote} disabled={saving || !newNote.trim()} style={{ padding: '8px 16px', fontSize: 12 }}>
                  {saving ? <Spinner/> : 'Add note'}
                </button>
              </div>
            </div>
          )}
          {loadingNotes
            ? <div style={{ textAlign: 'center', padding: 20 }}><Spinner size={20}/></div>
            : notes.length === 0
              ? <p style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                  {isParent ? 'No notes shared with your family yet.' : 'No notes yet.'}
                </p>
              : notes.map(n => (
                <div key={n.id} className="note-card">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, flex: 1 }}>{n.note}</p>
                    {!isParent && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button title={n.visible_to_family ? 'Hide from family' : 'Share with family'} onClick={() => toggleVisibility(n)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: n.visible_to_family ? 1 : .4 }}>👁️</button>
                        <button onClick={() => deleteNote(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: .4 }}>🗑️</button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{new Date(n.created_at).toLocaleString()}</span>
                    {n.visible_to_family && <span style={{ fontSize: 10, color: '#88D8B8' }}>👁️ Shared with family</span>}
                  </div>
                </div>
              ))
          }
        </div>
      )}

      <button className="bg" onClick={onClose} style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}>Close</button>
    </Modal>
  );
}

// ─── Add / Edit Child ─────────────────────────────────────────────────────────

const COLORS = ['#8B78D4','#3A9E7A','#3A6FD4','#D4783A','#D43A6F','#7AC4D4','#D4C23A','#8BD48B'];

export function ChildModal({ open, onClose, familyId, child, onSaved }) {
  const isEdit = !!child;

  const [name,      setName]      = useState(child?.name || '');
  const [dob,       setDob]       = useState(child?.dob || '');
  const [avatar,    setAvatar]    = useState(child?.avatar || '🌟');
  const [color,     setColor]     = useState(child?.color || '#8B78D4');
  const [allergies, setAllergies] = useState(child?.allergies?.join(', ') || '');
  const [diet,      setDiet]      = useState(child?.dietary_restrictions || '');
  const [medical,   setMedical]   = useState(child?.medical_notes || '');
  const [loading,   setLoading]   = useState(false);
  const [alert,     setAlert]     = useState(null);
  const [confirmDel,setConfirmDel]= useState(false);

  useEffect(() => {
    if (open) {
      setName(child?.name || '');
      setDob(child?.dob || '');
      setAvatar(child?.avatar || '🌟');
      setColor(child?.color || '#8B78D4');
      setAllergies(child?.allergies?.join(', ') || '');
      setDiet(child?.dietary_restrictions || '');
      setMedical(child?.medical_notes || '');
      setAlert(null);
    }
  }, [open, child]);

  async function save(e) {
    e.preventDefault();
    setAlert(null);
    setLoading(true);
    const payload = {
      name, dob: dob || null, avatar, color,
      allergies: allergies.split(',').map(s => s.trim()).filter(Boolean),
      dietary_restrictions: diet || null,
      medical_notes: medical || null,
      family_id: familyId,
    };
    const { error } = isEdit
      ? await supabase.from('children').update(payload).eq('id', child.id)
      : await supabase.from('children').insert(payload);
    setLoading(false);
    if (error) { setAlert({ t: 'e', m: error.message }); return; }
    onSaved();
    onClose();
  }

  async function deleteChild() {
    setLoading(true);
    await supabase.from('children').delete().eq('id', child.id);
    setLoading(false);
    onSaved();
    onClose();
    setConfirmDel(false);
  }

  return (
    <>
      <Modal open={open && !confirmDel} onClose={onClose}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 20 }}>
          {isEdit ? 'Edit Child' : 'Add Child'}
        </div>
        {alert && <div className={`al al-${alert.t}`}>{alert.m}</div>}
        <form onSubmit={save}>
          <Field label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Child's name"/>
          <Field label="Date of birth (optional)" type="date" value={dob} onChange={e => setDob(e.target.value)} required={false}/>

          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Avatar</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CHILD_AVATARS.map(a => (
                <button key={a} type="button" onClick={() => setAvatar(a)}
                  style={{ width: 36, height: 36, borderRadius: 10, border: `2px solid ${avatar === a ? '#7BAAEE' : 'rgba(255,255,255,.1)'}`, background: avatar === a ? 'rgba(111,163,232,.15)' : 'rgba(255,255,255,.04)', cursor: 'pointer', fontSize: 20 }}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Color</SectionLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${color === c ? '#fff' : 'transparent'}`, cursor: 'pointer' }}/>
              ))}
            </div>
          </div>

          <Field label="Allergies (comma separated)" value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="e.g. peanuts, dairy" required={false}/>
          <Field label="Dietary restrictions" as="textarea" rows={2} value={diet} onChange={e => setDiet(e.target.value)} placeholder="e.g. vegetarian, no gluten" required={false}/>
          <Field label="Medical notes" as="textarea" rows={3} value={medical} onChange={e => setMedical(e.target.value)} placeholder="Medications, conditions, important notes…" required={false}/>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="submit" className="bp full" disabled={loading}>{loading ? <Spinner/> : isEdit ? 'Save Changes' : 'Add Child'}</button>
            {isEdit && <button type="button" className="bd" onClick={() => setConfirmDel(true)}>Remove</button>}
            <button type="button" className="bg" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </Modal>

      <Confirm
        open={confirmDel}
        title="Remove child?"
        message={`This will permanently remove ${child?.name} and all their data.`}
        danger
        onConfirm={deleteChild}
        onCancel={() => setConfirmDel(false)}
      />
    </>
  );
}
