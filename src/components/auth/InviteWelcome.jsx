import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../ui/Spinner';
import SitterAvatar from '../ui/SitterAvatar';
import AuthShell from './AuthShell';

const FEATURES = [
  ['🌸', '#FFE4DE', 'Daily updates', 'Photos and notes from your sitter'],
  ['💬', '#E3F3FE', 'Messaging',     'Private chat, always in reach'],
  ['✅', '#DDF6EE', 'Check in/out',  'See when your kids arrive and leave'],
  ['💳', '#FFF1CC', 'Invoices',      'View and pay in one place'],
];

export default function InviteWelcome({ token, onContinue }) {
  const [invite,  setInvite]  = useState(null);
  const [sitter,  setSitter]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    async function load() {
      // Looks up only this one live invite; invite_tokens itself isn't publicly readable.
      const { data, error } = await supabase.rpc('get_invite', { p_token: token });

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
    <AuthShell>
      <div className="ll-auth-center" style={{ padding: '24px 0' }}><Spinner size={24}/></div>
    </AuthShell>
  );

  if (error) return (
    <AuthShell>
      <div className="ll-auth-center">
        <div style={{ fontSize: 44, marginBottom: 8 }}>😕</div>
        <h1 className="ll-auth-title">Invite not found</h1>
        <p className="ll-auth-sub">{error} Already have an account? Just sign in. Otherwise, ask your sitter to send a new invite.</p>
        <button className="ll-auth-btn" onClick={() => { window.location.href = '/?portal=parent'; }}>
          Go to sign in
        </button>
      </div>
    </AuthShell>
  );

  return (
    <AuthShell>
      <div className="ll-auth-center">
        <div className="ll-auth-avatar">
          {sitter?.avatar_url
            ? <SitterAvatar url={sitter.avatar_url} name={sitter.name} size={84} radius="0"/>
            : '🧸'}
        </div>
        <h1 className="ll-auth-title">You're invited!</h1>
        <p className="ll-auth-sub">
          <strong>{sitter?.name || 'Your sitter'}</strong> has invited <strong>{invite.family_name}</strong> to join littleloop
          {sitter?.city ? ` · ${sitter.city}${sitter.state ? ', ' + sitter.state : ''}` : ''}.
        </p>
      </div>

      <div className="ll-auth-feats">
        {FEATURES.map(([icon, bg, title, desc]) => (
          <div key={title} className="ll-auth-feat">
            <div className="i" style={{ background: bg }}>{icon}</div>
            <div>
              <div className="t">{title}</div>
              <div className="s">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <button className="ll-auth-btn" onClick={() => onContinue(invite)}>
        Create your account →
      </button>
      <div className="ll-auth-foot">
        Sign up with <strong>{invite.admin_email}</strong> to connect to {invite.family_name} automatically.
        <div style={{ marginTop: 8 }}>
          Already have an account? <button className="ll-auth-link" onClick={() => { window.location.href = '/?portal=parent'; }}>Sign in</button>
        </div>
      </div>
    </AuthShell>
  );
}
