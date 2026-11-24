import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';
import StateChip from './StateChip';
import DocUploadModal from './DocUploadModal';
import { sendFacilityInvite, errText } from './api';
import { loadEnrollment, loadContactCounts, formState, typesForChild, docState, fmtStamp, localDate, openDocument } from './enrollment';

// Records: every enrolled child's packet: forms, documents (missing / expiring / expired),
// health details and contacts. Directors and office upload paper copies and nudge families.
export default function RecordsTab({ facilityId }) {
  const [loading, setLoading] = useState(true);
  const [rows,    setRows]    = useState([]);     // per child
  const [rooms,   setRooms]   = useState([]);
  const [enr,     setEnr]     = useState(null);
  const [room,    setRoom]    = useState('all');
  const [onlyIssues, setOnlyIssues] = useState(true);
  const [search,  setSearch]  = useState('');
  const [open,    setOpen]    = useState(null);   // child id expanded
  const [uploading, setUploading] = useState(null);
  const [msg,     setMsg]     = useState(null);
  const [sending, setSending] = useState({});

  const load = useCallback(async () => {
    const [{ data: links }, { data: en }, { data: rm }, enrollment] = await Promise.all([
      supabase.from('facility_families').select('family_id, status, created_family, families(id, name, admin_email)').eq('facility_id', facilityId).neq('status', 'inactive'),
      supabase.from('facility_enrollments').select('child_id, classroom_id').eq('facility_id', facilityId).eq('status', 'active'),
      supabase.from('classrooms').select('id, name, color').eq('facility_id', facilityId).eq('active', true).order('sort').order('name'),
      loadEnrollment(facilityId),
    ]);
    const ids = (en || []).map(e => e.child_id);
    const roomOf = Object.fromEntries((en || []).map(e => [e.child_id, e.classroom_id]));
    const famIds = (links || []).map(l => l.family_id);
    const [{ data: kids }, contacts] = await Promise.all([
      ids.length ? supabase.from('children').select('id, family_id, name, preferred_name, avatar, allergies, allergy_severe, health_confirmed_at').in('id', ids).order('name') : { data: [] },
      loadContactCounts(famIds),
    ]);
    const linkOf = Object.fromEntries((links || []).map(l => [l.family_id, l]));
    const today = localDate();
    setRows((kids || []).filter(k => linkOf[k.family_id]).map(k => {
      const link = linkOf[k.family_id];
      const forms = enrollment.forms.map(f => ({ form: f, ...formState(f, enrollment.latestResp[`${k.family_id}:${f.id}`]) }));
      const docs  = typesForChild(enrollment.docTypes, k).map(t => ({ type: t, ...docState(t, enrollment.latestDoc[`${k.id}:${t.id}`], today) }));
      const c = contacts[k.family_id] || { emergency: 0, pickup: 0 };
      const issues = {
        forms:    forms.filter(f => f.form.required && f.state !== 'done').length,
        missing:  docs.filter(d => d.state === 'missing').length,
        expiring: docs.filter(d => d.state === 'expiring').length,
        expired:  docs.filter(d => d.state === 'expired').length,
        health:   k.health_confirmed_at ? 0 : 1,
        contacts: c.emergency && c.pickup ? 0 : 1,
      };
      return { child: k, link, classroom_id: roomOf[k.id], forms, docs, contacts: c, issues,
               needs: issues.forms + issues.missing + issues.expired + issues.health + issues.contacts };
    }));
    setRooms(rm || []);
    setEnr(enrollment);
    setLoading(false);
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  async function remind(row) {
    setSending(s => ({ ...s, [row.link.family_id]: true })); setMsg(null);
    const r = await sendFacilityInvite({ kind: 'reminder', facilityId, familyId: row.link.family_id });
    setSending(s => ({ ...s, [row.link.family_id]: false }));
    setMsg(r.ok ? { ok: `Reminder sent to ${row.link.families?.admin_email}.` } : r.error);
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;

  const roomName = id => rooms.find(r => r.id === id)?.name || 'No classroom';
  const q = search.trim().toLowerCase();
  const shown = rows.filter(r => (room === 'all' || r.classroom_id === room)
    && (!onlyIssues || r.needs > 0 || r.issues.expiring > 0)
    && (!q || `${r.child.name} ${r.child.preferred_name || ''} ${r.link.families?.name || ''}`.toLowerCase().includes(q)));
  const sum = k => rows.reduce((s, r) => s + r.issues[k], 0);
  const complete = rows.filter(r => r.needs === 0).length;
  const familiesUnsigned = new Set(rows.filter(r => r.issues.forms > 0).map(r => r.link.family_id)).size;

  return (
    <div>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Records</div>
      {msg && <div className={`al ${msg.ok ? 'al-s' : 'al-e'}`}>{msg.ok || msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
        <Tile label="Complete" value={`${complete}/${rows.length}`} sub="children" tone={complete === rows.length ? 'ok' : null}/>
        <Tile label="Missing documents" value={sum('missing')} tone={sum('missing') ? 'warn' : 'ok'}/>
        <Tile label="Expired" value={sum('expired')} tone={sum('expired') ? 'bad' : 'ok'}/>
        <Tile label="Expiring in 30 days" value={sum('expiring')} tone={sum('expiring') ? 'warn' : 'ok'}/>
        <Tile label="Families with unsigned forms" value={familiesUnsigned} tone={familiesUnsigned ? 'warn' : 'ok'}/>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select className="fi" value={room} onChange={e => setRoom(e.target.value)} style={{ width: 'auto', marginBottom: 0, padding: '7px 10px', fontSize: 12 }} aria-label="Classroom">
          <option value="all">All rooms</option>
          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input className="fi" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search child or family" style={{ flex: 1, minWidth: 160, marginBottom: 0, padding: '7px 12px', fontSize: 12 }}/>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)}/> Needs attention only
        </label>
      </div>

      {rows.length === 0 && <div className="es"><div className="ic">📋</div><h3>No children enrolled</h3><p>Enroll families to track their records here.</p></div>}
      {rows.length > 0 && shown.length === 0 && <div className="al al-s">{onlyIssues ? 'Everything is up to date for these children.' : 'No children match.'}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.map(r => {
          const c = r.child;
          const isOpen = open === c.id;
          const waiting = r.link.status === 'pending';
          return (
            <div key={c.id} className="card" style={{ padding: '12px 14px' }}>
              <button onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', color: 'var(--text)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 22 }}>{c.avatar || '🌟'}</span>
                <span style={{ flex: 1, minWidth: 140 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{c.preferred_name || c.name}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)' }}>{roomName(r.classroom_id)} · {r.link.families?.name}</span>
                </span>
                <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {r.needs === 0 && r.issues.expiring === 0 && <StateChip state="done" label="Complete"/>}
                  {r.issues.expired > 0  && <StateChip state="expired" label={`${r.issues.expired} expired`}/>}
                  {r.issues.missing > 0  && <StateChip state="missing" label={`${r.issues.missing} doc${r.issues.missing === 1 ? '' : 's'} missing`}/>}
                  {r.issues.expiring > 0 && <StateChip state="expiring" label={`${r.issues.expiring} expiring`}/>}
                  {r.issues.forms > 0    && <StateChip state="todo" label={`${r.issues.forms} form${r.issues.forms === 1 ? '' : 's'} unsigned`}/>}
                  {r.issues.health > 0   && <StateChip state="todo" label="Health not confirmed"/>}
                  {r.issues.contacts > 0 && <StateChip state="todo" label="Contacts needed"/>}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  {waiting && <div className="al al-i" style={{ marginBottom: 10 }}>The parent hasn't created their littleloop account yet, so they can't sign forms. Resend their invite from Families.</div>}
                  <Group label="Forms (whole family)">
                    {r.forms.map(f => (
                      <Line key={f.form.id} title={f.form.title} sub={f.resp ? `${f.resp.signed_name} · ${fmtStamp(f.resp.signed_at)}` : null}
                        right={<StateChip state={f.state} label={f.label}/>}/>
                    ))}
                  </Group>
                  <Group label="Documents">
                    {r.docs.map(d => (
                      <Line key={d.type.id} title={d.type.name} sub={d.doc ? `${d.doc.uploaded_by_role === 'staff' ? 'Uploaded by staff' : 'Uploaded by family'} · ${fmtStamp(d.doc.created_at)}` : null}
                        right={<span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <StateChip state={d.state} label={d.label}/>
                          {d.doc && <button className="bg" style={smallBtn} onClick={async () => setMsg(await openDocument(d.doc.file_path))}>View</button>}
                          <button className="bg" style={smallBtn} onClick={() => setUploading({ child: c, type: d.type })}>Upload</button>
                        </span>}/>
                    ))}
                    {(enr?.otherDocs || []).filter(d => d.child_id === c.id).map(d => (
                      <Line key={d.id} title={d.label || d.file_name || 'Document'} sub={fmtStamp(d.created_at)}
                        right={<button className="bg" style={smallBtn} onClick={async () => setMsg(await openDocument(d.file_path))}>View</button>}/>
                    ))}
                    <button onClick={() => setUploading({ child: c, type: null })}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}>+ Other document</button>
                  </Group>
                  <Group label="Health & contacts">
                    <Line title="Health & diet details" right={<StateChip state={c.health_confirmed_at ? 'done' : 'todo'} label={c.health_confirmed_at ? `Confirmed ${fmtStamp(c.health_confirmed_at)}` : 'Not confirmed'}/>}/>
                    <Line title={`${r.contacts.emergency} emergency · ${r.contacts.pickup} pickup`} right={<StateChip state={r.issues.contacts ? 'todo' : 'done'} label={r.issues.contacts ? 'Needed' : 'Done'}/>}/>
                  </Group>
                  {r.needs > 0 && !waiting && (
                    <button className="bg" style={{ fontSize: 12, padding: '6px 12px', marginTop: 4 }} disabled={sending[r.link.family_id]} onClick={() => remind(r)}>
                      {sending[r.link.family_id] ? <Spinner size={10}/> : '✉️ Email the family a reminder'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <DocUploadModal target={uploading} facilityId={facilityId} role="staff" onClose={() => setUploading(null)} onDone={load}/>
    </div>
  );
}

const smallBtn = { fontSize: 11, padding: '4px 10px' };

function Tile({ label, value, sub, tone }) {
  const color = tone === 'bad' ? 'var(--err-text)' : tone === 'warn' ? 'var(--warn-text,#B7791F)' : tone === 'ok' ? 'var(--ok-text)' : 'var(--text)';
  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</div>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 22, fontWeight: 600, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{sub}</div>}
    </div>
  );
}

function Group({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function Line({ title, sub, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}
