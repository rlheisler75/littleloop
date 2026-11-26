import { useState, useEffect } from 'react';
import AdminOverview    from './sections/AdminOverview';
import AdminSitters     from './sections/AdminSitters';
import AdminFamilies    from './sections/AdminFamilies';
import AdminInvoices    from './sections/AdminInvoices';
import AdminConnections from './sections/AdminConnections';
import AdminBgChecks    from './sections/AdminBgChecks';
import { supabase }     from '../lib/supabase';

const NAV = [
  { id: 'overview',     icon: '📊', label: 'Overview' },
  { id: 'sitters',      icon: '👤', label: 'Sitters' },
  { id: 'families',     icon: '👨‍👩‍👧', label: 'Families' },
  { id: 'invoices',     icon: '💰', label: 'Invoices' },
  { id: 'connections',  icon: '🔗', label: 'Connections' },
  { id: 'bgchecks',     icon: '🛡️', label: 'BG Checks' },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function AdminDashboard({ adminUser, onSignOut }) {
  const [section, setSection] = useState('overview');
  const [pendingBg, setPendingBg] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    async function checkPending() {
      const { count } = await supabase.from('sitters')
        .select('id', { count: 'exact', head: true })
        .eq('background_check', true)
        .not('background_check_doc_url', 'is', null)
        .eq('background_check_verified', false);
      setPendingBg(count || 0);
    }
    checkPending();
    const interval = setInterval(checkPending, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close sidebar when navigating on mobile
  function navigate(id) {
    setSection(id);
    setSidebarOpen(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0F1923', color: '#E4EAF4', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'rgba(0,0,0,.3)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'none', border: 'none', color: '#E4EAF4', fontSize: 20, cursor: 'pointer', padding: '4px 6px', lineHeight: 1 }}>
              ☰
            </button>
          )}
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#3A6FD4,#2550A8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🛡️</div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.2px' }}>littleloop</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginLeft: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>Admin</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isMobile && (
            <>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>{adminUser.name}</span>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: adminUser.role === 'super' ? 'rgba(58,111,212,.25)' : 'rgba(255,255,255,.08)', color: adminUser.role === 'super' ? '#7BAAEE' : 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{adminUser.role}</span>
            </>
          )}
          <button onClick={onSignOut} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Sign out</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Mobile sidebar overlay */}
        {isMobile && sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 30 }}/>
        )}

        {/* Sidebar */}
        <div style={{
          width: 200,
          borderRight: '1px solid rgba(255,255,255,.07)',
          padding: '16px 10px',
          flexShrink: 0,
          overflowY: 'auto',
          // Mobile: fixed drawer
          ...(isMobile ? {
            position: 'fixed',
            top: 56,
            left: 0,
            bottom: 0,
            zIndex: 31,
            background: '#0F1923',
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform .25s ease',
          } : {}),
        }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => navigate(n.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 2, background: section === n.id ? 'rgba(58,111,212,.2)' : 'transparent', color: section === n.id ? '#7BAAEE' : 'rgba(255,255,255,.45)', fontSize: 13, fontWeight: section === n.id ? 600 : 400, textAlign: 'left', transition: 'all .15s' }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.id === 'bgchecks' && pendingBg > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#F5924A', color: '#fff', borderRadius: 10, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                  {pendingBg}
                </span>
              )}
            </button>
          ))}
          {isMobile && (
            <div style={{ marginTop: 16, padding: '12px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 2 }}>{adminUser.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{adminUser.role}</div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px', minWidth: 0 }}>
          {section === 'overview'    && <AdminOverview/>}
          {section === 'sitters'     && <AdminSitters adminRole={adminUser.role}/>}
          {section === 'families'    && <AdminFamilies adminRole={adminUser.role}/>}
          {section === 'invoices'    && <AdminInvoices adminRole={adminUser.role}/>}
          {section === 'connections' && <AdminConnections adminRole={adminUser.role}/>}
          {section === 'bgchecks'    && <AdminBgChecks adminUser={adminUser} onVerified={() => setPendingBg(c => Math.max(0, c - 1))}/>}
        </div>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20, background: 'rgba(15,25,35,.97)', borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', backdropFilter: 'blur(20px)' }}>
          {NAV.slice(0, 5).map(n => (
            <button key={n.id} onClick={() => navigate(n.id)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 4px 10px', border: 'none', background: 'transparent', cursor: 'pointer', color: section === n.id ? '#7BAAEE' : 'rgba(255,255,255,.3)', position: 'relative' }}>
              <span style={{ fontSize: 18 }}>{n.icon}</span>
              <span style={{ fontSize: 9, fontWeight: section === n.id ? 600 : 400, letterSpacing: '.02em' }}>{n.label}</span>
              {n.id === 'bgchecks' && pendingBg > 0 && (
                <span style={{ position: 'absolute', top: 6, right: '50%', transform: 'translateX(10px)', fontSize: 9, fontWeight: 700, background: '#F5924A', color: '#fff', borderRadius: 10, padding: '1px 4px', minWidth: 14, textAlign: 'center' }}>
                  {pendingBg}
                </span>
              )}
            </button>
          ))}
          {/* BG Checks overflows into "more" — show as 6th if needed */}
          <button onClick={() => navigate('bgchecks')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 4px 10px', border: 'none', background: 'transparent', cursor: 'pointer', color: section === 'bgchecks' ? '#7BAAEE' : 'rgba(255,255,255,.3)', position: 'relative' }}>
            <span style={{ fontSize: 18 }}>🛡️</span>
            <span style={{ fontSize: 9, fontWeight: section === 'bgchecks' ? 600 : 400 }}>BG Checks</span>
            {pendingBg > 0 && (
              <span style={{ position: 'absolute', top: 6, right: '50%', transform: 'translateX(10px)', fontSize: 9, fontWeight: 700, background: '#F5924A', color: '#fff', borderRadius: 10, padding: '1px 4px', minWidth: 14, textAlign: 'center' }}>
                {pendingBg}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Bottom nav spacer */}
      {isMobile && <div style={{ height: 60 }}/>}
    </div>
  );
}
