import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../ui/Spinner';
import { getStoredRef } from '../../lib/utils';

// Styled to match the landing page (coral / sun / sky / mint, Fredoka + Nunito).
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap');
.ll-auth {
  --coral: #FF6B57; --coral-dark: #E04E3A; --coral-pale: #FFE4DE;
  --cream: #FFFBF3; --indigo: #2B2D6B; --indigo-light: #4A4E8F;
  --sky: #4CB5F5; --sun: #FFC23C; --mint: #2FC79B; --ink: #22244D; --muted: #686B90;
  position: relative; z-index: 1; min-height: 100vh; padding: 32px 16px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-family: 'Nunito', sans-serif; color: var(--ink);
  background:
    radial-gradient(circle at 88% 12%, rgba(255,194,60,.30) 0, transparent 30%),
    radial-gradient(circle at 6% 90%, rgba(76,181,245,.20) 0, transparent 30%),
    radial-gradient(circle at 70% 100%, rgba(47,199,155,.14) 0, transparent 28%),
    var(--cream);
}
.ll-auth * { box-sizing: border-box; }
.ll-auth-wrap { width: 100%; max-width: 420px; }
.ll-auth-back { background: none; border: none; cursor: pointer; color: var(--indigo-light); font: 700 14px 'Nunito', sans-serif; padding: 0; margin-bottom: 18px; }
.ll-auth-back:hover { color: var(--coral); }
.ll-auth-brand { text-align: center; margin-bottom: 22px; }
.ll-auth-logo { font: 600 32px 'Fredoka', sans-serif; color: var(--indigo); display: inline-flex; align-items: center; gap: 8px; }
.ll-auth-tag { font-size: 13px; color: var(--muted); margin-top: 4px; }
.ll-auth-card { background: #fff; border-radius: 24px; padding: 26px 24px 22px; box-shadow: 0 12px 40px rgba(43,45,107,.10); border: 2px solid #F3EDE3; }
.ll-auth-tabs { display: grid; grid-template-columns: 1fr 1fr; background: #F6F1E8; border-radius: 100px; padding: 4px; margin-bottom: 20px; }
.ll-auth-tab { border: none; background: none; border-radius: 100px; padding: 10px 8px; cursor: pointer; font: 500 15px 'Fredoka', sans-serif; color: var(--muted); }
.ll-auth-tab.on { background: #fff; color: var(--indigo); box-shadow: 0 2px 8px rgba(43,45,107,.10); }
.ll-auth-title { font: 600 24px 'Fredoka', sans-serif; color: var(--indigo); margin: 0 0 4px; }
.ll-auth-sub { font-size: 14px; color: var(--muted); margin: 0 0 18px; line-height: 1.5; }
.ll-auth-label { display: block; font-size: 13px; font-weight: 800; color: var(--indigo-light); margin-bottom: 6px; }
.ll-auth-roles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
.ll-auth-role { border-radius: 16px; padding: 14px 8px 12px; cursor: pointer; text-align: center; background: #fff; border: 2px solid #ECE6DC; transition: all .15s; font-family: 'Nunito', sans-serif; color: var(--ink); }
.ll-auth-role:hover { border-color: var(--coral-pale); }
.ll-auth-role.on { border-color: var(--coral); background: #FFF5F2; box-shadow: 0 4px 0 var(--coral-pale); }
.ll-auth-role .i { font-size: 28px; line-height: 1; }
.ll-auth-role .t { font: 600 16px 'Fredoka', sans-serif; color: var(--indigo); margin-top: 6px; }
.ll-auth-role .s { font-size: 12px; color: var(--muted); margin-top: 2px; }
.ll-auth-field { margin-bottom: 14px; }
.ll-auth-input { width: 100%; padding: 13px 14px; border-radius: 14px; border: 2px solid #ECE6DC; background: #FFFDF9; font: 600 15px 'Nunito', sans-serif; color: var(--ink); outline: none; transition: border-color .15s; }
.ll-auth-input::placeholder { color: #B4B2C6; font-weight: 500; }
.ll-auth-input:focus { border-color: var(--sky); background: #fff; }
.ll-auth-btn { width: 100%; margin-top: 6px; font: 500 17px 'Fredoka', sans-serif; background: var(--coral); color: #fff; padding: 14px 20px; border-radius: 100px; border: none; cursor: pointer; box-shadow: 0 5px 0 var(--coral-dark); transition: transform .15s, box-shadow .15s; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.ll-auth-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 7px 0 var(--coral-dark); }
.ll-auth-btn:disabled { opacity: .7; cursor: default; }
.ll-auth-link { background: none; border: none; cursor: pointer; font: 700 13px 'Nunito', sans-serif; color: var(--sky); padding: 0; }
.ll-auth-link:hover { text-decoration: underline; }
.ll-auth-note { border-radius: 14px; padding: 11px 14px; font-size: 13px; line-height: 1.5; margin-bottom: 16px; }
.ll-auth-note.i { background: #EAF6FE; color: #1F5F8A; }
.ll-auth-note.s { background: #E6F8F1; color: #18705A; }
.ll-auth-note.e { background: #FFEDEA; color: #B23A28; }
.ll-auth-note.w { background: #FFF6DD; color: #8A6410; }
.ll-auth-foot { text-align: center; margin-top: 16px; font-size: 13px; color: var(--muted); }
`;

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
    <div className="ll-auth">
      <style>{STYLES}</style>
      <div className="ll-auth-wrap">

        {onBack && <button className="ll-auth-back" onClick={onBack}>← Back to littleloop</button>}

        <div className="ll-auth-brand">
          <div className="ll-auth-logo">➿ littleloop</div>
          <div className="ll-auth-tag">Independent childcare, thoughtfully connected.</div>
        </div>

        <div className="ll-auth-card">
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
        </div>

      </div>
    </div>
  );
}
