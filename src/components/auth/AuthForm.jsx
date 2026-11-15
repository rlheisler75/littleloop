import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../ui/Spinner';
import { getStoredRef } from '../../lib/utils';
import AuthShell from './AuthShell';


export default function AuthForm({ portal, inviteData, initialMode = 'login', onBack }) {
  // Role only matters when creating an account; sign-in is the same for sitters and families.
  const [role,     setRole]     = useState(inviteData || portal === 'parent' ? 'parent' : 'sitter');
  const isParent = role === 'parent';

  const [mode,     setMode]     = useState(inviteData ? 'signup' : initialMode);
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
        const ref = getStoredRef();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { role: isParent ? 'parent' : 'sitter', name, ...(ref ? { ref } : {}) } },
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
        setAlert({ t: 's', m: 'Reset link sent. Check your inbox.' });
      }
    } catch (err) {
      const m = err.message || '';
      if (m.includes('Invalid login credentials'))  setAlert({ t: 'e', m: 'Incorrect email or password.' });
      else if (m.includes('User already registered')) setAlert({ t: 'e', m: 'An account with that email already exists. Try signing in.' });
      else if (m.includes('Email not confirmed'))     setAlert({ t: 'i', m: 'Please confirm your email first.' });
      else setAlert({ t: 'e', m: m || 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  }

  const input = (label, props) => (
    <div className="ll-auth-field">
      <label className="ll-auth-label">{label}</label>
      <input className="ll-auth-input" required {...props}/>
    </div>
  );

  const heading = mode === 'login'
    ? ['Welcome back!', 'Sitters and parents both sign in here.']
    : mode === 'forgot'
      ? ['Reset your password', "We'll email you a link to choose a new one."]
      : inviteData
        ? ['Join your family', <>Creating your parent account for <strong>{inviteData.family_name}</strong>.</>]
        : ['Create your account', 'First, tell us who you are.'];

  return (
    <AuthShell onBack={onBack}>
          {mode !== 'forgot' && !inviteData && (
            <div className="ll-auth-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={mode === 'login'}  className={`ll-auth-tab ${mode === 'login' ? 'on' : ''}`}  onClick={() => sw('login')}>Sign in</button>
              <button type="button" role="tab" aria-selected={mode === 'signup'} className={`ll-auth-tab ${mode === 'signup' ? 'on' : ''}`} onClick={() => sw('signup')}>Create account</button>
            </div>
          )}

          <h1 className="ll-auth-title">{heading[0]}</h1>
          <p className="ll-auth-sub">{heading[1]}</p>

          {mode === 'signup' && !inviteData && (
            <div className="ll-auth-roles">
              {[
                ['sitter', '🧸', "I'm a sitter", 'I care for kids'],
                ['parent', '👨‍👩‍👧', "I'm a parent", 'My kids are cared for'],
              ].map(([value, icon, title, sub]) => (
                <button key={value} type="button" aria-pressed={role === value}
                  className={`ll-auth-role ${role === value ? 'on' : ''}`} onClick={() => setRole(value)}>
                  <div className="i">{icon}</div>
                  <div className="t">{title}</div>
                  <div className="s">{sub}</div>
                </button>
              ))}
            </div>
          )}

          {alert && <div className={`ll-auth-note ${alert.t}`}>{alert.m}</div>}

          {mode === 'signup' && isParent && !inviteData && (
            <div className="ll-auth-note i">
              💡 Use the email your sitter invited, and you'll be connected to your family automatically.
            </div>
          )}
          {inviteData && (
            <div className="ll-auth-note s">
              Use <strong>{inviteData.admin_email}</strong> to connect automatically.
            </div>
          )}

          <form onSubmit={submit}>
            {mode === 'signup' && input('Your name', {
              value: name, onChange: e => setName(e.target.value),
              placeholder: isParent ? 'Sarah Chen' : 'Maya Rodriguez', autoComplete: 'name',
            })}
            {input('Email address', {
              type: 'email', value: email, onChange: e => setEmail(e.target.value),
              placeholder: 'you@example.com', autoComplete: 'email',
            })}
            {mode !== 'forgot' && input('Password', {
              type: 'password', value: password, onChange: e => setPassword(e.target.value),
              placeholder: mode === 'signup' ? 'At least 8 characters' : '••••••••',
              autoComplete: mode === 'login' ? 'current-password' : 'new-password',
            })}
            {mode === 'signup' && input('Confirm password', {
              type: 'password', value: confirm, onChange: e => setConfirm(e.target.value),
              placeholder: '••••••••', autoComplete: 'new-password',
            })}

            <button type="submit" className="ll-auth-btn" disabled={loading}>
              {loading
                ? <><Spinner/> Please wait…</>
                : mode === 'signup'
                  ? `Create ${isParent ? 'parent' : 'sitter'} account`
                  : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
            </button>
          </form>

          <div className="ll-auth-foot">
            {mode === 'login'  && <button className="ll-auth-link" onClick={() => sw('forgot')}>Forgot your password?</button>}
            {mode === 'forgot' && <button className="ll-auth-link" onClick={() => sw('login')}>← Back to sign in</button>}
            {mode === 'signup' && !inviteData && <>Already have an account? <button className="ll-auth-link" onClick={() => sw('login')}>Sign in</button></>}
          </div>
    </AuthShell>
  );
}
