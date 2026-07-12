import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
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
import AdminApp from './admin/AdminApp';
import LandingPage from './LandingPage';
import PaywallScreen from './components/auth/PaywallScreen';

const BILLABLE_STATUSES = ['active', 'trialing', 'free_founder'];

export default function App() {
  // Admin console — own auth, own app
  if (new URLSearchParams(window.location.search).has('admin')) return <><AdminApp/><Analytics /></>;

  const [session,      setSession]      = useState(undefined);
  const [userRole,     setUserRole]     = useState(null);
  const [inviteData,   setInviteData]   = useState(null);
  const [authPortal,   setAuthPortal]   = useState(null); // 'sitter' | 'parent' | null
  const [subStatus,    setSubStatus]    = useState(null); // null = loading, string = loaded
  const [subChecked,   setSubChecked]   = useState(false);

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
      // Reset sub check on sign-out so it re-checks on next login
      if (event === 'SIGNED_OUT') { setSubStatus(null); setSubChecked(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Check subscription status for sitters once we have a session
  useEffect(() => {
    if (!session || userRole !== 'sitter' || subChecked) return;

    // First check DB directly — fast path
    supabase
      .from('sitters')
      .select('subscription_status, subscription_plan')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        const status = data?.subscription_plan === 'free_founder'
          ? 'free_founder'
          : (data?.subscription_status || 'none');
        setSubStatus(status);
        setSubChecked(true);

        // If they have a Stripe customer but status is 'none', sync from Stripe in background
        if (status === 'none') {
          supabase.functions
            .invoke('billing', { method: 'GET', headers: {}, body: null })
            .catch(() => {});
          // Proper sync call
          fetch(
            `https://ukcxammnzhirxjdlqelr.supabase.co/functions/v1/billing?action=status`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          )
            .then(r => r.json())
            .then(d => {
              if (d?.subscription_status && d.subscription_status !== 'none') {
                setSubStatus(d.subscription_status);
              }
            })
            .catch(() => {});
        }
      });
  }, [session, userRole, subChecked]);

  // Handle ?subscribed=true redirect back from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('subscribed') && session && userRole === 'sitter') {
      // Force re-check subscription from Stripe
      setSubChecked(false);
      setSubStatus(null);
      // Clean the URL
      window.history.replaceState({}, '', '/');
    }
  }, [session, userRole]);

  const signOut = () => {
    setAuthPortal(null);
    supabase.auth.signOut();
  };

  const handleCheckoutComplete = () => {
    // Re-check subscription after returning from checkout
    setSubChecked(false);
    setSubStatus(null);
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
  if (userRole === '__reset__') return <><Bg/><ResetPasswordForm/><Analytics /></>;

  // ── Public routes — show even when logged in ─────────────────────────────────
  if (sitterParam) return <><Bg/><PublicSitterProfile username={sitterParam} session={session}/><Analytics /></>;
  if (browseParam) return <><Bg/><BrowseSitters session={session} familyId={null}/><Analytics /></>;

  // ── Invite welcome page ──────────────────────────────────────────────────────
  if (inviteToken && !inviteData && !session) return (
    <><Bg/><InviteWelcome token={inviteToken} onContinue={inv => setInviteData(inv)}/><Analytics /></>
  );

  // ── Auth wall ────────────────────────────────────────────────────────────────
  if (!session && (authPortal || inviteData)) return (
    <><Bg/><AuthForm portal={authPortal || (inviteData ? 'parent' : portal)} inviteData={inviteData} onBack={() => setAuthPortal(null)}/><Analytics /></>
  );

  // ── Landing page ─────────────────────────────────────────────────────────────
  if (!session) return (
    <>
      <LandingPage
        onSitterSignup={() => setAuthPortal('sitter')}
        onFamilySignup={() => setAuthPortal('parent')}
        onLogin={() => setAuthPortal('sitter')}
      />
      <Analytics />
    </>
  );

  // ── Authenticated: families always pass through ──────────────────────────────
  if (userRole === 'parent') return <><Bg/><ParentDashboard session={session} onSignOut={signOut}/><Analytics /></>;

  // ── Authenticated sitter: check subscription ─────────────────────────────────
  // Show spinner while we fetch subscription status
  if (userRole === 'sitter' && !subChecked) return (
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

  // Paywall gate — block sitters without an active subscription
  if (userRole === 'sitter' && !BILLABLE_STATUSES.includes(subStatus)) {
    return (
      <>
        <Bg/>
        <PaywallScreen
          session={session}
          onSignOut={signOut}
          onComplete={handleCheckoutComplete}
        />
        <Analytics />
      </>
    );
  }

  return <><Bg/><SitterDashboard session={session} onSignOut={signOut}/><Analytics /></>;
}
