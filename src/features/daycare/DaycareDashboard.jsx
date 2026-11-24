import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import LoopMark from '../../components/ui/LoopMark';
import Spinner from '../../components/ui/Spinner';
import Bg from '../../components/ui/Bg';
import { NotificationCenter } from '../notifications/index';
import FacilitySetup from './FacilitySetup';
import TodayBoard from './TodayBoard';
import DaycareFamilies from './DaycareFamilies';
import DaycareFeed from './DaycareFeed';
import ClassroomsTab from './ClassroomsTab';
import StaffTab from './StaffTab';
import CenterTab from './CenterTab';
import { isManagerRole, roleLabel } from './api';

// Staff side of a daycare: one dashboard per daycare the user works at.
export default function DaycareDashboard({ session, onSignOut, switchTo = null }) {
  const userId = session.user.id;
  const [rows,     setRows]     = useState(null);   // my active facility_staff rows with facilities
  const [current,  setCurrent]  = useState(() => { try { return localStorage.getItem(`ll_facility_${userId}`); } catch { return null; } });
  const [tab,      setTab]      = useState('today');

  const load = useCallback(async () => {
    await supabase.rpc('claim_staff_invites');
    const { data, error } = await supabase.from('facility_staff')
      .select('id, role, name, facility_id, facilities(*)')
      .eq('user_id', userId).eq('status', 'active')
      .order('created_at');
    if (error) console.error('load daycares failed:', error);
    setRows((data || []).filter(r => r.facilities));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const me = rows?.find(r => r.facility_id === current) || rows?.[0] || null;
  useEffect(() => {
    if (me) { try { localStorage.setItem(`ll_facility_${userId}`, me.facility_id); } catch {} }
  }, [me?.facility_id, userId]);

  if (rows === null) return (
    <><Bg/><div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={28}/></div></>
  );

  if (!me) return (
    <><Bg/><FacilitySetup session={session} onSignOut={onSignOut} onRecheck={load}
      onCreated={id => { setCurrent(id); setTab('today'); load(); }}/></>
  );

  const facility  = me.facilities;
  const manager   = isManagerRole(me.role);
  const director  = me.role === 'director';
  const myName    = me.name || session.user.user_metadata?.name || session.user.email.split('@')[0];

  const NAV = [
    { id: 'today',      icon: '🏫', label: 'Today' },
    { id: 'families',   icon: '👨‍👩‍👧', label: 'Families' },
    { id: 'feed',       icon: '🌸', label: 'Updates' },
    ...(manager ? [
      { id: 'classrooms', icon: '🧸', label: 'Rooms' },
      { id: 'staff',      icon: '👥', label: 'Staff' },
    ] : []),
    { id: 'center',     icon: '⚙️', label: 'Center' },
  ];
  const activeTab = NAV.some(n => n.id === tab) ? tab : 'today';
  const props = { facility, facilityId: facility.id, me, myName, manager, director, userId, onFacilityChanged: load };

  return (
    <>
      <Bg/>
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: '1px solid var(--border)', background: 'var(--nav-bg,rgba(0,0,0,.2))', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <LoopMark size={20}/>
            <div style={{ minWidth: 0 }}>
              <div className="logo-text" style={{ fontSize: 18, lineHeight: 1.1 }}>littleloop</div>
              {rows.length > 1 ? (
                <select value={facility.id} onChange={e => setCurrent(e.target.value)} aria-label="Daycare"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: 12, fontWeight: 700, padding: 0, maxWidth: 200 }}>
                  {rows.map(r => <option key={r.facility_id} value={r.facility_id}>{r.facilities.name}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                  {facility.name} · {roleLabel(me.role)}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {switchTo && <button className="bg" style={{ padding: '6px 10px', fontSize: 12 }} onClick={switchTo.onClick}>{switchTo.label}</button>}
            <NotificationCenter userId={userId}/>
            <button className="bg" style={{ padding: '6px 12px', fontSize: 12 }} onClick={onSignOut}>Sign out</button>
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--nav-bg,rgba(0,0,0,.15))', overflowX: 'auto' }}>
          {NAV.map(n => (
            <div key={n.id} className={`nav-tab ${activeTab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
              <span style={{ fontSize: 18 }}>{n.icon}</span>
              <span>{n.label}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, padding: '16px 14px', maxWidth: 960, width: '100%', margin: '0 auto' }}>
          {activeTab === 'today'      && <TodayBoard {...props} onGoTo={setTab}/>}
          {activeTab === 'families'   && <DaycareFamilies {...props}/>}
          {activeTab === 'feed'       && <DaycareFeed {...props}/>}
          {activeTab === 'classrooms' && <ClassroomsTab {...props}/>}
          {activeTab === 'staff'      && <StaffTab {...props}/>}
          {activeTab === 'center'     && <CenterTab {...props}/>}
        </div>
      </div>
    </>
  );
}
