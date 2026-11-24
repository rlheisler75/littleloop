import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { INCIDENT_KINDS, incidentKind, TOLD_HOW, toldHowLabel, STATUS, when, printIncident } from './incidents';
import { timeInput, stamp, notifyParents } from './care';
import { localDate } from './enrollment';
import { errText } from './api';

const FILTERS = [
  { id: 'open',   label: 'Open' },
  { id: 'review', label: 'Needs review' },
  { id: 'sent',   label: 'Waiting for signature' },
  { id: 'signed', label: 'Signed' },
  { id: 'all',    label: 'All' },
];

// Incidents: teachers write a report; the director or office reviews it and sends it to the
// family, who signs it in the app. Sent reports are never changed or deleted, only corrected.
export default function IncidentsTab({ facility, facilityId, manager, userId }) {
  const [loading, setLoading] = useState(true);
  const [rows,    setRows]    = useState([]);
  const [kids,    setKids]    = useState([]);
  const [filter,  setFilter]  = useState('open');
  const [form,    setForm]    = useState(null);    // null | {} (new) | report (edit)
  const [openId,  setOpenId]  = useState(null);

  const load = useCallback(async () => {
    const [{ data: reps }, { data: en }] = await Promise.all([
      supabase.from('incident_reports').select('*').eq('facility_id', facilityId).order('occurred_at', { ascending: false }).limit(300),
      supabase.from('facility_enrollments').select('child_id, classroom_id').eq('facility_id', facilityId).eq('status', 'active'),
    ]);
    const ids = [...new Set([...(en || []).map(e => e.child_id), ...(reps || []).map(r => r.child_id)])];
    const { data: ch } = ids.length
      ? await supabase.from('children').select('id, name, preferred_name, avatar').in('id', ids).order('name')
      : { data: [] };
    const roomOf = Object.fromEntries((en || []).map(e => [e.child_id, e.classroom_id]));
    setRows(reps || []);
    setKids((ch || []).map(c => ({ ...c, enrolled: c.id in roomOf, classroom_id: roomOf[c.id] || null })));
    setLoading(false);
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;

  const kid = id => kids.find(k => k.id === id);
  const shown = rows.filter(r => filter === 'all' || (filter === 'open' ? r.status !== 'signed' : r.status === filter));
  const count = s => rows.filter(r => r.status === s).length;
  const openReport = rows.find(r => r.id === openId) || null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600 }}>Incident reports</div>
        <button className="bp" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => setForm({})} disabled={!kids.some(k => k.enrolled)}>+ New report</button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {FILTERS.map(f => {
          const n = f.id === 'open' ? count('review') + count('sent') : f.id === 'all' ? rows.length : count(f.id);
          return (
            <button key={f.id} className="chip" onClick={() => setFilter(f.id)}
              style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, background: filter === f.id ? 'var(--accent)' : undefined, color: filter === f.id ? '#fff' : undefined }}>
              {f.label} {n > 0 && `· ${n}`}
            </button>
          );
        })}
      </div>

      {manager && count('review') > 0 && filter !== 'review' && (
        <div className="al al-w">{count('review')} report{count('review') === 1 ? '' : 's'} waiting for you to review and send to the family.</div>
      )}

      {rows.length === 0 && (
        <div className="es"><div className="ic">🩹</div><h3>No incident reports</h3>
          <p>When a child is hurt, gets sick or there's a behavior incident, write it up here. {manager ? 'You' : 'Your director or office'} will review it and send it to the family to sign.</p></div>
      )}
      {rows.length > 0 && shown.length === 0 && <div className="al al-s">Nothing here.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.map(r => {
          const c = kid(r.child_id);
          const k = incidentKind(r.kind);
          return (
            <button key={r.id} className="card" onClick={() => setOpenId(r.id)}
              style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', color: 'var(--text)', width: '100%' }}>
              <span style={{ fontSize: 22 }}>{k.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{c ? (c.preferred_name || c.name) : 'Child'} · {k.label}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {when(r.occurred_at)}{r.location ? ` · ${r.location}` : ''} · by {r.reported_by_name || 'staff'}
                </span>
              </span>
              <StatusPill status={r.status}/>
            </button>
          );
        })}
      </div>

      {form && <IncidentForm facilityId={facilityId} kids={kids.filter(k => k.enrolled)} report={form.id ? form : null}
        onClose={() => setForm(null)} onSaved={id => { setForm(null); load(); if (id) setOpenId(id); }}/>}
      {openReport && <IncidentDetail report={openReport} child={kid(openReport.child_id)} facilityName={facility?.name} manager={manager} userId={userId}
        onEdit={() => { setOpenId(null); setForm(openReport); }} onClose={() => setOpenId(null)} onChanged={load}/>}
    </div>
  );
}

export function StatusPill({ status }) {
  const st = STATUS[status] || STATUS.review;
  const c = { warn: ['rgba(224,160,60,.15)', 'var(--warn-text)', 'rgba(224,160,60,.35)'],
              info: ['color-mix(in srgb,var(--accent) 12%,transparent)', 'var(--accent)', 'color-mix(in srgb,var(--accent) 35%,transparent)'],
              ok:   ['rgba(58,158,122,.14)', 'var(--ok-text)', 'rgba(58,158,122,.3)'] }[st.tone];
  return <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: c[0], color: c[1], border: `1px solid ${c[2]}` }}>{st.label}</span>;
}

function IncidentForm({ facilityId, kids, report, onClose, onSaved }) {
  const occurred = report ? new Date(report.occurred_at) : new Date();
  const told = report?.parent_told_at ? new Date(report.parent_told_at) : null;
  const [f, setF] = useState(() => ({
    child_id: report?.child_id || '', kind: report?.kind || 'injury',
    day: localDate(occurred), time: timeInput(occurred),
    location: report?.location || '', description: report?.description || '', first_aid: report?.first_aid || '', witness: report?.witness || '',
    told: !!told, told_day: localDate(told || new Date()), told_time: timeInput(told || new Date()), told_how: report?.parent_told_how || 'phone',
  }));
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  async function save(e) {
    e.preventDefault();
    if (!f.child_id) { setError('Choose the child.'); return; }
    if (!f.description.trim()) { setError('Describe what happened.'); return; }
    const occurred_at = stamp(f.day, f.time);
    if (new Date(occurred_at) > new Date(Date.now() + 5 * 60000)) { setError('The time is in the future.'); return; }
    const kid = kids.find(k => k.id === f.child_id);
    const row = {
      kind: f.kind, occurred_at, location: f.location.trim() || null, description: f.description.trim(),
      first_aid: f.first_aid.trim() || null, witness: f.witness.trim() || null,
      parent_told_at: f.told ? stamp(f.told_day, f.told_time) : null, parent_told_how: f.told ? f.told_how : null,
    };
    setSaving(true); setError(null);
    const { data, error: err } = report
      ? await supabase.from('incident_reports').update(row).eq('id', report.id).select('id').single()
      : await supabase.from('incident_reports').insert({ ...row, facility_id: facilityId, child_id: f.child_id, classroom_id: kid?.classroom_id || null }).select('id').single();
    setSaving(false);
    if (err) { setError(errText(err)); return; }
    onSaved(data?.id);
  }

  return (
    <Modal open onClose={() => !saving && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 2 }}>{report ? 'Edit incident report' : 'New incident report'}</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>Your director or office reviews it before the family sees it.</div>
      {error && <div className="al al-e">{error}</div>}
      <form onSubmit={save}>
        <label className="fl">Child</label>
        <select className="fi" value={f.child_id} onChange={e => set('child_id', e.target.value)} disabled={!!report}>
          <option value="">Choose…</option>
          {kids.map(k => <option key={k.id} value={k.id}>{k.preferred_name || k.name}</option>)}
        </select>

        <label className="fl">Type</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {INCIDENT_KINDS.map(k => (
            <button key={k.id} type="button" className="chip" onClick={() => set('kind', k.id)}
              style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, background: f.kind === k.id ? 'var(--accent)' : undefined, color: f.kind === k.id ? '#fff' : undefined }}>
              {k.icon} {k.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="fl">Date</label><input className="fi" type="date" value={f.day} max={localDate()} onChange={e => set('day', e.target.value)} required/></div>
          <div style={{ flex: 1 }}><label className="fl">Time</label><input className="fi" type="time" value={f.time} onChange={e => set('time', e.target.value)} required/></div>
        </div>
        <label className="fl">Where <span style={{ fontWeight: 400 }}>(optional)</span></label>
        <input className="fi" value={f.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Playground, near the slide" maxLength={200}/>
        <label className="fl">What happened</label>
        <textarea className="fi" rows={4} value={f.description} onChange={e => set('description', e.target.value)} maxLength={4000}
          placeholder="Describe it plainly: what happened, any injury and where on the body."/>
        <label className="fl">First aid or action taken <span style={{ fontWeight: 400 }}>(optional)</span></label>
        <textarea className="fi" rows={2} value={f.first_aid} onChange={e => set('first_aid', e.target.value)} maxLength={2000} placeholder="e.g. Cleaned the scrape, ice pack for 10 minutes"/>
        <label className="fl">Witness <span style={{ fontWeight: 400 }}>(optional)</span></label>
        <input className="fi" value={f.witness} onChange={e => set('witness', e.target.value)} maxLength={200} placeholder="Staff who saw it"/>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, margin: '4px 0 10px', cursor: 'pointer' }}>
          <input type="checkbox" checked={f.told} onChange={e => set('told', e.target.checked)}/> The parent has already been told
        </label>
        {f.told && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="fi" type="date" value={f.told_day} max={localDate()} onChange={e => set('told_day', e.target.value)} style={{ flex: 1, minWidth: 130 }} aria-label="Date the parent was told"/>
            <input className="fi" type="time" value={f.told_time} onChange={e => set('told_time', e.target.value)} style={{ flex: 1, minWidth: 100 }} aria-label="Time the parent was told"/>
            <select className="fi" value={f.told_how} onChange={e => set('told_how', e.target.value)} style={{ flex: 1, minWidth: 140 }} aria-label="How the parent was told">
              {TOLD_HOW.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" className="bp full" disabled={saving}>{saving ? <Spinner/> : report ? 'Save changes' : 'Save report'}</button>
          <button type="button" className="bg" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function IncidentDetail({ report: r, child, facilityName, manager, userId, onEdit, onClose, onChanged }) {
  const [busy,  setBusy]  = useState(false);
  const [msg,   setMsg]   = useState(null);
  const [fix,   setFix]   = useState('');
  const [fixing, setFixing] = useState(false);
  const k = incidentKind(r.kind);
  const name = child ? (child.preferred_name || child.name) : 'the child';
  const canEdit = r.status === 'review' && (manager || r.reported_by === userId);

  async function send() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('send_incident_report', { p_id: r.id });
    if (error) { setBusy(false); setMsg({ err: errText(error) }); return; }
    const warn = await notifyParents({ kind: 'incident', incidentId: r.id });
    setBusy(false);
    setMsg(warn ? { warn: `Sent. ${warn}` } : { ok: `Sent to ${name}'s family to read and sign.` });
    onChanged();
  }

  async function addCorrection() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('add_incident_correction', { p_id: r.id, p_text: fix });
    setBusy(false);
    if (error) { setMsg({ err: errText(error) }); return; }
    setFix(''); setFixing(false);
    setMsg({ ok: 'Correction added. The family sees it on the report.' });
    onChanged();
  }

  const line = (label, value) => value ? (
    <div style={{ padding: '7px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</div>
      <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  ) : null;

  return (
    <Modal open onClose={() => !busy && onClose()}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <div>
          <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600 }}>{k.icon} {name}: {k.label.toLowerCase()}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{when(r.occurred_at)} · written by {r.reported_by_name || 'staff'}</div>
        </div>
        <StatusPill status={r.status}/>
      </div>
      {msg && <div className={`al ${msg.err ? 'al-e' : msg.warn ? 'al-w' : 'al-s'}`}>{msg.err || msg.warn || msg.ok}</div>}

      <div style={{ maxHeight: '46vh', overflowY: 'auto', margin: '6px 0 12px' }}>
        {line('Where', r.location)}
        {line('What happened', r.description)}
        {line('First aid or action taken', r.first_aid)}
        {line('Witness', r.witness)}
        {line('Parent told', r.parent_told_at && `${when(r.parent_told_at)}${r.parent_told_how ? ` · ${toldHowLabel(r.parent_told_how)}` : ''}`)}
        {line('Sent to the family', r.sent_at && `${when(r.sent_at)}${r.sent_by_name ? ` by ${r.sent_by_name}` : ''}`)}
        {line('Parent signature', r.parent_signed_at && `${r.parent_signed_name} · ${when(r.parent_signed_at)}`)}
        {line('Parent comment', r.parent_comment)}
        {(r.corrections || []).map((c, i) => (
          <div key={i} className="al al-w" style={{ marginTop: 8, fontSize: 12 }}>
            <strong>Correction {when(c.at)}{c.by_name ? ` by ${c.by_name}` : ''}:</strong> {c.text}
          </div>
        ))}
      </div>

      {fixing && (
        <>
          <label className="fl">Correction</label>
          <textarea className="fi" rows={3} value={fix} onChange={e => setFix(e.target.value)} maxLength={2000}
            placeholder="What was wrong and what's correct. The original stays on the report."/>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {r.status === 'review' && manager && (
          <button className="bp" style={{ flex: 1, minWidth: 180 }} onClick={send} disabled={busy}>{busy ? <Spinner/> : 'Send to the family to sign'}</button>
        )}
        {canEdit && <button className="bg" onClick={onEdit} disabled={busy}>Edit</button>}
        {r.status !== 'review' && manager && !fixing && <button className="bg" onClick={() => setFixing(true)} disabled={busy}>Add a correction</button>}
        {fixing && <button className="bp" onClick={addCorrection} disabled={busy || fix.trim().length < 3}>{busy ? <Spinner/> : 'Save correction'}</button>}
        <button className="bg" onClick={() => printIncident(r, child, facilityName)}>🖨 Print</button>
        <button className="bg" onClick={onClose} disabled={busy}>Close</button>
      </div>
      {r.status === 'review' && !manager && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10 }}>Your director or office will review this and send it to the family.</div>
      )}
    </Modal>
  );
}
