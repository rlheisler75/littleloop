import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

export default function AdminApp() {
  const [session,   setSession]   = useState(undefined);
  const [adminUser, setAdminUser] = useState(null);
  const [checking,  setChecking]  = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
      if (session) checkAdmin(session.user.id);
      else setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session ?? null);
      if (session) checkAdmin(session.user.id);
      else { setAdminUser(null); setChecking(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function checkAdmin(userId) {
    setChecking(true);
    const { data } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setAdminUser(data || null);
    setChecking(false);
  }

  const signOut = () => supabase.auth.signOut();

  if (session === undefined || checking) return <AdminLoading/>;

  // Not logged in — show admin login
  if (!session) return <AdminLogin/>;

  // Logged in but not an admin — block access
  if (!adminUser) return <AdminBlocked onSignOut={signOut}/>;

  return <AdminDashboard adminUser={adminUser} onSignOut={signOut}/>;
}

function AdminLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F1923', color: '#E4EAF4' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🛡️</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Loading…</div>
      </div>
    </div>
  );
}

function AdminBlocked({ onSignOut }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F1923', color: '#E4EAF4', padding: 20 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🚫</div>
        <div style={{ fontFamily: 'serif', fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Access Denied</div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 24, lineHeight: 1.6 }}>
          This account doesn't have admin access to littleloop.
        </p>
        <button onClick={onSignOut} style={{ padding: '10px 24px', borderRadius: 8, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)', color: '#E4EAF4', fontSize: 13, cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
