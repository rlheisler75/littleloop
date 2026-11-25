import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import DailyReportView from './DailyReportView';
import ResourceList from './ResourceList';
import { StatusPill } from './IncidentsTab';
import { loadCareLogs, loadDailyReports, clock } from './care';
import { incidentKind, toldHowLabel, when, printIncident } from './incidents';
import { loadResources } from './resources';
import { localDate, addDays, fmtStamp } from './enrollment';
import { errText } from './api';
import { LessonPlanWeek } from './LessonPlans';
import { ReportCardView } from './ReportCards';
import { weekStart, weekText, childName, printReportCard } from './learning';

// Parent home, under a connected daycare: the day's report, incident reports to sign, the
// week's lesson plan, report cards, and the daycare's resources. Daily reports and incidents are for parents (admin/member);
// resources are for everyone in the family.
export default function ParentDaycareExtras({ facility, kids, memberRole }) {
  const isParent = memberRole === 'admin' || memberRole === 'member';
  const [counts, setCounts] = useState(null);   // { logs, sent, toSign, incidents, resources, rooms, plans, cards, unread }
  const [open,   setOpen]   = useState(null);   // 'daily' | 'incidents' | 'plans' | 'reports' | 'resources'
  const kidIds = kids.map(k => k.id).join(',');

  const load = useCallback(async () => {
    const ids = kidIds ? kidIds.split(',') : [];
    const [care, reps, { data: inc }, res, { data: en }, { data: cards }] = await Promise.all([
      isParent && ids.length ? loadCareLogs(facility.id, localDate(), ids) : {},
      isParent && ids.length ? loadDailyReports(facility.id, localDate(), ids) : {},
      isParent && ids.length ? supabase.from('incident_reports').select('id, status').eq('facility_id', facility.id).in('child_id', ids) : { data: [] },
      loadResources(facility.id),
      ids.length ? supabase.from('facility_enrollments').select('child_id, classroom_id, classrooms(name)').eq('facility_id', facility.id).eq('status', 'active').in('child_id', ids) : { data: [] },
      isParent && ids.length ? supabase.from('report_cards').select('id, parent_seen_at').eq('facility_id', facility.id).in('child_id', ids) : { data: [] },
    ]);
    const rooms = [...new Map((en || []).filter(e => e.classroom_id).map(e => [e.classroom_id, { id: e.classroom_id, name: e.classrooms?.name || 'Classroom' }])).values()];
    const { data: plans } = rooms.length
      ? await supabase.from('lesson_plans').select('id, classroom_id, theme').in('classroom_id', rooms.map(r => r.id)).eq('week_start', weekStart()).eq('status', 'published')
      : { data: [] };
    setCounts({
      logs: Object.values(care).reduce((s, l) => s + l.length, 0),
      sent: Object.values(reps).filter(r => r.sent_at).length,
      toSign: (inc || []).filter(r => r.status === 'sent').length,
      incidents: (inc || []).length,
      resources: res.filter(r => r.published).length,
      rooms, plans: plans || [],
      cards: (cards || []).length, unread: (cards || []).filter(c => !c.parent_seen_at).length,
    });
  }, [facility.id, kidIds, isParent]);

  useEffect(() => { load(); }, [load]);

  if (!counts) return null;
  const rows = [
    isParent && kids.length > 0 && {
      id: 'daily', icon: '📒', title: 'Daily report',
      sub: counts.sent ? `Today's report is in${kids.length > 1 ? ` for ${counts.sent} of ${kids.length}` : ''}` : counts.logs ? `${counts.logs} update${counts.logs === 1 ? '' : 's'} so far today` : 'Meals, naps and more, as the day goes',
    },
    isParent && counts.incidents > 0 && {
      id: 'incidents', icon: '🩹', title: 'Incident reports', alert: counts.toSign > 0,
      sub: counts.toSign ? `${counts.toSign} waiting for your signature` : 'All signed',
    },
    counts.plans.length > 0 && {
      id: 'plans', icon: '🗓️', title: "This week's lesson plan",
      sub: counts.plans.map(p => p.theme).filter(Boolean).join(' · ') || `What ${counts.rooms.filter(r => counts.plans.some(p => p.classroom_id === r.id)).map(r => r.name).join(' and ')} is doing this week`,
    },
    isParent && counts.cards > 0 && {
      id: 'reports', icon: '🎓', title: 'Report cards', alert: counts.unread > 0, action: counts.unread > 0 ? 'Read' : 'Open',
      sub: counts.unread ? `${counts.unread} new report card${counts.unread === 1 ? '' : 's'} to read` : `${counts.cards} report card${counts.cards === 1 ? '' : 's'}`,
    },
    counts.resources > 0 && {
      id: 'resources', icon: '📚', title: 'Resources',
      sub: `${counts.resources} from ${facility.name}: financial help, child development and more`,
    },
  ].filter(Boolean);

  return (
    <>
      {rows.map(r => (
        <button key={r.id} onClick={() => setOpen(r.id)}
          style={{ marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
            border: `1px solid ${r.alert ? 'rgba(224,160,60,.45)' : 'var(--border)'}`, background: r.alert ? 'rgba(224,160,60,.10)' : 'var(--input-bg)' }}>
          <span style={{ fontSize: 20 }}>{r.icon}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{r.title}</span>
            <span style={{ display: 'block', fontSize: 11, color: r.alert ? 'var(--warn-text)' : 'var(--text-faint)' }}>{r.sub}</span>
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{r.action || (r.alert ? 'Sign' : 'Open')} →</span>
        </button>
      ))}
      {open === 'daily'     && <ParentDaily facility={facility} kids={kids} onClose={() => { setOpen(null); load(); }}/>}
      {open === 'incidents' && <ParentIncidents facility={facility} kids={kids} onClose={() => { setOpen(null); load(); }}/>}
      {open === 'resources' && <ParentResources facility={facility} onClose={() => setOpen(null)}/>}
      {open === 'plans'     && <ParentLessonPlans rooms={counts.rooms} onClose={() => setOpen(null)}/>}
      {open === 'reports'   && <ParentReportCards facility={facility} kids={kids} rooms={counts.rooms} onClose={() => { setOpen(null); load(); }}/>}
    </>
  );
}

function ParentDaily({ facility, kids, onClose }) {
  const [day,     setDay]     = useState(localDate());
  const [data,    setData]    = useState(null);
  const ids = kids.map(k => k.id);

  const load = useCallback(async () => {
    const start = new Date(day + 'T00:00:00'), end = new Date(day + 'T00:00:00');
    end.setDate(end.getDate() + 1);
    const [logs, reports, { data: ci }] = await Promise.all([
      loadCareLogs(facility.id, day, ids),
      loadDailyReports(facility.id, day, ids),
      supabase.from('checkins').select('child_id, status, checked_at, checked_by_name').eq('facility_id', facility.id).in('child_id', ids)
        .gte('checked_at', start.toISOString()).lt('checked_at', end.toISOString()).order('checked_at'),
    ]);
    const checks = {};
    for (const c of ci || []) (checks[c.child_id] ||= []).push(c);
    setData({ logs, reports, checks });
  }, [facility.id, day, ids.join(',')]);

  useEffect(() => { setData(null); load(); }, [load]);
  // The report fills in during the day: refresh every minute while it's open
  useEffect(() => {
    if (day !== localDate()) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
    return () => clearInterval(t);
  }, [load, day]);

  const isToday = day === localDate();
  return (
    <Modal open onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600 }}>📒 Daily report</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="bg" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setDay(d => addDays(d, -1))} disabled={day <= addDays(localDate(), -14)} aria-label="Previous day">‹</button>
          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 92, textAlign: 'center' }}>
            {isToday ? 'Today' : new Date(day + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <button className="bg" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setDay(d => addDays(d, 1))} disabled={isToday} aria-label="Next day">›</button>
        </div>
      </div>
      {!data ? <div style={{ textAlign: 'center', padding: 30 }}><Spinner size={20}/></div> : (
        <div style={{ maxHeight: '62vh', overflowY: 'auto' }}>
          {kids.map(k => {
            const rep = data.reports[k.id];
            return (
              <div key={k.id} className="card" style={{ padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{k.avatar || '🌟'}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{k.preferred_name || k.name}</span>
                  <span style={{ fontSize: 11, color: rep?.sent_at ? 'var(--ok-text)' : 'var(--text-faint)', fontWeight: 700 }}>
                    {rep?.sent_at ? `Sent ${clock(rep.sent_at)}` : isToday ? 'Updating live' : ''}
                  </span>
                </div>
                <DailyReportView logs={data.logs[k.id] || []} checkins={data.checks[k.id] || []} report={rep}/>
              </div>
            );
          })}
        </div>
      )}
      <button className="bg full" style={{ marginTop: 6 }} onClick={onClose}>Close</button>
    </Modal>
  );
}

function ParentIncidents({ facility, kids, onClose }) {
  const [rows,   setRows]   = useState(null);
  const [openId, setOpenId] = useState(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from('incident_reports').select('*').eq('facility_id', facility.id)
      .in('child_id', kids.map(k => k.id)).order('occurred_at', { ascending: false });
    setRows(data || []);
  }, [facility.id, kids.map(k => k.id).join(',')]);
  useEffect(() => { load(); }, [load]);

  const kid = id => kids.find(k => k.id === id);
  const current = rows?.find(r => r.id === openId) || null;
  if (current) return <SignIncident report={current} child={kid(current.child_id)} facility={facility} onBack={() => { setOpenId(null); load(); }}/>;

  return (
    <Modal open onClose={onClose}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 10 }}>🩹 Incident reports</div>
      {!rows ? <div style={{ textAlign: 'center', padding: 30 }}><Spinner size={20}/></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
          {rows.map(r => {
            const k = incidentKind(r.kind);
            const c = kid(r.child_id);
            return (
              <button key={r.id} className="card" onClick={() => setOpenId(r.id)}
                style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', color: 'var(--text)', width: '100%' }}>
                <span style={{ fontSize: 20 }}>{k.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{c?.preferred_name || c?.name} · {k.label}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)' }}>{when(r.occurred_at)}</span>
                </span>
                <StatusPill status={r.status}/>
              </button>
            );
          })}
          {rows.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>No incident reports.</div>}
        </div>
      )}
      <button className="bg full" style={{ marginTop: 12 }} onClick={onClose}>Close</button>
    </Modal>
  );
}

function SignIncident({ report: r, child, facility, onBack }) {
  const [name,    setName]    = useState('');
  const [comment, setComment] = useState('');
  const [agree,   setAgree]   = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState(null);
  const [done,    setDone]    = useState(false);
  const k = incidentKind(r.kind);

  async function sign(e) {
    e.preventDefault();
    if (!agree) { setError('Tick the box to confirm you read the report.'); return; }
    setBusy(true); setError(null);
    const { error: err } = await supabase.rpc('sign_incident_report', { p_id: r.id, p_name: name, p_comment: comment });
    setBusy(false);
    if (err) { setError(errText(err)); return; }
    setDone(true);
  }

  const line = (label, value) => value ? (
    <div style={{ padding: '7px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</div>
      <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  ) : null;

  return (
    <Modal open onClose={() => !busy && onBack()}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div>
          <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600 }}>{k.icon} {child?.preferred_name || child?.name}: {k.label.toLowerCase()}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{facility.name} · {when(r.occurred_at)}</div>
        </div>
        <StatusPill status={done ? 'signed' : r.status}/>
      </div>
      <div style={{ maxHeight: '40vh', overflowY: 'auto', marginBottom: 12 }}>
        {line('Where', r.location)}
        {line('What happened', r.description)}
        {line('First aid or action taken', r.first_aid)}
        {line('Witness', r.witness)}
        {line('You were told', r.parent_told_at && `${when(r.parent_told_at)}${r.parent_told_how ? ` · ${toldHowLabel(r.parent_told_how)}` : ''}`)}
        {line('Written by', r.reported_by_name)}
        {(r.corrections || []).map((c, i) => (
          <div key={i} className="al al-w" style={{ marginTop: 8, fontSize: 12 }}><strong>Correction {when(c.at)}:</strong> {c.text}</div>
        ))}
        {r.parent_signed_at && line('Signed', `${r.parent_signed_name} · ${when(r.parent_signed_at)}${r.parent_comment ? `\n${r.parent_comment}` : ''}`)}
      </div>

      {done && <div className="al al-s">Signed. Thank you. {facility.name} can see your signature now.</div>}
      {r.status === 'sent' && !done && (
        <form onSubmit={sign}>
          {error && <div className="al al-e">{error}</div>}
          <label className="fl">Comment for the daycare <span style={{ fontWeight: 400 }}>(optional)</span></label>
          <textarea className="fi" rows={2} value={comment} onChange={e => setComment(e.target.value)} maxLength={1000}/>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 2 }}/>
            I've read this report about my child.
          </label>
          <label className="fl">Type your full name to sign</label>
          <input className="fi" value={name} onChange={e => setName(e.target.value)} maxLength={120} autoComplete="name"/>
          <button type="submit" className="bp full" disabled={busy || name.trim().length < 2}>{busy ? <Spinner/> : 'Sign the report'}</button>
        </form>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="bg" onClick={() => printIncident(done ? { ...r, status: 'signed' } : r, child, facility.name)}>🖨 Print</button>
        <button className="bg full" onClick={onBack} disabled={busy}>Back</button>
      </div>
    </Modal>
  );
}

function ParentResources({ facility, onClose }) {
  const [items, setItems] = useState(null);
  useEffect(() => { loadResources(facility.id).then(setItems); }, [facility.id]);
  return (
    <Modal open onClose={onClose}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 2 }}>📚 Resources</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>Shared by {facility.name}</div>
      <div style={{ maxHeight: '62vh', overflowY: 'auto' }}>
        {!items ? <div style={{ textAlign: 'center', padding: 30 }}><Spinner size={20}/></div> : <ResourceList items={items}/>}
      </div>
      <button className="bg full" style={{ marginTop: 10 }} onClick={onClose}>Close</button>
    </Modal>
  );
}

// The week's plan for each of the family's classrooms (shared plans only)
function ParentLessonPlans({ rooms, onClose }) {
  const [week,  setWeek]  = useState(weekStart());
  const [plans, setPlans] = useState(null);
  useEffect(() => {
    setPlans(null);
    supabase.from('lesson_plans').select('*').in('classroom_id', rooms.map(r => r.id)).eq('week_start', week).eq('status', 'published')
      .then(({ data }) => setPlans(data || []));
  }, [week, rooms]);
  const thisWeek = weekStart();
  return (
    <Modal open onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600 }}>🗓️ Lesson plan</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="bg" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setWeek(w => addDays(w, -7))} disabled={week <= addDays(thisWeek, -56)} aria-label="Previous week">‹</button>
          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 96, textAlign: 'center' }}>{week === thisWeek ? 'This week' : weekText(week)}</span>
          <button className="bg" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setWeek(w => addDays(w, 7))} disabled={week >= addDays(thisWeek, 7)} aria-label="Next week">›</button>
        </div>
      </div>
      <div style={{ maxHeight: '64vh', overflowY: 'auto' }}>
        {!plans ? <div style={{ textAlign: 'center', padding: 30 }}><Spinner size={20}/></div>
          : plans.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text-faint)', padding: '10px 0' }}>No plan shared for this week.</div>
          : plans.map(p => (
            <div key={p.id} style={{ marginBottom: 14 }}>
              {rooms.length > 1 && <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-faint)', marginBottom: 4 }}>{rooms.find(r => r.id === p.classroom_id)?.name}</div>}
              <LessonPlanWeek plan={p}/>
            </div>
          ))}
      </div>
      <button className="bg full" style={{ marginTop: 10 }} onClick={onClose}>Close</button>
    </Modal>
  );
}

function ParentReportCards({ facility, kids, rooms, onClose }) {
  const [rows,   setRows]   = useState(null);
  const [openId, setOpenId] = useState(null);
  const kidIds = kids.map(k => k.id).join(',');
  const load = useCallback(async () => {
    const { data } = await supabase.from('report_cards').select('*').eq('facility_id', facility.id)
      .in('child_id', kidIds.split(',')).order('sent_at', { ascending: false });
    setRows(data || []);
  }, [facility.id, kidIds]);
  useEffect(() => { load(); }, [load]);

  const kid = id => kids.find(k => k.id === id);
  const current = rows?.find(r => r.id === openId) || null;
  if (current) return <ReadReportCard card={current} child={kid(current.child_id)} facility={facility}
    roomName={rooms.find(r => r.id === current.classroom_id)?.name || ''} onBack={() => { setOpenId(null); load(); }}/>;

  return (
    <Modal open onClose={onClose}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 10 }}>🎓 Report cards</div>
      {!rows ? <div style={{ textAlign: 'center', padding: 30 }}><Spinner size={20}/></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
          {rows.map(r => {
            const c = kid(r.child_id);
            return (
              <button key={r.id} className="card" onClick={() => setOpenId(r.id)}
                style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', color: 'var(--text)', width: '100%' }}>
                <span style={{ fontSize: 20 }}>{c?.avatar || '🎓'}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{childName(c)} · {r.period}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)' }}>From {r.sent_by_name || facility.name}{r.sent_at ? ` · ${fmtStamp(r.sent_at)}` : ''}</span>
                </span>
                {!r.parent_seen_at && <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: 'rgba(224,160,60,.15)', color: 'var(--warn-text)' }}>New</span>}
              </button>
            );
          })}
          {rows.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>No report cards yet.</div>}
        </div>
      )}
      <button className="bg full" style={{ marginTop: 12 }} onClick={onClose}>Close</button>
    </Modal>
  );
}

function ReadReportCard({ card, child, facility, roomName, onBack }) {
  const [comment, setComment] = useState('');
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState(null);
  const [seen,    setSeen]    = useState(null);   // set after acknowledging

  async function acknowledge() {
    setBusy(true); setError(null);
    const { error: err } = await supabase.rpc('acknowledge_report_card', { p_id: card.id, p_comment: comment });
    setBusy(false);
    if (err) { setError(errText(err)); return; }
    setSeen({ at: new Date().toISOString(), comment: comment.trim() });
  }

  const done = card.parent_seen_at || seen;
  return (
    <Modal open onClose={() => !busy && onBack()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600 }}>{child?.avatar || '🎓'} {childName(child)}: {card.period}</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10 }}>
        {[facility.name, roomName, card.created_by_name && `Teacher: ${card.created_by_name}`].filter(Boolean).join(' · ')}
      </div>
      <div style={{ maxHeight: '48vh', overflowY: 'auto', marginBottom: 12 }}><ReportCardView card={card}/></div>
      {done ? (
        <div className="al al-s" style={{ fontSize: 12 }}>
          {seen ? `Thanks! ${facility.name} can see you've read it.` : `You marked this as read ${fmtStamp(card.parent_seen_at)}.`}
          {(seen?.comment || card.parent_comment) && <><br/><strong>Your note:</strong> {seen?.comment || card.parent_comment}</>}
        </div>
      ) : (
        <>
          {error && <div className="al al-e">{error}</div>}
          <label className="fl">Note for the teacher <span style={{ fontWeight: 400 }}>(optional)</span></label>
          <textarea className="fi" rows={2} value={comment} onChange={e => setComment(e.target.value)} maxLength={1000}/>
          <button className="bp full" onClick={acknowledge} disabled={busy}>{busy ? <Spinner/> : "I've read it"}</button>
        </>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="bg" onClick={() => printReportCard(seen ? { ...card, parent_seen_at: seen.at, parent_seen_name: 'you', parent_comment: seen.comment } : card, child, facility.name, roomName)}>🖨 Print</button>
        <button className="bg full" onClick={onBack} disabled={busy}>Back</button>
      </div>
    </Modal>
  );
}
