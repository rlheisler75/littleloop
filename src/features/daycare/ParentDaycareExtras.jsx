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
import { money, longDate, periodText, entryLabel, printStatement, printTaxStatement } from './billing';
import { payCall, takeParams } from './payments';
import { MEALS, conflictsFor, dayLabel, weekDays } from './kitchen';

// Parent home, under a connected daycare: the day's report, incident reports to sign, the
// week's lesson plan, report cards, and the daycare's resources. Daily reports and incidents are for parents (admin/member);
// resources are for everyone in the family.
export default function ParentDaycareExtras({ facility, kids, memberRole }) {
  const isParent = memberRole === 'admin' || memberRole === 'member';
  const [counts, setCounts] = useState(null);   // { logs, sent, toSign, incidents, resources, rooms, plans, cards, unread }
  const [open,   setOpen]   = useState(null);   // 'daily' | 'incidents' | 'plans' | 'reports' | 'resources'
  const [payReturn] = useState(() => {          // back from paying on Stripe
    const q = new URLSearchParams(window.location.search);
    return q.get('daycare') === facility.id && (q.get('daycare_paid') || q.get('daycare_pay'))
      ? { paid: q.get('daycare_paid'), canceled: q.get('daycare_pay') === 'canceled' } : null;
  });
  useEffect(() => { if (payReturn) { takeParams(['daycare_paid', 'daycare_pay', 'daycare']); setOpen('billing'); } }, [payReturn]);
  const kidIds = kids.map(k => k.id).join(',');

  const load = useCallback(async () => {
    const ids = kidIds ? kidIds.split(',') : [];
    const familyId = kids[0]?.family_id || null;
    const [care, reps, { data: inc }, res, { data: en }, { data: cards }, { data: bill }, { data: lastSt }] = await Promise.all([
      isParent && ids.length ? loadCareLogs(facility.id, localDate(), ids) : {},
      isParent && ids.length ? loadDailyReports(facility.id, localDate(), ids) : {},
      isParent && ids.length ? supabase.from('incident_reports').select('id, status').eq('facility_id', facility.id).in('child_id', ids) : { data: [] },
      loadResources(facility.id),
      ids.length ? supabase.from('facility_enrollments').select('child_id, classroom_id, classrooms(name)').eq('facility_id', facility.id).eq('status', 'active').in('child_id', ids) : { data: [] },
      isParent && ids.length ? supabase.from('report_cards').select('id, parent_seen_at').eq('facility_id', facility.id).in('child_id', ids) : { data: [] },
      isParent && familyId ? supabase.from('daycare_ledger').select('kind, amount').eq('facility_id', facility.id).eq('family_id', familyId).eq('payer', 'family').is('voided_at', null) : { data: [] },
      isParent && familyId ? supabase.from('daycare_statements').select('due_date, balance_due').eq('facility_id', facility.id).eq('family_id', familyId).order('number', { ascending: false }).limit(1).maybeSingle() : { data: null },
    ]);
    const rooms = [...new Map((en || []).filter(e => e.classroom_id).map(e => [e.classroom_id, { id: e.classroom_id, name: e.classrooms?.name || 'Classroom' }])).values()];
    // The kitchen's menu, once it shares the week (families can't read unshared weeks)
    const [{ data: menuWeek }, { data: todayMenus }] = await Promise.all([
      supabase.from('daycare_menu_weeks').select('week_start').eq('facility_id', facility.id).eq('week_start', weekStart()).not('shared_at', 'is', null).maybeSingle(),
      supabase.from('daycare_menus').select('meal, foods').eq('facility_id', facility.id).eq('day', localDate()),
    ]);
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
      menu: menuWeek ? { today: todayMenus || [] } : null,
      cards: (cards || []).length, unread: (cards || []).filter(c => !c.parent_seen_at).length,
      billing: (bill || []).length || lastSt ? { balance: (bill || []).reduce((s, e) => s + (e.kind === 'charge' ? 1 : -1) * Number(e.amount), 0), due: lastSt?.due_date || null } : null,
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
    counts.menu && {
      id: 'menu', icon: '🍽️', title: "This week's menu",
      sub: menuSub(counts.menu.today, kids),
    },
    isParent && counts.cards > 0 && {
      id: 'reports', icon: '🎓', title: 'Report cards', alert: counts.unread > 0, action: counts.unread > 0 ? 'Read' : 'Open',
      sub: counts.unread ? `${counts.unread} new report card${counts.unread === 1 ? '' : 's'} to read` : `${counts.cards} report card${counts.cards === 1 ? '' : 's'}`,
    },
    isParent && counts.billing && {
      id: 'billing', icon: '🧾', title: 'Billing', action: 'Open',
      alert: counts.billing.balance > 0.004 && counts.billing.due && counts.billing.due < localDate(),
      sub: counts.billing.balance > 0.004 ? `${money(counts.billing.balance)} due${counts.billing.due ? ` by ${longDate(counts.billing.due)}` : ''}`
         : counts.billing.balance < -0.004 ? `${money(-counts.billing.balance)} credit` : 'Paid up. Thank you!',
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
      {open === 'menu'      && <ParentMenu facility={facility} kids={kids} onClose={() => setOpen(null)}/>}
      {open === 'reports'   && <ParentReportCards facility={facility} kids={kids} rooms={counts.rooms} onClose={() => { setOpen(null); load(); }}/>}
      {open === 'billing'   && <ParentBilling facility={facility} familyId={kids[0]?.family_id} canPay={isParent} payReturn={payReturn} onClose={() => { setOpen(null); load(); }}/>}
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

// The menu row's second line: a heads-up when today has something a child can't have, else today's lunch
function menuSub(today, kids) {
  const flagged = kids.filter(k => today.some(m => conflictsFor(k, m.foods || []).length));
  if (flagged.length) return `Today has something ${flagged.map(k => k.preferred_name || k.name).join(' and ')} can't have: see the substitute`;
  const meal = today.find(m => m.meal === 'lunch') || today[0];
  return meal?.foods?.length ? `Today: ${meal.foods.map(f => f.name).join(', ')}` : 'Meals and snacks for the week';
}

// The daycare's shared weekly menu, with what this family's children can't have and what they get instead
function ParentMenu({ facility, kids, onClose }) {
  const [week, setWeek] = useState(weekStart());
  const [data, setData] = useState(null);   // { shared, menus: {'day|meal': row}, subs: {'day|meal|child': text} }
  const kidIds = kids.map(k => k.id).join(',');
  useEffect(() => {
    setData(null);
    const to = addDays(week, 6);   // through Sunday, for daycares open on weekends
    Promise.all([
      supabase.from('daycare_menu_weeks').select('week_start').eq('facility_id', facility.id).eq('week_start', week).not('shared_at', 'is', null).maybeSingle(),
      supabase.from('daycare_menus').select('day, meal, foods, note').eq('facility_id', facility.id).gte('day', week).lte('day', to),
      kidIds ? supabase.from('daycare_meal_subs').select('day, meal, child_id, substitute').eq('facility_id', facility.id).gte('day', week).lte('day', to).in('child_id', kidIds.split(',')) : { data: [] },
    ]).then(([{ data: w }, { data: m }, { data: sub }]) => setData({
      shared: !!w,
      menus: Object.fromEntries((m || []).map(r => [`${r.day}|${r.meal}`, r])),
      subs: Object.fromEntries((sub || []).map(r => [`${r.day}|${r.meal}|${r.child_id}`, r.substitute])),
    }));
  }, [week, facility.id, kidIds]);
  const thisWeek = weekStart();
  const today = localDate();
  return (
    <Modal open onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600 }}>🍽️ Menu</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="bg" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setWeek(w => addDays(w, -7))} disabled={week <= addDays(thisWeek, -28)} aria-label="Previous week">‹</button>
          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 96, textAlign: 'center' }}>{week === thisWeek ? 'This week' : weekText(week)}</span>
          <button className="bg" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setWeek(w => addDays(w, 7))} disabled={week >= addDays(thisWeek, 7)} aria-label="Next week">›</button>
        </div>
      </div>
      <div style={{ maxHeight: '64vh', overflowY: 'auto' }}>
        {!data ? <div style={{ textAlign: 'center', padding: 30 }}><Spinner size={20}/></div>
          : !data.shared ? <div style={{ fontSize: 13, color: 'var(--text-faint)', padding: '10px 0' }}>{facility.name} hasn't shared this week's menu yet.</div>
          : weekDays(week, 7).map(day => {
            const meals = MEALS.filter(m => data.menus[`${day}|${m.id}`]?.foods?.length);
            if (!meals.length) return null;
            return (
              <div key={day} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: day === today ? 'var(--accent)' : 'var(--text-faint)', marginBottom: 4 }}>
                  {dayLabel(day)}{day === today ? ' · today' : ''}
                </div>
                {meals.map(m => {
                  const row = data.menus[`${day}|${m.id}`];
                  const flagged = kids.map(k => ({ k, hits: conflictsFor(k, row.foods) })).filter(x => x.hits.length);
                  return (
                    <div key={m.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <span style={{ fontWeight: 700 }}>{m.icon} {m.label}:</span> {row.foods.map(f => f.name).join(', ')}
                      {row.note && <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}> · {row.note}</span>}
                      {flagged.map(({ k, hits }) => {
                        const sub = data.subs[`${day}|${m.id}|${k.id}`];
                        return (
                          <div key={k.id} style={{ fontSize: 12, color: 'var(--warn-text)', marginTop: 2 }}>
                            ⚠️ {k.preferred_name || k.name} can't have {hits.map(h => h.food).join(', ')}.{' '}
                            {sub ? <>Gets instead: <strong>{sub}</strong></> : 'The kitchen makes a substitute.'}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
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

// The family's account with the daycare: balance, statements, payments, and the year-end
// statement for taxes. Parents (admin/member) only; read-only.
function ParentBilling({ facility, familyId, canPay, payReturn, onClose }) {
  const [data, setData] = useState(null);
  const [year, setYear] = useState(new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear());
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!familyId) return;
    Promise.all([
      supabase.rpc('daycare_billing_info', { p_facility: facility.id }),
      supabase.from('daycare_statements').select('*').eq('facility_id', facility.id).eq('family_id', familyId).order('number', { ascending: false }).limit(24),
      supabase.from('daycare_ledger').select('*').eq('facility_id', facility.id).eq('family_id', familyId).eq('payer', 'family').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(60),
      canPay ? supabase.rpc('daycare_online_pay_info', { p_facility: facility.id }) : { data: null },
      canPay ? supabase.from('daycare_online_payments').select('id, amount, created_at').eq('facility_id', facility.id).eq('family_id', familyId).eq('status', 'processing') : { data: [] },
    ]).then(([{ data: info }, { data: sts }, { data: entries }, { data: pay }, { data: clearing }]) =>
      setData({ info, statements: sts || [], entries: entries || [], pay, clearing: clearing || [] }));
  }, [facility.id, familyId, canPay, reload]);

  // Back from Stripe: check the payment and say what happened
  useEffect(() => {
    if (!payReturn) return;
    if (payReturn.canceled) { setNotice({ ok: 'Payment canceled. Nothing was charged.' }); return; }
    if (!payReturn.paid) return;
    let stop = false, tries = 0;
    const check = async () => {
      try {
        const { payment } = await payCall('confirm', { paymentId: payReturn.paid });
        if (stop) return;
        if (payment.status === 'paid') { setNotice({ ok: `Thank you! Your payment of ${money(payment.amount)} went through.` }); setReload(r => r + 1); }
        else if (payment.status === 'processing') { setNotice({ ok: `Thanks! Your bank payment of ${money(payment.amount)} is on its way. It takes about 4 business days to clear and shows on your account when it does.` }); setReload(r => r + 1); }
        else if (payment.status === 'failed') setNotice({ err: 'That payment didn’t go through. Nothing was charged.' });
        else if (++tries < 4) setTimeout(check, 2500);
        else setNotice({ ok: 'Thanks! We’re waiting to hear back from Stripe. Your account updates in a few minutes.' });
      } catch (e) { if (!stop) setNotice({ err: e.message }); }
    };
    check();
    return () => { stop = true; };
  }, [payReturn]);

  async function printSt(st) {
    const { data: lines } = await supabase.from('daycare_ledger').select('*').eq('statement_id', st.id).order('entry_date');
    printStatement(st, lines, data?.info, null);
  }
  async function printYear() {
    setError(null);
    const { data: t, error: err } = await supabase.rpc('daycare_tax_statement', { p_facility: facility.id, p_family: familyId, p_year: year });
    if (err) { setError(errText(err)); return; }
    printTaxStatement(t);
  }

  const live = (data?.entries || []).filter(e => !e.voided_at);
  const balance = live.reduce((s, e) => s + (e.kind === 'charge' ? 1 : -1) * Number(e.amount), 0);
  const clearing = data?.clearing || [];
  const payable = Math.round((balance - clearing.reduce((s, p) => s + Number(p.amount), 0)) * 100) / 100;
  const thisYear = new Date().getFullYear();
  return (
    <Modal open onClose={onClose}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 2 }}>🧾 Billing</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10 }}>{facility.name}</div>
      {notice && <div className={`al ${notice.err ? 'al-e' : 'al-s'}`}>{notice.err || notice.ok}</div>}
      {!data ? <div style={{ textAlign: 'center', padding: 30 }}><Spinner size={20}/></div> : (
        <div style={{ maxHeight: '64vh', overflowY: 'auto' }}>
          <div className="card" style={{ padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-faint)' }}>Balance</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{balance < -0.004 ? `${money(-balance)} credit` : money(balance)}</div>
            {data.statements[0] && balance > 0.004 && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Due by {longDate(data.statements[0].due_date)}</div>}
            {clearing.map(p => <div key={p.id} style={{ fontSize: 12, marginTop: 6, color: 'var(--text-dim)' }}>⏳ Bank payment of {money(p.amount)} clearing (started {longDate(localDate(new Date(p.created_at)))})</div>)}
            {canPay && data.pay?.enabled && payable > 0.004 && <PayOnline facility={facility} familyId={familyId} payable={payable} pay={data.pay} onError={m => setNotice({ err: m })}/>}
            {data.info?.payment_instructions && <div style={{ fontSize: 12, marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--input-bg)' }}><strong>How to pay:</strong> {data.info.payment_instructions}</div>}
          </div>
          {data.statements.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, margin: '6px 0 4px' }}>Statements</div>
              {data.statements.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                  <span style={{ flex: 1 }}>#{s.number} · {s.period_start ? periodText(s.period_start, s.period_end) : longDate(s.statement_date)}</span>
                  <span style={{ fontWeight: 700 }}>{money(s.balance_due)}</span>
                  <button className="bg" style={{ padding: '3px 9px', fontSize: 11 }} onClick={() => printSt(s)}>🖨</button>
                </div>
              ))}
            </>
          )}
          {live.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, margin: '12px 0 4px' }}>Recent activity</div>
              {live.slice(0, 20).map(e => (
                <div key={e.id} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '5px 0', borderTop: '1px solid var(--border)' }}>
                  <span style={{ minWidth: 80, color: 'var(--text-faint)' }}>{longDate(e.entry_date)}</span>
                  <span style={{ flex: 1 }}>{entryLabel(e)}</span>
                  <span style={{ fontWeight: 700, color: e.kind === 'charge' ? 'var(--text)' : 'var(--ok-text)' }}>{e.kind === 'charge' ? '' : '−'}{money(e.amount)}</span>
                </div>
              ))}
            </>
          )}
          <div style={{ fontSize: 12, fontWeight: 800, margin: '14px 0 4px' }}>For your taxes</div>
          {error && <div className="al al-e">{error}</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="fi" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 'auto', marginBottom: 0, padding: '6px 10px' }} aria-label="Year">
              {[thisYear, thisYear - 1, thisYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button className="bg" style={{ fontSize: 12 }} onClick={printYear}>🖨 Year-end statement</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>What you paid that year, with the daycare's tax ID, for the child care credit or a dependent care FSA.</div>
        </div>
      )}
      <button className="bg full" style={{ marginTop: 10 }} onClick={onClose}>Close</button>
    </Modal>
  );
}

// Pay a daycare bill online: the amount (up to what's owed), then Stripe's secure page
function PayOnline({ facility, familyId, payable, pay, onError }) {
  const [amount, setAmount] = useState(payable.toFixed(2));
  useEffect(() => { setAmount(payable.toFixed(2)); }, [payable]);   // the new balance after a payment
  const [busy,   setBusy]   = useState(false);
  const value = Math.round(parseFloat(amount) * 100) / 100;
  const ok = value >= 1 && value <= payable + 0.004;
  async function go() {
    setBusy(true);
    try {
      const { url } = await payCall('checkout', { facilityId: facility.id, familyId, amount: value, returnUrl: window.location.origin });
      window.location.href = url;
    } catch (e) { setBusy(false); onError(e.message); }
  }
  const how = pay.card && pay.bank ? 'card or bank account' : pay.card ? 'card' : 'bank account';
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>$</span>
        <input className="fi" type="number" inputMode="decimal" min="1" step="0.01" max={payable} value={amount} onChange={e => setAmount(e.target.value)}
          aria-label="Amount to pay" style={{ width: 110, marginBottom: 0, padding: '7px 10px' }}/>
        <button className="bp" onClick={go} disabled={busy || !ok} style={{ padding: '8px 16px' }}>{busy ? <Spinner/> : ok ? `Pay ${money(value)} online` : 'Pay online'}</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6, lineHeight: 1.5 }}>
        By {how} on Stripe’s secure page. {pay.bank ? 'Bank payments take about 4 business days to clear. ' : ''}{pay.test_mode ? 'Test mode: no real money moves.' : ''}
      </div>
    </div>
  );
}
