import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../ui/Spinner';
import AuthShell from './AuthShell';

export default function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [alert,    setAlert]    = useState(null);
  const [done,     setDone]     = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password.length < 8)  { setAlert({ t: 'e', m: 'Password must be at least 8 characters.' }); return; }
    if (password !== confirm)  { setAlert({ t: 'e', m: "Passwords don't match." }); return; }

    setLoading(true);
    setAlert(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) { setAlert({ t: 'e', m: error.message }); return; }

    setDone(true);
    setTimeout(async () => {
      await supabase.auth.signOut();
      window.location.href = '/?portal=sitter';
    }, 2000);
  }

  return (
    <AuthShell>
      <h1 className="ll-auth-title">Set a new password</h1>
      <p className="ll-auth-sub">Choose something you'll remember. At least 8 characters.</p>

      {done
        ? <div className="ll-auth-note s">Password updated! Taking you to sign in…</div>
        : (
          <form onSubmit={submit}>
            {alert && <div className={`ll-auth-note ${alert.t}`}>{alert.m}</div>}
            <div className="ll-auth-field">
              <label className="ll-auth-label">New password</label>
              <input className="ll-auth-input" type="password" required value={password}
                onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password"/>
            </div>
            <div className="ll-auth-field">
              <label className="ll-auth-label">Confirm password</label>
              <input className="ll-auth-input" type="password" required value={confirm}
                onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" autoComplete="new-password"/>
            </div>
            <button type="submit" className="ll-auth-btn" disabled={loading}>
              {loading ? <><Spinner/> Saving…</> : 'Save password'}
            </button>
          </form>
        )
      }
    </AuthShell>
  );
}
