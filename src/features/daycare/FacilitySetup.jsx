import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoopMark from '../../components/ui/LoopMark';
import Spinner from '../../components/ui/Spinner';
import { STARTER_ROOMS, errText } from './api';

// First sign-in with a daycare account and no daycare yet: create one (you become its
// director), or, for staff, wait for the director's invite.
export default function FacilitySetup({ session, onCreated, onRecheck, onSignOut }) {
  const [name,    setName]    = useState('');
  const [phone,   setPhone]   = useState('');
  const [city,    setCity]    = useState('');
  const [state,   setState]   = useState('');
  const [rooms,   setRooms]   = useState(STARTER_ROOMS.map(r => r.name));
  const [saving,  setSaving]  = useState(false);
  const [alert,   setAlert]   = useState(null);
  const [checking, setChecking] = useState(false);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) { setAlert('Enter your daycare\'s name.'); return; }
    setSaving(true); setAlert(null);
    const { data: facilityId, error } = await supabase.rpc('create_facility', {
      p_name: name.trim(), p_phone: phone.trim() || null, p_city: city.trim() || null, p_state: state.trim() || null,
    });
    if (error) { setAlert(errText(error)); setSaving(false); return; }
    const picked = STARTER_ROOMS.filter(r => rooms.includes(r.name));
    if (picked.length) {
      const { error: roomErr } = await supabase.from('classrooms')
        .insert(picked.map((r, i) => ({ ...r, facility_id: facilityId, sort: i })));
      if (roomErr) console.error('starter classrooms failed:', roomErr);
    }
    onCreated(facilityId);
  }

  async function recheck() {
    setChecking(true);
    await onRecheck();
    setChecking(false);
  }

  const toggleRoom = n => setRooms(r => r.includes(n) ? r.filter(x => x !== n) : [...r, n]);

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="leaf" style={{ marginBottom: 8 }}><LoopMark size={36}/></div>
          <div className="logo-text" style={{ fontSize: 28, marginBottom: 4 }}>littleloop</div>
          <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Daycare setup</div>
        </div>

        <div className="card" style={{ padding: '28px 24px', marginBottom: 14 }}>
          <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Set up your daycare</div>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 20, lineHeight: 1.6 }}>
            You'll be its director. You can invite your staff and enroll families next.
          </p>
          {alert && <div className="al al-e" style={{ marginBottom: 14 }}>{alert}</div>}
          <form onSubmit={create}>
            <label className="fl">Daycare name</label>
            <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="Sunshine Learning Center" maxLength={120} autoFocus/>
            <label className="fl">Phone (optional)</label>
            <input className="fi" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(417) 555-0100" maxLength={40} inputMode="tel"/>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
              <div>
                <label className="fl">City (optional)</label>
                <input className="fi" value={city} onChange={e => setCity(e.target.value)} maxLength={100}/>
              </div>
              <div>
                <label className="fl">State</label>
                <input className="fi" value={state} onChange={e => setState(e.target.value)} maxLength={40} placeholder="MO"/>
              </div>
            </div>

            <label className="fl">Start with these classrooms</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
              {STARTER_ROOMS.map(r => (
                <label key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--input-bg)', cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={rooms.includes(r.name)} onChange={() => toggleRoom(r.name)}/>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }}/>
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>{r.age_group} · 1:{r.ratio}</span>
                </label>
              ))}
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>You can rename them and set your state's ratios later.</div>
            </div>

            <button type="submit" className="bp full" disabled={saving || !name.trim()}>
              {saving ? <><Spinner/> Creating…</> : 'Create my daycare'}
            </button>
          </form>
        </div>

        <div className="card" style={{ padding: '18px 20px', fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          <strong>Work at a daycare?</strong> Ask your director to invite <strong>{session.user.email}</strong>.
          <div style={{ marginTop: 10 }}>
            <button className="bg" onClick={recheck} disabled={checking} style={{ fontSize: 12, padding: '6px 12px' }}>
              {checking ? <Spinner size={12}/> : 'I was invited, check again'}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button onClick={onSignOut} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
