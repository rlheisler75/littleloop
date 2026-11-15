import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AdminLogin() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('Invalid credentials.');
      setLoading(false);
    }
    // Success — AdminApp's onAuthStateChange handles the rest
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F1923', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#3A6FD4,#2550A8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 14px' }}>🛡️</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#E4EAF4', letterSpacing: '-.3px' }}>littleloop</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 4, letterSpacing: '.08em', textTransform: 'uppercase' }}>Admin Console</div>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '28px 24px' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#E4EAF4', marginBottom: 20 }}>Sign in</div>

          {error && (
            <div style={{ background: 'rgba(192,80,80,.12)', border: '1px solid rgba(192,80,80,.25)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#F5AAAA', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.35)', letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 6 }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#E4EAF4', fontSize: 13, outline: 'none' }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.35)', letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 6 }}>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#E4EAF4', fontSize: 13, outline: 'none' }}
              />
            </div>
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '11px', borderRadius: 8, background: 'linear-gradient(135deg,#3A6FD4,#2550A8)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? .6 : 1 }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,.2)' }}>
          littleloop admin · authorized personnel only
        </p>
      </div>
    </div>
  );
}
