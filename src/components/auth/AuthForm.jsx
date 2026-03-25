import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Field from '../ui/Field';
import Spinner from '../ui/Spinner';

export default function AuthForm({ portal, inviteData }) {
  const isParent = portal === 'parent';

  const [mode,     setMode]     = useState(inviteData ? 'signup' : 'login');
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState(inviteData?.admin_email || '');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [alert,    setAlert]    = useState(null);

  useEffect(() => {
    const p   = new URLSearchParams(window.location.search);
    const inv = p.get('email');
    if (inv) { setEmail(inv); setMode('signup'); }
  }, []);

  function sw(m) {
    setMode(m);
    setAlert(null);
    setName('');
    setEmail('');
    setPassword('');
    setConfirm('');
  }

  async function submit(e) {
    e.preventDefault();
    setAlert(null);

    if (mode === 'signup') {
      if (password.length < 8) { setAlert({ t: 'e', m: 'Password must be at least 8 characters.' }); return; }
      if (password !== confirm) { setAlert({ t: 'e', m: "Passwords don't match." }); return; }
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { role: isParent ? 'parent' : 'sitter', name } },
        });
        if (error) throw error;
        setAlert({ t: 's', m: 'Account created! Check your email to confirm, then sign in.' });
        setTimeout(() => sw('login'), 3500);

      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'https://littleloop.xyz/reset-password',
        });
        if (error) throw error;
        setAlert({ t: 's', m: 'Reset link sent — check your inbox.' });
      }
    } catch (err) {
      const m = err.message || '';
      if (m.includes('Invalid login credentials'))  setAlert({ t: 'e', m: 'Incorrect email or password.' });
      else if (m.includes('User already registered')) setAlert({ t: 'e', m: 'An account with that email already exists.' });
      else if (m.includes('Email not confirmed'))     setAlert({ t: 'i', m: 'Please confirm your email first.' });
      else setAlert({ t: 'e', m: m || 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="leaf" style={{ fontSize: 46, marginBottom: 10, filter: 'drop-shadow(0 0 20px rgba(58,158,122,.45))' }}>➿</div>
          <div className="logo-text">littleloop</div>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8, letterSpacing: '.04em' }}>
            Independent childcare, thoughtfully connected.
          </p>
        </div>

        <div className="card fade-up d1" style={{ padding: '32px 28px' }}>
          <div className="fade-up d2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: isParent ? 'linear-gradient(135deg,#3A9E7A,#2A7A5A)' : 'linear-gradient(135deg,#3A6FD4,#3A9E7A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              {isParent ? '👨‍👩‍👧' : '➿'}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
              {isParent ? 'Family Portal' : 'Sitter Portal'}
            </span>
          </div>

          {mode !== 'forgot' && (
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.07)', marginBottom: 26 }} className="fade-up d2">
              <div className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => sw('login')}>Sign In</div>
              <div className={`tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => sw('signup')}>Create Account</div>
            </div>
          )}

          {mode === 'forgot' && (
            <div className="fade-up" style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Reset password</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>We'll email you a link to choose a new one.</div>
            </div>
          )}

          {alert && <div className={`al al-${alert.t} fade-up`}>{alert.m}</div>}

          {isParent && mode === 'signup' && !inviteData && (
            <div className="al al-i" style={{ marginBottom: 16 }}>
              💡 Sign up with the email your sitter used to invite you and you'll be automatically connected to your family.
            </div>
          )}
          {inviteData && (
            <div className="al al-s" style={{ marginBottom: 16 }}>
              ➿ Creating your account for <strong>{inviteData.family_name}</strong>. Use {inviteData.admin_email} to auto-connect.
            </div>
          )}

          <form onSubmit={submit}>
            {mode === 'signup' && (
              <div className="fade-up d2">
                <Field
                  label="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={isParent ? 'Sarah Chen' : 'Maya Rodriguez'}
                  autoComplete="name"
                />
              </div>
            )}
            <div className="fade-up d3">
              <Field label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/>
            </div>
            {mode !== 'forgot' && (
              <div className="fade-up d4">
                <Field label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/>
              </div>
            )}
            {mode === 'signup' && (
              <div className="fade-up d5">
                <Field label="Confirm password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password"/>
              </div>
            )}
            <div className="fade-up d5" style={{ marginTop: 4 }}>
              <button type="submit" className="bp full" disabled={loading}>
                {loading
                  ? <><Spinner/> Please wait…</>
                  : mode === 'signup'
                    ? `Create ${isParent ? 'Family' : 'Sitter'} Account`
                    : mode === 'forgot'
                      ? 'Send Reset Link'
                      : 'Sign In'
                }
              </button>
            </div>
          </form>

          <div className="fade-up d6" style={{ textAlign: 'center', marginTop: 16 }}>
            {mode === 'login'  && <span style={{ fontSize: 12, color: 'rgba(111,163,232,.75)', cursor: 'pointer' }} onClick={() => sw('forgot')}>Forgot your password?</span>}
            {mode === 'forgot' && <span style={{ fontSize: 12, color: 'rgba(111,163,232,.75)', cursor: 'pointer' }} onClick={() => sw('login')}>← Back to sign in</span>}
          </div>
        </div>

        <p className="fade-up d6" style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--text-faint)' }}>
          {isParent
            ? <> Are you a sitter? <a href="/" style={{ color: 'rgba(111,163,232,.6)', textDecoration: 'none' }}>Sitter sign in →</a></>
            : <> Are you a family member? <a href="/?portal=parent" style={{ color: 'rgba(111,163,232,.6)', textDecoration: 'none' }}>Family sign in →</a></>
          }
        </p>

      </div>
    </div>
  );
}
