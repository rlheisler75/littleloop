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
import { localDate, addDays } from './enrollment';
import { errText } from './api';

// Parent home, under a connected daycare: the day's report, incident reports to sign, and
// the daycare's resources. Daily reports and incidents are for parents (admin/member);
// resources are for everyone in the family.
export default function ParentDaycareExtras({ facility, kids, memberRole }) {
  const isParent = memberRole === 'admin' || memberRole === 'member';
  const [counts, setCounts] = useState(null);   // { logs, sent, toSign, incidents, resources }
  const [open,   setOpen]   = useState(null);   // 'daily' | 'incidents' | 'resources'
  const kidIds = kids.map(k => k.id).join(',');

  const load = useCallback(async () => {
    const ids = kidIds ? kidIds.split(',') : [];
    const [care, reps, { data: inc }, res] = await Promise.all([
      isParent && ids.length ? loadCareLogs(facility.id, localDate(), ids) : {},
      isParent && ids.length ? loadDailyReports(facility.id, localDate(), ids) : {},
      isParent && ids.length ? supabase.from('incident_reports').select('id, status').eq('facility_id', facility.id).in('child_id', ids) : { data: [] },
      loadResources(facility.id),
    ]);
    setCounts({
      logs: Object.values(care).reduce((s, l) => s + l.length, 0),
      sent: Object.values(reps).filter(r => r.sent_at).length,
      toSign: (inc || []).filter(r => r.status === 'sent').length,
      incidents: (inc || []).length,
      resources: res.filter(r => r.published).length,
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
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{r.alert ? 'Sign' : 'Open'} →</span>
        </button>
      ))}
      {open === 'daily'     && <ParentDaily facility={facility} kids={kids} onClose={() => { setOpen(null); load(); }}/>}
      {open === 'incidents' && <ParentIncidents facility={facility} kids={kids} onClose={() => { setOpen(null); load(); }}/>}
      {open === 'resources' && <ParentResources facility={facility} onClose={() => setOpen(null)}/>}
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
