import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import CareLogModal from './CareLogModal';
import DailyReportView from './DailyReportView';
import { loadCareLogs, loadDailyReports, summarize, notifyParents, clock } from './care';
import { localDate, addDays } from './enrollment';
import { errText, latestByChild } from './api';

// Daily: each child's day for the chosen date. Teachers review the entries, add a note and
// send the report; parents watch it fill in live and get an alert when it's sent.
export default function DailyReportsTab({ facilityId, manager }) {
  const [day,     setDay]     = useState(localDate());
  const [loading, setLoading] = useState(true);
  const [rooms,   setRooms]   = useState([]);
  const [kids,    setKids]    = useState([]);
  const [logs,    setLogs]    = useState({});
  const [reports, setReports] = useState({});
  const [checks,  setChecks]  = useState({});
  const [stillIn, setStillIn] = useState(new Set());   // checked in on an earlier day, not out yet
  const [room,    setRoom]    = useState('all');
  const [openId,  setOpenId]  = useState(null);

  const load = useCallback(async () => {
    const [{ data: rm }, { data: en }] = await Promise.all([
      supabase.from('classrooms').select('id, name, color').eq('facility_id', facilityId).eq('active', true).order('sort').order('name'),
      supabase.from('facility_enrollments').select('child_id, classroom_id').eq('facility_id', facilityId).eq('status', 'active'),
    ]);
    const ids = (en || []).map(e => e.child_id);
    const roomOf = Object.fromEntries((en || []).map(e => [e.child_id, e.classroom_id]));
    const start = new Date(day + 'T00:00:00'), end = new Date(day + 'T00:00:00');
    end.setDate(end.getDate() + 1);
    const isToday = day === localDate();
    const [{ data: ch }, care, reps, { data: ci }, { data: recent }] = ids.length ? await Promise.all([
      supabase.from('children').select('id, name, preferred_name, avatar, color, family_id, allergies, allergy_severe, diet_types, dietary_restrictions').in('id', ids).order('name'),
      loadCareLogs(facilityId, day, ids),
      loadDailyReports(facilityId, day, ids),
      supabase.from('checkins').select('child_id, status, checked_at, checked_by_name').eq('facility_id', facilityId).in('child_id', ids)
        .gte('checked_at', start.toISOString()).lt('checked_at', end.toISOString()).order('checked_at'),
      // Today only: who is still checked in from an earlier day (never checked out)
      isToday ? supabase.from('checkins').select('child_id, status, checked_at').eq('facility_id', facilityId).in('child_id', ids)
        .gte('checked_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('checked_at', { ascending: false }) : { data: [] },
    ]) : [{ data: [] }, {}, {}, { data: [] }, { data: [] }];
    const byChild = {};
    for (const c of ci || []) (byChild[c.child_id] ||= []).push(c);
    const stillIn = new Set(Object.values(latestByChild(recent)).filter(c => c.status === 'in').map(c => c.child_id));
    setStillIn(stillIn);
    setRooms(rm || []);
    setKids((ch || []).map(c => ({ ...c, classroom_id: roomOf[c.id] || null })));
    setLogs(care); setReports(reps); setChecks(byChild);
    setLoading(false);
  }, [facilityId, day]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;

  const isToday = day === localDate();
  const here = c => (checks[c.id] || []).length > 0 || (logs[c.id] || []).length > 0 || (isToday && stillIn.has(c.id));
  const shown = kids.filter(c => room === 'all' || c.classroom_id === room);
  const attended = shown.filter(here);
  const notHere = shown.filter(c => !here(c));
  const sentCount = attended.filter(c => reports[c.id]?.sent_at).length;
  const roomName = id => rooms.find(r => r.id === id)?.name || 'No classroom';
  const openKid = kids.find(k => k.id === openId) || null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600 }}>Daily reports</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="bg" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setDay(d => addDays(d, -1))} disabled={day <= addDays(localDate(), -7)} aria-label="Previous day">‹</button>
          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 120, textAlign: 'center' }}>
            {isToday ? 'Today' : new Date(day + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <button className="bg" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setDay(d => addDays(d, 1))} disabled={isToday} aria-label="Next day">›</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select className="fi" value={room} onChange={e => setRoom(e.target.value)} style={{ width: 'auto', marginBottom: 0, padding: '7px 10px', fontSize: 12 }} aria-label="Classroom">
          <option value="all">All rooms</option>
          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          {attended.length ? `${sentCount} of ${attended.length} sent` : 'No one here yet'}
        </span>
      </div>

      {kids.length === 0 && <div className="es"><div className="ic">📒</div><h3>No children enrolled</h3><p>Enroll families to start daily reports.</p></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {attended.map(c => {
          const r = reports[c.id];
          const { chips, napping } = summarize(logs[c.id] || []);
          return (
            <button key={c.id} className="card" onClick={() => setOpenId(c.id)}
              style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', color: 'var(--text)', width: '100%' }}>
              <span style={{ fontSize: 22 }}>{c.avatar || '🌟'}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{c.preferred_name || c.name}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {roomName(c.classroom_id)} · {(logs[c.id] || []).length} entr{(logs[c.id] || []).length === 1 ? 'y' : 'ies'}
                  {napping && ' · 😴 asleep'} {chips.length > 0 && `· ${chips.join(' ')}`}
                </span>
              </span>
              <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
                background: r?.sent_at ? 'rgba(58,158,122,.14)' : 'var(--input-bg)', color: r?.sent_at ? 'var(--ok-text)' : 'var(--text-faint)',
                border: `1px solid ${r?.sent_at ? 'rgba(58,158,122,.3)' : 'var(--border)'}` }}>
                {r?.sent_at ? `Sent ${clock(r.sent_at)}` : 'Not sent'}
              </span>
            </button>
          );
        })}
      </div>

      {notHere.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-faint)' }}>
          Not here {isToday ? 'today' : 'that day'}: {notHere.map(c => c.preferred_name || c.name).join(', ')}
        </div>
      )}

      {openKid && (
        <ReportPanel child={openKid} facilityId={facilityId} day={day} manager={manager}
          logs={logs[openKid.id] || []} checkins={checks[openKid.id] || []} report={reports[openKid.id] || null}
          onClose={() => setOpenId(null)} onChanged={load}/>
      )}
    </div>
  );
}

function ReportPanel({ child, facilityId, day, manager, logs, checkins, report, onClose, onChanged }) {
  const [note,    setNote]    = useState(report?.teacher_note || '');
  const [sending, setSending] = useState(false);
  const [msg,     setMsg]     = useState(null);
  const [logFor,  setLogFor]  = useState(null);
  const locked = !!report?.sent_at && !manager;   // after sending, only the director/office edit entries

  async function send() {
    setSending(true); setMsg(null);
    const { data: id, error } = await supabase.rpc('send_daily_report', { p_facility_id: facilityId, p_child_id: child.id, p_day: day, p_note: note });
    if (error) { setSending(false); setMsg({ err: errText(error) }); return; }
    const warn = await notifyParents({ kind: 'daily_report', reportId: id });
    setSending(false);
    setMsg(warn ? { warn: `Report saved. ${warn}` } : { ok: `Sent to ${child.preferred_name || child.name}'s family.` });
    onChanged();
  }

  return (
    <Modal open onClose={() => !sending && onClose()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 26 }}>{child.avatar || '🌟'}</span>
        <div>
          <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600 }}>{child.preferred_name || child.name}'s day</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {new Date(day + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            {report?.sent_at && ` · sent ${clock(report.sent_at)}${report.sent_by_name ? ` by ${report.sent_by_name}` : ''}`}
          </div>
        </div>
      </div>
      {msg && <div className={`al ${msg.err ? 'al-e' : msg.warn ? 'al-w' : 'al-s'}`}>{msg.err || msg.warn || msg.ok}</div>}

      <div style={{ maxHeight: '42vh', overflowY: 'auto', margin: '8px 0 10px' }}>
        <DailyReportView logs={logs} checkins={checkins} onEdit={locked ? null : l => setLogFor({ editing: l })}/>
      </div>
      <button className="bg" style={{ fontSize: 12, padding: '6px 12px', marginBottom: 12 }} onClick={() => setLogFor({})}>+ Add an entry</button>
      {locked && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: -6, marginBottom: 10 }}>Sent reports can be added to; your director or office can change earlier entries.</div>}

      <label className="fl">Note for the family <span style={{ fontWeight: 400 }}>(optional)</span></label>
      <textarea className="fi" rows={3} value={note} onChange={e => setNote(e.target.value)} maxLength={2000}
        placeholder={`How ${child.preferred_name || child.name}'s day went, anything to bring tomorrow…`}/>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="bp full" onClick={send} disabled={sending}>
          {sending ? <Spinner/> : report?.sent_at ? 'Send the updated report' : 'Send to the family'}
        </button>
        <button className="bg" onClick={onClose} disabled={sending}>Close</button>
      </div>

      <CareLogModal open={!!logFor} facilityId={facilityId} day={day} kids={[child]} editing={logFor?.editing || null}
        onClose={() => setLogFor(null)} onSaved={onChanged}/>
    </Modal>
  );
}
