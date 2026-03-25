import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../ui/Spinner';

export default function InviteWelcome({ token, onContinue }) {
  const [invite,  setInvite]  = useState(null);
  const [sitter,  setSitter]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('invite_tokens')
        .select('*, sitters(name, avatar_url, city, state)')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .is('used_at', null)
        .single();

      if (error || !data) {
        setError('This invite link has expired or already been used.');
        setLoading(false);
        return;
      }
      setInvite(data);
      setSitter(data.sitters);
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={24}/>
    </div>
  );

  if (error) return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>😕</div>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Invite not found</div>
        <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6, marginBottom: 24 }}>{error}</p>
        <button className="bp" onClick={() => window.location.href = '/?portal=parent'}>Go to sign up</button>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 460 }} className="fade-up">

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="leaf" style={{ fontSize: 36, marginBottom: 8 }}>➿</div>
          <div className="logo-text" style={{ fontSize: 28 }}>littleloop</div>
        </div>

        <div className="card" style={{ padding: '28px 24px', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', background: 'var(--card-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 12, margin: '0 auto 12px' }}>
            {sitter?.avatar_url
              ? <img src={sitter.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={sitter.name}/>
              : '➿'
            }
          </div>

          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 600, marginBottom: 6 }}>
            You're invited!
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
            <strong>{sitter?.name || 'Your sitter'}</strong> has invited <strong>{invite.family_name}</strong> to join littleloop
            {sitter?.city ? ` · ${sitter.city}${sitter.state ? ', ' + sitter.state : ''}` : ''}.
          </p>

          <div style={{ textAlign: 'left', marginBottom: 24 }}>
            {[
              ['🌸', 'Daily updates',  'Photos and notes from your sitter'],
              ['💬', 'Messaging',      'Private chat, always in reach'],
              ['✅', 'Check in/out',   'See when your kids arrive and leave'],
              ['💳', 'Invoices',       'View and pay in one place'],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <button className="bp full" onClick={() => onContinue(invite)}>
            Create your account →
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10 }}>
            Sign up with {invite.admin_email} to auto-connect to {invite.family_name}
          </div>
        </div>

      </div>
    </div>
  );
}
