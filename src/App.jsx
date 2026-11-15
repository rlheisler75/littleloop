import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { supabase } from './lib/supabase';
import { applyTheme } from './lib/theme';
import { CSS } from './styles/global';
import { getPortal, getInviteToken, getSitterParam, getBrowseParam, rememberRef } from './lib/utils';
import Bg from './components/ui/Bg';
import Spinner from './components/ui/Spinner';
import AuthForm from './components/auth/AuthForm';
import InviteWelcome from './components/auth/InviteWelcome';
import ResetPasswordForm from './components/auth/ResetPasswordForm';
import { PublicSitterProfile, BrowseSitters } from './features/profile/index';
import SitterDashboard from './SitterDashboard';
import ParentDashboard from './ParentDashboard';
import AdminApp from './admin/AdminApp';

rememberRef(); // keep ?ref= from a referral link until signup
import LandingPage from './LandingPage';

export default function App() {
  // Admin console — own auth, own app
  if (new URLSearchParams(window.location.search).has('admin')) return <><AdminApp/><Analytics /></>;

  const [session,      setSession]      = useState(undefined);
  const [userRole,     setUserRole]     = useState(null);
  const [inviteData,   setInviteData]   = useState(null);
  // ?portal=parent|sitter (e.g. from an invite email) opens straight to sign-in.
  const [authPortal,   setAuthPortal]   = useState(() => {
    const p = new URLSearchParams(window.location.search).get('portal');
    return p === 'parent' || p === 'sitter' ? p : null;
  }); // 'sitter' | 'parent' | null
  const [authMode,     setAuthMode]     = useState('login'); // 'login' | 'signup'

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

  const signOut = () => {
    setAuthPortal(null);
    supabase.auth.signOut();
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (session === undefined) return (
    <>
      <Bg/>
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="leaf" style={{ fontSize: 40, marginBottom: 12 }}>➿</div>
          <Spinner size={20}/>
        </div>
      </div>
      <Analytics />
    </>
  );

  // ── Password reset ───────────────────────────────────────────────────────────
  if (userRole === '__reset__') return <><ResetPasswordForm/><Analytics /></>;

  // ── Public routes — show even when logged in ─────────────────────────────────
  if (sitterParam) return <><Bg/><PublicSitterProfile username={sitterParam} session={session}/><Analytics /></>;
  if (browseParam) return <><Bg/><BrowseSitters session={session} familyId={null}/><Analytics /></>;

  // ── Invite welcome page ──────────────────────────────────────────────────────
  if (inviteToken && !inviteData && !session) return (
    <><InviteWelcome token={inviteToken} onContinue={inv => setInviteData(inv)}/><Analytics /></>
  );

  // ── Auth wall ────────────────────────────────────────────────────────────────
  if (!session && (authPortal || inviteData)) return (
    <><AuthForm portal={authPortal || (inviteData ? 'parent' : portal)} inviteData={inviteData} initialMode={authMode} onBack={() => setAuthPortal(null)}/><Analytics /></>
  );

  // ── Landing page ─────────────────────────────────────────────────────────────
  if (!session) return (
    <>
      <LandingPage
        onSitterSignup={() => { setAuthMode('signup'); setAuthPortal('sitter'); }}
        onFamilySignup={() => { setAuthMode('signup'); setAuthPortal('parent'); }}
        onLogin={() => { setAuthMode('login'); setAuthPortal('sitter'); }}
      />
      <Analytics />
    </>
  );

  // ── Authenticated: families always pass through ──────────────────────────────
  if (userRole === 'parent') return <><Bg/><ParentDashboard session={session} onSignOut={signOut}/><Analytics /></>;

  return <><Bg/><SitterDashboard session={session} onSignOut={signOut}/><Analytics /></>;
}
