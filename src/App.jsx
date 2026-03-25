import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { applyTheme } from './lib/theme';
import { CSS } from './styles/global';
import { getPortal, getInviteToken, getSitterParam, getBrowseParam } from './lib/utils';
import Bg from './components/ui/Bg';
import Spinner from './components/ui/Spinner';
import AuthForm from './components/auth/AuthForm';
import InviteWelcome from './components/auth/InviteWelcome';
import ResetPasswordForm from './components/auth/ResetPasswordForm';
import { PublicSitterProfile, BrowseSitters } from './features/profile/index';
import SitterDashboard from './SitterDashboard';
import ParentDashboard from './ParentDashboard';

export default function App() {
  const [session,    setSession]    = useState(undefined);
  const [userRole,   setUserRole]   = useState(null);
  const [inviteData, setInviteData] = useState(null);

  const portal      = getPortal();
  const inviteToken = getInviteToken();
  const sitterParam = getSitterParam();
  const browseParam = getBrowseParam();

  // Inject global CSS once
  useEffect(() => {
    const tag = document.createElement('style');
    tag.textContent = CSS;
    document.head.appendChild(tag);
    applyTheme(localStorage.getItem('ll_theme') || 'midnight');
    return () => document.head.removeChild(tag);
  }, []);

  // Auth state
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setUserRole('__reset__');
      supabase.auth.getSession().then(({ data: { session } }) => setSession(session ?? null));
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
      if (session) setUserRole(session.user.user_metadata?.role || 'sitter');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session ?? null);
      if (session) setUserRole(session.user.user_metadata?.role || 'sitter');
      if (event === 'PASSWORD_RECOVERY') setUserRole('__reset__');
      if (event === 'TOKEN_REFRESHED' && !session) {
        Object.keys(localStorage).filter(k => k.startsWith('sb-') || k.startsWith('ll_')).forEach(k => localStorage.removeItem(k));
        window.location.reload();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = () => supabase.auth.signOut();

  // Loading
  if (session === undefined) return (
    <>
      <Bg/>
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="leaf" style={{ fontSize: 40, marginBottom: 12 }}>➿</div>
          <Spinner size={20}/>
        </div>
      </div>
    </>
  );

  // Password reset
  if (userRole === '__reset__') return <><Bg/><ResetPasswordForm/></>;

  // Public routes — no auth required
  if (sitterParam) return <><Bg/><PublicSitterProfile username={sitterParam}/></>;
  if (browseParam) return <><Bg/><BrowseSitters/></>;

  // Invite welcome page
  if (inviteToken && !inviteData && !session) return (
    <><Bg/><InviteWelcome token={inviteToken} onContinue={inv => setInviteData(inv)}/></>
  );

  // Auth wall
  if (!session) return <><Bg/><AuthForm portal={inviteData ? 'parent' : portal} inviteData={inviteData}/></>;

  // Authenticated
  if (userRole === 'parent') return <><Bg/><ParentDashboard session={session} onSignOut={signOut}/></>;
  return <><Bg/><SitterDashboard session={session} onSignOut={signOut}/></>;
}
