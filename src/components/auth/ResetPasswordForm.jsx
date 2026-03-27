import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Field from '../ui/Field';
import Spinner from '../ui/Spinner';

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
      window.location.href = '/';
    }, 2000);
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="mb" style={{ maxWidth: 420, width: '100%', padding: 32 }}>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="leaf" style={{ fontSize: 36, marginBottom: 8 }}>➿</div>
          <div className="logo-text" style={{ fontSize: 26, marginBottom: 6 }}>littleloop</div>
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Set your new password</p>
        </div>

        {done
          ? <div className="al al-s">Password updated! Redirecting to login…</div>
          : (
            <form onSubmit={submit}>
              {alert && <div className={`al al-${alert.t}`}>{alert.m}</div>}
              <Field
                label="New password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
              <Field
                label="Confirm password"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
              />
              <button type="submit" className="bp full" disabled={loading} style={{ marginTop: 8 }}>
                {loading ? <><Spinner/> Saving…</> : 'Set Password'}
              </button>
            </form>
          )
        }

      </div>
    </div>
  );
}
