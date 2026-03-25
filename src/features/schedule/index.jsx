import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { invokeNotification, sendPushNotification } from '../../services/push';
import { fmt12 } from '../../services/format';
import { DAYS, ETA_OPTIONS } from '../../lib/constants';
import { ScheduleSlotModal } from '../../components/modals/LeaveReviewModal';
import SectionLabel from '../../components/ui/SectionLabel';
import Spinner from '../../components/ui/Spinner';

// ─── Schedule manager (sitter side) ──────────────────────────────────────────

export function ScheduleManager({ sitterId, familyId, familyName }) {
  const [slots,    setSlots]    = useState([]);
  const [showAdd,  setShowAdd]  = useState(false);
  const [editSlot, setEditSlot] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => { load(); }, [familyId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('schedules').select('*')
      .eq('family_id', familyId).eq('sitter_id', sitterId).eq('active', true)
      .order('day_of_week').order('start_time');
    setSlots(data || []);
    setLoading(false);
  }

  async function deleteSlot(id) {
    await supabase.from('schedules').delete().eq('id', id);
    load();
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <SectionLabel>📅 Recurring Schedule</SectionLabel>
        <button className="bp" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => { setEditSlot(null); setShowAdd(true); }}>+ Add</button>
      </div>

      {loading
        ? <Spinner/>
        : slots.length === 0
          ? <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', padding: '8px 0' }}>No recurring schedule set yet.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {slots.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(58,111,212,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#7BAAEE', flexShrink: 0 }}>
                    {DAYS[s.day_of_week]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{fmt12(s.start_time)} – {fmt12(s.end_time)}</div>
                    {s.label && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{s.label}</div>}
                  </div>
                  <button onClick={() => { setEditSlot(s); setShowAdd(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: .5, padding: '0 4px' }}>✏️</button>
                  <button onClick={() => deleteSlot(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: .5, padding: '0 4px' }}>🗑️</button>
                </div>
              ))}
            </div>
          )
      }

      <ScheduleSlotModal open={showAdd} onClose={() => { setShowAdd(false); setEditSlot(null); }}
        sitterId={sitterId} familyId={familyId} slot={editSlot}
        onSaved={() => { setShowAdd(false); setEditSlot(null); load(); }}/>
    </div>
  );
}

// ─── Weekly schedule card (parent side) ──────────────────────────────────────

export function WeeklyScheduleCard({ familyId, sitters }) {
  const [slots,   setSlots]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [familyId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('schedules').select('*')
      .eq('family_id', familyId).eq('active', true)
      .order('day_of_week').order('start_time');
    setSlots(data || []);
    setLoading(false);
  }

  if (loading || !slots.length) return null;

  const today    = new Date();
  const week     = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return { dow: d.getDay(), date: d, label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAYS[d.getDay()] };
  });

  const byDow = {};
  slots.forEach(s => { if (!byDow[s.day_of_week]) byDow[s.day_of_week] = []; byDow[s.day_of_week].push(s); });
  const upcoming = week.filter(d => byDow[d.dow]);
  if (!upcoming.length) return null;

  return (
    <div className="card fade-up" style={{ padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>📅</span>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17, fontWeight: 600 }}>This Week</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {upcoming.map(({ dow, date, label: dayLabel }) =>
          (byDow[dow] || []).map(s => {
            const sitter  = (sitters || []).find(st => st.id === s.sitter_id);
            const isToday = dayLabel === 'Today';
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: isToday ? 'rgba(58,111,212,.1)' : 'var(--input-bg)', border: isToday ? '1px solid rgba(58,111,212,.3)' : '1px solid var(--border)' }}>
                <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: .5 }}>{DAYS[dow]}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: isToday ? '#7BAAEE' : 'var(--text-dim)', lineHeight: 1.2 }}>{date.getDate()}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {fmt12(s.start_time)} – {fmt12(s.end_time)}
                    {isToday && <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(58,111,212,.2)', color: '#7BAAEE', borderRadius: 4, padding: '1px 6px' }}>Today</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{sitter?.name || 'Sitter'}{s.label && ` · ${s.label}`}</div>
                </div>
                {sitter?.avatar_url
                  ? <img src={sitter.avatar_url} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt={sitter.name}/>
                  : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3A6FD4,#3A9E7A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>➿</div>
                }
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── On My Way button (family side) ──────────────────────────────────────────

export function OnMyWayButton({ familyId, memberId, memberName }) {
  const [expanded, setExpanded] = useState(false);
  const [sent,     setSent]     = useState(false);
  const [current,  setCurrent]  = useState(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    async function loadETA() {
      const { data } = await supabase.from('eta_notifications').select('*')
        .eq('family_id', familyId).eq('member_id', memberId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      setCurrent(data || null);
    }
    if (familyId && memberId) loadETA();
  }, [familyId, memberId]);

  async function send(minutes) {
    setLoading(true);
    const expires  = new Date(Date.now() + Math.max(minutes * 2, 120) * 60 * 1000).toISOString();
    const eta_time = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const { data, error } = await supabase.from('eta_notifications').insert({
      family_id: familyId, member_id: memberId, member_name: memberName,
      eta_minutes: minutes, eta_time, expires_at: expires,
    }).select().single();
    setLoading(false);
    if (!error) {
      setCurrent(data);
      setSent(true);
      setExpanded(false);
      setTimeout(() => setSent(false), 3000);
      const { data: fsRows } = await supabase.from('family_sitters').select('sitter_id').eq('family_id', familyId).eq('status', 'active');
      if (fsRows?.length) {
        const sitterIds = fsRows.map(r => r.sitter_id);
        sendPushNotification(sitterIds, `${memberName} is on the way!`, `ETA: ~${minutes} min`, '/?portal=sitter', 'eta');
        invokeNotification({ body: { type: 'eta', payload: { sitterIds, memberName, minutes, familyId } } }).catch(console.error);
      }
    }
  }

  async function cancel() {
    if (!current) return;
    await supabase.from('eta_notifications').delete().eq('id', current.id);
    setCurrent(null);
  }

  if (current) {
    const etaTime  = new Date(current.eta_time);
    const minsLeft = Math.max(0, Math.round((etaTime - Date.now()) / 60000));
    return (
      <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(58,158,122,.1)', border: '1px solid rgba(94,207,170,.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🚗</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#5ECFAA' }}>On the way!</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{minsLeft > 0 ? `~${minsLeft} min away` : 'Arriving soon'}</div>
          </div>
        </div>
        <button onClick={cancel} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-faint)', cursor: 'pointer', textDecoration: 'underline' }}>Cancel</button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      {!expanded
        ? <button onClick={() => setExpanded(true)} style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(94,207,170,.3)', background: 'rgba(58,158,122,.08)', color: '#5ECFAA', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span>🚗</span>{sent ? 'Sitter notified! ✓' : 'On My Way — notify sitter'}
          </button>
        : <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(94,207,170,.3)', background: 'rgba(58,158,122,.06)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#5ECFAA', marginBottom: 10 }}>How far away are you?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {ETA_OPTIONS.map(o => (
                <button key={o.minutes} onClick={() => send(o.minutes)} disabled={loading}
                  style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid rgba(94,207,170,.3)', background: 'rgba(58,158,122,.1)', color: '#5ECFAA', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {loading ? <Spinner size={10}/> : o.label}
                </button>
              ))}
            </div>
            <button onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-faint)', cursor: 'pointer' }}>Cancel</button>
          </div>
      }
    </div>
  );
}
