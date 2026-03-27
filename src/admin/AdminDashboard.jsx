import { useState } from 'react';
import AdminOverview   from './sections/AdminOverview';
import AdminSitters    from './sections/AdminSitters';
import AdminFamilies   from './sections/AdminFamilies';
import AdminInvoices   from './sections/AdminInvoices';
import AdminConnections from './sections/AdminConnections';

const NAV = [
  { id: 'overview',     icon: '📊', label: 'Overview' },
  { id: 'sitters',      icon: '👤', label: 'Sitters' },
  { id: 'families',     icon: '👨‍👩‍👧', label: 'Families' },
  { id: 'invoices',     icon: '💰', label: 'Invoices' },
  { id: 'connections',  icon: '🔗', label: 'Connections' },
];

export default function AdminDashboard({ adminUser, onSignOut }) {
  const [section, setSection] = useState('overview');

  return (
    <div style={{ minHeight: '100vh', background: '#0F1923', color: '#E4EAF4', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'rgba(0,0,0,.3)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#3A6FD4,#2550A8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🛡️</div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.2px' }}>littleloop</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginLeft: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>Admin</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>{adminUser.name}</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: adminUser.role === 'super' ? 'rgba(58,111,212,.25)' : 'rgba(255,255,255,.08)', color: adminUser.role === 'super' ? '#7BAAEE' : 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{adminUser.role}</span>
          <button onClick={onSignOut} style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{ width: 200, borderRight: '1px solid rgba(255,255,255,.07)', padding: '16px 10px', flexShrink: 0, overflowY: 'auto' }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setSection(n.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 2, background: section === n.id ? 'rgba(58,111,212,.2)' : 'transparent', color: section === n.id ? '#7BAAEE' : 'rgba(255,255,255,.45)', fontSize: 13, fontWeight: section === n.id ? 600 : 400, textAlign: 'left', transition: 'all .15s' }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {section === 'overview'    && <AdminOverview/>}
          {section === 'sitters'     && <AdminSitters adminRole={adminUser.role}/>}
          {section === 'families'    && <AdminFamilies adminRole={adminUser.role}/>}
          {section === 'invoices'    && <AdminInvoices adminRole={adminUser.role}/>}
          {section === 'connections' && <AdminConnections adminRole={adminUser.role}/>}
        </div>
      </div>
    </div>
  );
}
