import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal, Confirm } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import SectionLabel from '../../components/ui/SectionLabel';
import ChildInfoModal from './ChildInfoModal';
import { ageText, errText, sendFacilityInvite } from './api';

// Enrolled families, their children and classroom placement.
export default function DaycareFamilies({ facilityId, manager }) {
  const [loading,  setLoading]  = useState(true);
  const [links,    setLinks]    = useState([]);   // facility_families + families
  const [kids,     setKids]     = useState({});   // family_id -> children
  const [enrolled, setEnrolled] = useState({});   // child_id -> enrollment
  const [members,  setMembers]  = useState({});   // family_id -> members
  const [rooms,    setRooms]    = useState([]);
  const [search,   setSearch]   = useState('');
  const [alert,    setAlert]    = useState(null);
  const [showEnroll, setShowEnroll] = useState(false);
  const [addChildTo, setAddChildTo] = useState(null);
  const [removing,   setRemoving]   = useState(null);
  const [info,       setInfo]       = useState(null);
  const [sending,    setSending]    = useState({});

  const load = useCallback(async () => {
    const [{ data: ff }, { data: rm }, { data: en }] = await Promise.all([
      supabase.from('facility_families').select('family_id, status, created_family, created_at, families(id, name, admin_email, status, icon)')
        .eq('facility_id', facilityId).neq('status', 'inactive').order('created_at', { ascending: false }),
      supabase.from('classrooms').select('id, name, color, active').eq('facility_id', facilityId).order('sort').order('name'),
      supabase.from('facility_enrollments').select('*').eq('facility_id', facilityId),
    ]);
    const famIds = (ff || []).map(l => l.family_id);
    const [{ data: ch }, { data: mem }] = famIds.length ? await Promise.all([
      supabase.from('children').select('id, family_id, name, preferred_name, avatar, color, dob, allergies').in('family_id', famIds).order('name'),
      supabase.from('members').select('id, family_id, name, email, role, status').in('family_id', famIds).neq('status', 'removed'),
    ]) : [{ data: [] }, { data: [] }];
    const group = (rows, key) => (rows || []).reduce((g, r) => ((g[r[key]] ||= []).push(r), g), {});
    setLinks(ff || []);
    setRooms(rm || []);
    setEnrolled(Object.fromEntries((en || []).map(e => [e.child_id, e])));
    setKids(group(ch, 'family_id'));
    setMembers(group(mem, 'family_id'));
    setLoading(false);
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  async function placeChild(child, classroomId) {
    setAlert(null);
    const row = classroomId === ''
      ? { facility_id: facilityId, child_id: child.id, classroom_id: null, status: 'withdrawn' }
      : { facility_id: facilityId, child_id: child.id, classroom_id: classroomId === 'none' ? null : classroomId, status: 'active',
          ...(enrolled[child.id]?.status === 'active' ? {} : { start_date: localDate() }) };
    const { data, error } = await supabase.from('facility_enrollments').upsert(row, { onConflict: 'facility_id,child_id' }).select().single();
    if (error) { setAlert(errText(error)); return; }
    setEnrolled(e => ({ ...e, [child.id]: data }));
  }

  async function resend(link) {
    setSending(s => ({ ...s, [link.family_id]: true })); setAlert(null);
    const r = await sendFacilityInvite({ kind: 'family', facilityId, familyId: link.family_id });
    setSending(s => ({ ...s, [link.family_id]: false }));
    setAlert(r.ok ? { ok: true, m: `Sent to ${link.families?.admin_email}.` } : r.error);
  }

  async function unenroll() {
    const link = removing;
    setRemoving(null);
    const { error } = await supabase.rpc('unenroll_family', { p_facility_id: facilityId, p_family_id: link.family_id });
    if (error) setAlert(errText(error));
    load();
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;

  const activeRooms = rooms.filter(r => r.active);
  const q = search.trim().toLowerCase();
  const shown = links.filter(l => !q
    || (l.families?.name || '').toLowerCase().includes(q)
    || (l.families?.admin_email || '').toLowerCase().includes(q)
    || (kids[l.family_id] || []).some(c => c.name.toLowerCase().includes(q)));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600 }}>Families <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>{links.length}</span></div>
        {manager && <button className="bp" onClick={() => setShowEnroll(true)}>+ Enroll a family</button>}
      </div>

      {alert && <div className={`al ${alert.ok ? 'al-s' : 'al-e'}`}>{alert.ok ? alert.m : alert}</div>}

      {links.length > 5 && (
        <input className="fi" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search families or children…"/>
      )}

      {links.length === 0 ? (
        <div className="es"><div className="ic">👨‍👩‍👧</div><h3>No families yet</h3>
          <p>{manager ? 'Enroll a family with the parent\'s email. Their children go straight onto your classroom board.' : 'Your director hasn\'t enrolled any families yet.'}</p>
          {manager && <button className="bp" onClick={() => setShowEnroll(true)}>+ Enroll a family</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map(link => {
            const fam      = link.families;
            const children = kids[link.family_id] || [];
            const people   = members[link.family_id] || [];
            const waiting  = link.status === 'pending';
            const hidden   = waiting && !link.created_family;   // parent must accept before we see the children
            return (
              <div key={link.family_id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 26 }}>{fam?.icon || '👨‍👩‍👧'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{fam?.name || 'Family'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-faint)', wordBreak: 'break-all' }}>
                        {people.filter(p => p.role === 'admin' || p.role === 'member').map(p => p.name).join(', ') || fam?.admin_email}
                        {people.length > 0 && fam?.admin_email ? ` · ${fam.admin_email}` : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {waiting
                      ? <span className="sb sb-p">{link.created_family ? 'Parent hasn\'t signed up' : 'Waiting for parent to accept'}</span>
                      : <span className="sb sb-a">Active</span>}
                    {manager && waiting && (
                      <button className="bg" style={{ fontSize: 11, padding: '4px 10px' }} disabled={sending[link.family_id]} onClick={() => resend(link)}>
                        {sending[link.family_id] ? <Spinner size={10}/> : 'Resend email'}
                      </button>
                    )}
                  </div>
                </div>

                {hidden ? (
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>This family already uses littleloop. You'll see their children once they accept on their Home screen.</div>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    {children.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>No children added.</div>}
                    {children.map(c => {
                      const e = enrolled[c.id];
                      const value = e?.status === 'active' ? (e.classroom_id || 'none') : '';
                      const allergies = (c.allergies || []).filter(Boolean);
                      return (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                          <button onClick={() => setInfo(c)} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', color: 'var(--text)' }}>
                            <span style={{ fontSize: 20 }}>{c.avatar || '🌟'}</span>
                            <span>
                              <span style={{ fontSize: 13, fontWeight: 700 }}>{c.preferred_name || c.name}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{c.dob ? ` · ${ageText(c.dob)}` : ''}</span>
                              {allergies.length > 0 && <span style={{ fontSize: 11, color: 'var(--err-text)', fontWeight: 700 }}> · ⚠️ {allergies.join(', ')}</span>}
                            </span>
                          </button>
                          {manager ? (
                            <select className="fi" value={value} onChange={ev => placeChild(c, ev.target.value)} aria-label={`Classroom for ${c.name}`}
                              style={{ width: 'auto', minWidth: 150, marginBottom: 0, padding: '6px 10px', fontSize: 12 }}>
                              <option value="">Not enrolled</option>
                              <option value="none">Enrolled, no classroom</option>
                              {activeRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                              {e?.classroom_id && !activeRooms.some(r => r.id === e.classroom_id) && <option value={e.classroom_id}>(archived room)</option>}
                            </select>
                          ) : (
                            <span className="chip" style={{ fontSize: 11 }}>
                              {e?.status !== 'active' ? 'Not enrolled' : rooms.find(r => r.id === e.classroom_id)?.name || 'No classroom'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {manager && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <button className="bg" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setAddChildTo(link)}>+ Add a child</button>
                        <button className="bg" style={{ fontSize: 11, padding: '5px 10px', marginLeft: 'auto' }} onClick={() => setRemoving(link)}>Remove from daycare</button>
                      </div>
                    )}
                  </div>
                )}
                {manager && hidden && (
                  <div style={{ marginTop: 10, textAlign: 'right' }}>
                    <button className="bg" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setRemoving(link)}>Cancel request</button>
                  </div>
                )}
              </div>
            );
          })}
          {shown.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)', textAlign: 'center', padding: 20 }}>No families match "{search}".</div>}
        </div>
      )}

      <EnrollFamilyModal open={showEnroll} onClose={() => setShowEnroll(false)} facilityId={facilityId} rooms={activeRooms} onDone={load}/>
      <AddChildModal link={addChildTo} onClose={() => setAddChildTo(null)} facilityId={facilityId} rooms={activeRooms} onDone={load}/>
      <ChildInfoModal child={info} onClose={() => setInfo(null)}/>
      <Confirm open={!!removing} danger
        title={removing?.status === 'pending' && !removing?.created_family ? 'Cancel this request?' : `Remove ${removing?.families?.name || 'this family'}?`}
        message="Their children leave your classroom board and your staff lose access to the family's information. Past check-ins and updates are kept."
        onConfirm={unenroll} onCancel={() => setRemoving(null)}/>
    </div>
  );
}

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const blankChild = () => ({ name: '', dob: '', classroom_id: '' });

function EnrollFamilyModal({ open, onClose, facilityId, rooms, onDone }) {
  const [family,   setFamily]   = useState('');
  const [parent,   setParent]   = useState('');
  const [email,    setEmail]    = useState('');
  const [children, setChildren] = useState([blankChild()]);
  const [saving,   setSaving]   = useState(false);
  const [alert,    setAlert]    = useState(null);
  const [done,     setDone]     = useState(null);

  function reset() { setFamily(''); setParent(''); setEmail(''); setChildren([blankChild()]); setAlert(null); setDone(null); setSaving(false); }
  function close() { if (saving) return; const wasDone = !!done; reset(); onClose(); if (wasDone) onDone(); }
  const setChild = (i, patch) => setChildren(cs => cs.map((c, j) => j === i ? { ...c, ...patch } : c));

  async function submit(e) {
    e.preventDefault();
    setAlert(null);
    if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email.trim())) { setAlert('Enter the parent\'s email.'); return; }
    if (!family.trim()) { setAlert('Enter a family name.'); return; }
    setSaving(true);
    const { data, error } = await supabase.rpc('enroll_family', {
      p_facility_id: facilityId, p_family_name: family.trim(), p_admin_email: email.trim(), p_parent_name: parent.trim() || null,
      p_children: children.filter(c => c.name.trim()).map(c => ({ name: c.name.trim(), dob: c.dob || null, classroom_id: c.classroom_id || null })),
    });
    if (error) { setAlert(errText(error)); setSaving(false); return; }
    if (data?.already) {
      setDone({ already: true, status: data.status });
      setSaving(false);
      return;
    }
    const mail = await sendFacilityInvite({ kind: 'family', facilityId, familyId: data.family_id });
    setDone({ existing: data.existing, mailed: mail.ok, mailError: mail.error });
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={close}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Enroll a family</div>
      {done ? (
        <div>
          <div className={`al ${done.mailed === false ? 'al-w' : 'al-s'}`} style={{ marginTop: 12 }}>
            {done.already ? (done.status === 'active' ? 'This family is already enrolled.' : 'You already asked this family to connect. They haven\'t answered yet.')
              : done.existing ? <>{email} already uses littleloop, so they'll accept your daycare on their Home screen. Then you can place their children in classrooms.</>
              : <>{family} is enrolled and their children are on your board. We emailed {email} a link to create their parent account.</>}
            {done.mailed === false && <> The email didn't send ({done.mailError}). Use "Resend email" on their card.</>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="bp" onClick={() => { reset(); onDone(); }}>Enroll another</button>
            <button className="bg" onClick={close}>Done</button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16, lineHeight: 1.6 }}>
            If the parent already uses littleloop, they'll be asked to accept and their own children appear after that.
          </p>
          {alert && <div className="al al-e">{alert}</div>}
          <label className="fl">Family name</label>
          <input className="fi" value={family} onChange={e => setFamily(e.target.value)} placeholder="The Lee Family" maxLength={80}/>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <div>
              <label className="fl">Parent's name</label>
              <input className="fi" value={parent} onChange={e => setParent(e.target.value)} placeholder="Jordan Lee" maxLength={80} autoComplete="off"/>
            </div>
            <div>
              <label className="fl">Parent's email</label>
              <input className="fi" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="parent@example.com" autoComplete="off"/>
            </div>
          </div>

          <SectionLabel>Children</SectionLabel>
          {children.map((c, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid var(--border)', marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                <input className="fi" style={{ marginBottom: 0 }} value={c.name} onChange={e => setChild(i, { name: e.target.value })} placeholder="Child's name" maxLength={60} aria-label="Child's name"/>
                <input className="fi" style={{ marginBottom: 0 }} type="date" value={c.dob} onChange={e => setChild(i, { dob: e.target.value })} aria-label="Birthday"/>
                <select className="fi" style={{ marginBottom: 0 }} value={c.classroom_id} onChange={e => setChild(i, { classroom_id: e.target.value })} aria-label="Classroom">
                  <option value="">No classroom yet</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              {children.length > 1 && (
                <button type="button" onClick={() => setChildren(cs => cs.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 11, cursor: 'pointer', marginTop: 6, padding: 0 }}>Remove</button>
              )}
            </div>
          ))}
          <button type="button" className="bg" style={{ fontSize: 12, padding: '5px 12px', marginBottom: 18 }} onClick={() => setChildren(cs => [...cs, blankChild()])}>+ Another child</button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="bp full" disabled={saving}>{saving ? <><Spinner/> Enrolling…</> : 'Enroll and email the parent'}</button>
            <button type="button" className="bg" onClick={close}>Cancel</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function AddChildModal({ link, onClose, facilityId, rooms, onDone }) {
  const [name,   setName]   = useState('');
  const [dob,    setDob]    = useState('');
  const [room,   setRoom]   = useState('');
  const [saving, setSaving] = useState(false);
  const [alert,  setAlert]  = useState(null);

  useEffect(() => { setName(''); setDob(''); setRoom(''); setAlert(null); }, [link?.family_id]);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) { setAlert('Enter the child\'s name.'); return; }
    setSaving(true); setAlert(null);
    const { data: child, error } = await supabase.from('children')
      .insert({ family_id: link.family_id, name: name.trim(), dob: dob || null }).select('id').single();
    if (error) { setAlert(errText(error)); setSaving(false); return; }
    const { error: enErr } = await supabase.from('facility_enrollments')
      .insert({ facility_id: facilityId, child_id: child.id, classroom_id: room || null, start_date: localDate() });
    setSaving(false);
    if (enErr) { setAlert(errText(enErr)); return; }
    onDone(); onClose();
  }

  return (
    <Modal open={!!link} onClose={() => !saving && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 22, fontWeight: 600, marginBottom: 14 }}>Add a child to {link?.families?.name || 'this family'}</div>
      {alert && <div className="al al-e">{alert}</div>}
      <form onSubmit={submit}>
        <label className="fl">Name</label>
        <input className="fi" value={name} onChange={e => setName(e.target.value)} maxLength={60} autoFocus/>
        <label className="fl">Birthday</label>
        <input className="fi" type="date" value={dob} onChange={e => setDob(e.target.value)}/>
        <label className="fl">Classroom</label>
        <select className="fi" value={room} onChange={e => setRoom(e.target.value)}>
          <option value="">No classroom yet</option>
          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="bp full" disabled={saving}>{saving ? <Spinner/> : 'Add child'}</button>
          <button type="button" className="bg" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
