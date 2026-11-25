import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal, Confirm } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { LEVELS, levelOf, byDomain, bandForDob, bandOf, defaultPeriod, loadSkills, loadLatestLevels, snapshotSkills, childName, printReportCard } from './learning';
import { notifyParents } from './care';
import { fmtDate, fmtStamp } from './enrollment';
import { errText } from './api';

const when = ts => new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function CardStatus({ card }) {
  const [label, bg, fg] = card.status === 'draft' ? ['Draft', 'rgba(224,160,60,.15)', 'var(--warn-text)']
    : card.parent_seen_at ? ['Read by family', 'rgba(58,158,122,.14)', 'var(--ok-text)']
    : ['Sent', 'color-mix(in srgb,var(--accent) 12%,transparent)', 'var(--accent)'];
  return <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: bg, color: fg }}>{label}</span>;
}

function LevelPill({ id }) {
  const l = levelOf(id);
  if (!l) return null;
  return <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#fff', background: l.color, borderRadius: 8, padding: '2px 8px' }}>{l.label}</span>;
}

// A sent report card, read-only (staff and parents). Skills not assessed are left out.
export function ReportCardView({ card }) {
  const sections = byDomain((card.skills || []).filter(s => s.level));
  const box = (title, text) => text ? (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{text}</div>
    </div>
  ) : null;
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>
        {LEVELS.map(l => <span key={l.id}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: l.color, marginRight: 4 }}/>{l.label}</span>)}
      </div>
      {sections.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>No skills were assessed on this report card.</div>}
      {sections.map(d => (
        <div key={d.id} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, margin: '6px 0 2px' }}>{d.icon} {d.label}</div>
          {d.items.map(s => (
            <div key={s.skill_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ flex: 1, fontSize: 13 }}>{s.name}</span><LevelPill id={s.level}/>
            </div>
          ))}
          {card.comments?.[d.id] && <div style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'pre-wrap', padding: '6px 10px', marginTop: 4, borderLeft: '3px solid var(--border)' }}>{card.comments[d.id]}</div>}
        </div>
      ))}
      {box('Strengths and highlights', card.summary)}
      {box('Next steps', card.next_steps)}
      {(card.notes || []).map((n, i) => (
        <div key={i} className="al al-w" style={{ marginTop: 8, fontSize: 12 }}><strong>Note {fmtStamp(n.at)}{n.by_name ? ` from ${n.by_name}` : ''}:</strong> {n.text}</div>
      ))}
    </div>
  );
}

// Staff: report cards. A teacher (or the office) drafts them, pre-filled from each child's
// skills; the director or office sends them to the family, who reads and acknowledges them.
export default function ReportCards({ facility, facilityId, rooms, kids, myRoomId, manager, userId }) {
  const [rows,    setRows]    = useState(null);
  const [extra,   setExtra]   = useState({});       // children no longer enrolled, by id
  const [filter,  setFilter]  = useState('draft');
  const [creating, setCreating] = useState(false);
  const [openId,  setOpenId]  = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('report_cards').select('*').eq('facility_id', facilityId).order('created_at', { ascending: false }).limit(500);
    if (error) console.error('load report cards:', error);
    const missing = [...new Set((data || []).map(r => r.child_id))].filter(id => !kids.some(k => k.id === id));
    if (missing.length) {
      const { data: ch } = await supabase.from('children').select('id, name, preferred_name, avatar, dob').in('id', missing);
      setExtra(Object.fromEntries((ch || []).map(c => [c.id, c])));
    }
    setRows(data || []);
  }, [facilityId, kids]);
  useEffect(() => { load(); }, [load]);

  if (!rows) return <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div>;

  const kid = id => kids.find(k => k.id === id) || extra[id];
  const roomName = id => rooms.find(r => r.id === id)?.name || '';
  const drafts = rows.filter(r => r.status === 'draft').length;
  const shown = rows.filter(r => filter === 'all' || r.status === filter);
  const myRooms = manager ? rooms : rooms.filter(r => r.id === myRoomId);
  const open = rows.find(r => r.id === openId) || null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {[{ id: 'draft', label: 'Drafts', n: drafts }, { id: 'sent', label: 'Sent', n: rows.length - drafts }, { id: 'all', label: 'All', n: rows.length }].map(f => (
          <button key={f.id} className="chip" onClick={() => setFilter(f.id)}
            style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, background: filter === f.id ? 'var(--accent)' : undefined, color: filter === f.id ? '#fff' : undefined }}>
            {f.label}{f.n > 0 ? ` · ${f.n}` : ''}
          </button>
        ))}
        <button className="bp" style={{ marginLeft: 'auto', padding: '8px 14px', fontSize: 13 }} onClick={() => setCreating(true)} disabled={!myRooms.length}>+ New report cards</button>
      </div>
      {!myRooms.length && <div className="al al-w">You need a home classroom to write report cards. Your director can set it under Staff.</div>}
      {manager && drafts > 0 && filter !== 'draft' && <div className="al al-w">{drafts} draft{drafts === 1 ? '' : 's'} waiting to be reviewed and sent.</div>}

      {rows.length === 0 ? (
        <div className="es"><div className="ic">🎓</div><h3>No report cards yet</h3>
          <p>Create report cards for a classroom and each one starts filled in from the child's skills. Add comments, then {manager ? 'send them' : 'your director or office sends them'} to families.</p></div>
      ) : shown.length === 0 ? <div className="al al-s">Nothing here.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(r => {
            const c = kid(r.child_id);
            return (
              <button key={r.id} className="card" onClick={() => setOpenId(r.id)}
                style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', color: 'var(--text)', width: '100%' }}>
                <span style={{ fontSize: 22 }}>{c?.avatar || '🎓'}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{childName(c)} · {r.period}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {[roomName(r.classroom_id), r.status === 'draft' ? `by ${r.updated_by_name || r.created_by_name || 'staff'}` : `sent ${fmtStamp(r.sent_at)}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <CardStatus card={r}/>
              </button>
            );
          })}
        </div>
      )}

      {creating && <NewCards facilityId={facilityId} rooms={myRooms} kids={kids} existing={rows}
        onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setFilter('draft'); load(); }}/>}
      {open && (open.status === 'draft'
        ? <CardEditor card={open} child={kid(open.child_id)} facility={facility} roomName={roomName(open.classroom_id)} manager={manager} userId={userId}
            onClose={() => setOpenId(null)} onChanged={load}/>
        : <CardDetail card={open} child={kid(open.child_id)} facility={facility} roomName={roomName(open.classroom_id)} manager={manager}
            onClose={() => setOpenId(null)} onChanged={load}/>)}
    </div>
  );
}

function NewCards({ facilityId, rooms, kids, existing, onClose, onCreated }) {
  const def = defaultPeriod();
  const [period, setPeriod] = useState(def.period);
  const [start,  setStart]  = useState(def.start);
  const [end,    setEnd]    = useState(def.end);
  const [target, setTarget] = useState(rooms[0] ? `room:${rooms[0].id}` : '');
  const [busy,   setBusy]   = useState(false);
  const [error,  setError]  = useState(null);
  const eligible = kids.filter(k => rooms.some(r => r.id === k.classroom_id));

  async function create(e) {
    e.preventDefault();
    if (!period.trim()) { setError('Name the period, e.g. Fall 2026.'); return; }
    if (start && end && end < start) { setError('The end date is before the start date.'); return; }
    const [kind, id] = target.split(':');
    const list = kind === 'room' ? eligible.filter(k => k.classroom_id === id) : eligible.filter(k => k.id === id);
    const fresh = list.filter(k => !existing.some(r => r.child_id === k.id && r.period.trim().toLowerCase() === period.trim().toLowerCase()));
    if (!fresh.length) { setError(list.length ? `Everyone here already has a ${period.trim()} report card.` : 'No children to create report cards for.'); return; }
    setBusy(true); setError(null);
    const [skills, latest] = await Promise.all([loadSkills(facilityId), loadLatestLevels(facilityId, fresh.map(k => k.id), end || null)]);
    const rowsToAdd = fresh.map(k => {
      const band = bandForDob(k.dob) || 'preschool';
      return { facility_id: facilityId, child_id: k.id, classroom_id: k.classroom_id || null, period: period.trim(),
               period_start: start || null, period_end: end || null, band, skills: snapshotSkills(skills, band, latest[k.id]), comments: {} };
    });
    const { error: err } = await supabase.from('report_cards').insert(rowsToAdd);
    setBusy(false);
    if (err) { setError(errText(err)); return; }
    onCreated();
  }

  return (
    <Modal open onClose={() => !busy && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 2 }}>New report cards</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>Each one starts as a draft, filled in from the child's latest skill levels up to the end date.</div>
      {error && <div className="al al-e">{error}</div>}
      <form onSubmit={create}>
        <label className="fl">Period</label>
        <input className="fi" value={period} onChange={e => setPeriod(e.target.value)} maxLength={80} placeholder="e.g. Fall 2026"/>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="fl">From</label><input className="fi" type="date" value={start} onChange={e => setStart(e.target.value)}/></div>
          <div style={{ flex: 1 }}><label className="fl">To</label><input className="fi" type="date" value={end} onChange={e => setEnd(e.target.value)}/></div>
        </div>
        <label className="fl">For</label>
        <select className="fi" value={target} onChange={e => setTarget(e.target.value)}>
          {rooms.map(r => <option key={r.id} value={`room:${r.id}`}>Everyone in {r.name} ({eligible.filter(k => k.classroom_id === r.id).length})</option>)}
          <optgroup label="One child">
            {eligible.map(k => <option key={k.id} value={`child:${k.id}`}>{childName(k)}</option>)}
          </optgroup>
        </select>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="bp full" disabled={busy}>{busy ? <Spinner/> : 'Create drafts'}</button>
          <button type="button" className="bg" onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function CardEditor({ card, child, facility, roomName, manager, userId, onClose, onChanged }) {
  const [f, setF] = useState(() => ({ period: card.period, skills: card.skills || [], comments: card.comments || {}, summary: card.summary || '', next_steps: card.next_steps || '' }));
  const [stamp, setStamp] = useState(card.updated_at);
  const [dirty, setDirty] = useState(false);
  const [busy,  setBusy]  = useState(false);
  const [msg,   setMsg]   = useState(null);
  const [ask,   setAsk]   = useState(null);     // 'delete' | 'refresh'
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setDirty(true); };
  const setLevel = (skillId, level) => set('skills', f.skills.map(s => s.skill_id === skillId ? { ...s, level: level || null } : s));
  const setComment = (domain, text) => set('comments', { ...f.comments, [domain]: text });
  const canDelete = manager || card.created_by === userId;

  async function save() {
    if (!f.period.trim()) { setMsg({ err: 'Name the period.' }); return false; }
    const comments = Object.fromEntries(Object.entries(f.comments).map(([k, v]) => [k, (v || '').trim().slice(0, 2000)]).filter(([, v]) => v));
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.from('report_cards')
      .update({ period: f.period.trim(), skills: f.skills, comments, summary: f.summary.trim() || null, next_steps: f.next_steps.trim() || null })
      .eq('id', card.id).eq('updated_at', stamp).select('updated_at').maybeSingle();
    setBusy(false);
    if (error) { setMsg({ err: errText(error) }); return false; }
    if (!data) { setMsg({ err: 'Someone else changed this report card while you had it open. Copy your comments, then close and reopen it.' }); return false; }
    setStamp(data.updated_at); setDirty(false); onChanged();
    return true;
  }

  async function refresh() {
    setAsk(null); setBusy(true); setMsg(null);
    const band = card.band || bandForDob(child?.dob) || 'preschool';
    const [skills, latest] = await Promise.all([loadSkills(card.facility_id), loadLatestLevels(card.facility_id, [card.child_id], card.period_end || null)]);
    setBusy(false);
    set('skills', snapshotSkills(skills, band, latest[card.child_id]));
    setMsg({ ok: 'Levels updated from the skills tracker. Save to keep them.' });
  }

  async function send() {
    if (dirty && !(await save())) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('send_report_card', { p_id: card.id });
    if (error) { setBusy(false); setMsg({ err: errText(error) }); return; }
    const warn = await notifyParents({ kind: 'report_card', reportCardId: card.id });
    setBusy(false);
    onChanged();
    setMsg(warn ? { warn: `Sent. ${warn}` } : { ok: `Sent to ${childName(child)}'s family.` });
  }

  async function remove() {
    setAsk(null); setBusy(true);
    const { error } = await supabase.from('report_cards').delete().eq('id', card.id);
    setBusy(false);
    if (error) { setMsg({ err: errText(error) }); return; }
    onChanged(); onClose();
  }

  const sections = byDomain(f.skills);
  const assessed = f.skills.filter(s => s.level).length;
  return (
    <Modal open onClose={() => !busy && onClose()}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600 }}>{child?.avatar || '🎓'} {childName(child)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{[roomName, bandOf(card.band).label, `${assessed} of ${f.skills.length} skills assessed`].filter(Boolean).join(' · ')}</div>
        </div>
        <CardStatus card={card}/>
      </div>
      {msg && <div className={`al ${msg.err ? 'al-e' : msg.warn ? 'al-w' : 'al-s'}`} style={{ marginTop: 8 }}>{msg.err || msg.warn || msg.ok}</div>}

      <div style={{ maxHeight: '52vh', overflowY: 'auto', margin: '10px 0' }}>
        <label className="fl">Period</label>
        <input className="fi" value={f.period} onChange={e => set('period', e.target.value)} maxLength={80}/>
        {sections.length === 0 && <div className="al al-w">No skills on the checklist for this age group. You can still write a summary.</div>}
        {sections.map(d => (
          <div key={d.id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{d.icon} {d.label}</div>
            {d.items.map(s => (
              <div key={s.skill_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                <span style={{ flex: 1, fontSize: 12 }}>{s.name}</span>
                <select className="fi" value={s.level || ''} onChange={e => setLevel(s.skill_id, e.target.value)} aria-label={s.name}
                  style={{ width: 128, marginBottom: 0, padding: '4px 6px', fontSize: 12, color: s.level ? levelOf(s.level)?.color : 'var(--text-faint)', fontWeight: 700 }}>
                  <option value="">Not assessed</option>
                  {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>
            ))}
            <textarea className="fi" rows={2} value={f.comments[d.id] || ''} onChange={e => setComment(d.id, e.target.value)} maxLength={2000}
              placeholder={`Comment on ${d.label.toLowerCase()} (optional)`} style={{ marginTop: 4, marginBottom: 0, fontSize: 12 }}/>
          </div>
        ))}
        <label className="fl">Strengths and highlights</label>
        <textarea className="fi" rows={3} value={f.summary} onChange={e => set('summary', e.target.value)} maxLength={3000} placeholder="How the term went, what they enjoy, what they're proud of"/>
        <label className="fl">Next steps</label>
        <textarea className="fi" rows={2} value={f.next_steps} onChange={e => set('next_steps', e.target.value)} maxLength={2000} placeholder="Goals for next term, and ideas to try at home"/>
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Skills left as "Not assessed" don't show on the family's copy.</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {manager && <button className="bp" style={{ flex: 1, minWidth: 150 }} onClick={send} disabled={busy}>{busy ? <Spinner/> : 'Send to the family'}</button>}
        <button className={manager ? 'bg' : 'bp'} onClick={save} disabled={busy || !dirty} style={manager ? {} : { flex: 1 }}>{busy && !manager ? <Spinner/> : dirty ? 'Save' : 'Saved'}</button>
        <button className="bg" onClick={() => setAsk('refresh')} disabled={busy} title="Pull the latest levels from the skills tracker">↻ Levels</button>
        <button className="bg" onClick={() => printReportCard({ ...card, ...f }, child, facility?.name, roomName)}>🖨</button>
        {canDelete && <button className="bd" style={{ padding: '8px 12px' }} onClick={() => setAsk('delete')} disabled={busy}>Delete</button>}
        <button className="bg" onClick={onClose} disabled={busy}>Close</button>
      </div>
      {!manager && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>Your director or office reviews and sends report cards to families.</div>}

      <Confirm open={ask === 'delete'} danger title="Delete this draft?" message={`${childName(child)}'s ${card.period} report card will be deleted.`}
        onConfirm={remove} onCancel={() => setAsk(null)}/>
      <Confirm open={ask === 'refresh'} title="Update the levels?" message="Every skill's level is replaced with the latest one from the skills tracker (up to the period's end date). Your comments stay."
        onConfirm={refresh} onCancel={() => setAsk(null)}/>
    </Modal>
  );
}

function CardDetail({ card, child, facility, roomName, manager, onClose, onChanged }) {
  const [note,   setNote]   = useState('');
  const [adding, setAdding] = useState(false);
  const [busy,   setBusy]   = useState(false);
  const [msg,    setMsg]    = useState(null);

  async function addNote() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('add_report_card_note', { p_id: card.id, p_text: note });
    setBusy(false);
    if (error) { setMsg({ err: errText(error) }); return; }
    setNote(''); setAdding(false); setMsg({ ok: 'Note added. The family sees it on the report card.' });
    onChanged();
  }

  return (
    <Modal open onClose={() => !busy && onClose()}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div>
          <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600 }}>{child?.avatar || '🎓'} {childName(child)}: {card.period}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {[roomName, card.period_start && card.period_end && `${fmtDate(card.period_start)} – ${fmtDate(card.period_end)}`, card.sent_at && `sent ${when(card.sent_at)}${card.sent_by_name ? ` by ${card.sent_by_name}` : ''}`].filter(Boolean).join(' · ')}
          </div>
        </div>
        <CardStatus card={card}/>
      </div>
      {msg && <div className={`al ${msg.err ? 'al-e' : 'al-s'}`}>{msg.err || msg.ok}</div>}
      <div style={{ maxHeight: '50vh', overflowY: 'auto', margin: '8px 0 12px' }}>
        <ReportCardView card={card}/>
        {card.parent_seen_at && (
          <div className="al al-s" style={{ marginTop: 10, fontSize: 12 }}>
            Read by {card.parent_seen_name} · {when(card.parent_seen_at)}{card.parent_comment && <><br/><strong>Their note:</strong> {card.parent_comment}</>}
          </div>
        )}
      </div>
      {adding && (
        <>
          <label className="fl">Note for the family</label>
          <textarea className="fi" rows={3} value={note} onChange={e => setNote(e.target.value)} maxLength={2000} placeholder="A correction or something to add. The report card itself doesn't change."/>
        </>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {manager && !adding && <button className="bg" onClick={() => setAdding(true)}>Add a note</button>}
        {adding && <button className="bp" onClick={addNote} disabled={busy || note.trim().length < 3}>{busy ? <Spinner/> : 'Save note'}</button>}
        <button className="bg" onClick={() => printReportCard(card, child, facility?.name, roomName)}>🖨 Print</button>
        <button className="bg" onClick={onClose} disabled={busy}>Close</button>
      </div>
    </Modal>
  );
}
