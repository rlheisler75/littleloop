import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { subscribeToPush } from './services/push';
import Bg from './components/ui/Bg';
import Spinner from './components/ui/Spinner';
import { NotificationCenter } from './features/notifications/index';
import { FamiliesTab } from './features/families/index';
import { SitterFeedWrapper } from './features/feed/index';
import { SitterInvoicesTab } from './features/invoices/index';
import { SitterMessagesWrapper } from './features/messages/index';
import { SitterProfileTab } from './features/profile/index';
import SitterOnboarding from './features/onboarding/SitterOnboarding';

export default function SitterDashboard({ session, onSignOut }) {
  const sitterId = session.user.id;

  const [name,      setName]      = useState(session.user.user_metadata?.name || session.user.email.split('@')[0]);
  const [onboarded, setOnboarded] = useState(!!localStorage.getItem(`ll_onboarded_${sitterId}`));
  const [tab,       setTab]       = useState('families');
  const [unread,    setUnread]    = useState({ messages: 0, feed: 0, requests: 0, eta: 0 });

  // Check onboarded flag from DB if not in localStorage
  useEffect(() => {
    if (onboarded) return;
    supabase.from('sitters').select('onboarded').eq('id', sitterId).single()
      .then(({ data }) => {
        if (data?.onboarded) {
          localStorage.setItem(`ll_onboarded_${sitterId}`, '1');
          setOnboarded(true);
        }
      });
  }, []);

  // Subscribe to push on mount
  useEffect(() => { subscribeToPush(sitterId); }, [sitterId]);

  // Unread badge counts
  useEffect(() => {
    async function checkUnread() {
      const lastSeenMsg  = localStorage.getItem(`ll_seen_msg_${sitterId}`)           || '1970-01-01';
      const lastSeenFeed = localStorage.getItem(`ll_seen_feed_comments_${sitterId}`) || '1970-01-01';

      const [{ count: msgCount }, { count: feedCount }, { count: reqCount }] = await Promise.all([
        supabase.from('messages').select('id', { count: 'exact', head: true }).neq('sender_id', sitterId).gt('created_at', lastSeenMsg),
        supabase.from('post_comments').select('id', { count: 'exact', head: true }).neq('author_id', sitterId).gt('created_at', lastSeenFeed),
        supabase.from('family_sitters').select('id', { count: 'exact', head: true }).eq('sitter_id', sitterId).eq('status', 'requested'),
      ]);
      setUnread({ messages: msgCount || 0, feed: feedCount || 0, requests: reqCount || 0, eta: 0 });
    }
    checkUnread();

    const ch = supabase.channel('sitter-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => {
        if (p.new.sender_id !== sitterId) setUnread(u => ({ ...u, messages: u.messages + 1 }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, p => {
        if (p.new.author_id !== sitterId) setUnread(u => ({ ...u, feed: u.feed + 1 }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eta_notifications' }, () => {
        setUnread(u => ({ ...u, eta: u.eta + 1 }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'family_sitters' }, p => {
        if (p.new.sitter_id === sitterId && p.new.status === 'requested')
          setUnread(u => ({ ...u, requests: u.requests + 1 }));
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sitterId]);

  // Clear badges when tabs open
  useEffect(() => {
    if (tab === 'messages') {
      localStorage.setItem(`ll_seen_msg_${sitterId}`, new Date().toISOString());
      setUnread(u => ({ ...u, messages: 0 }));
    }
    if (tab === 'feed') {
      localStorage.setItem(`ll_seen_feed_comments_${sitterId}`, new Date().toISOString());
      setUnread(u => ({ ...u, feed: 0 }));
    }
    if (tab === 'families') {
      setUnread(u => ({ ...u, eta: 0 }));
    }
  }, [tab]);

  const NAV = [
    { id: 'families', icon: '👨‍👩‍👧', label: 'Families', badge: (unread.eta || 0) + (unread.requests || 0) },
    { id: 'feed',     icon: '🌸',      label: 'Feed',     badge: unread.feed },
    { id: 'invoices', icon: '💰',      label: 'Invoices', badge: 0 },
    { id: 'messages', icon: '💬',      label: 'Messages', badge: unread.messages },
    { id: 'profile',  icon: '⚙️',      label: 'Profile',  badge: 0 },
  ];

  if (!onboarded) return (
    <>
      <Bg/>
      <SitterOnboarding session={session} onComplete={n => { setName(n); setOnboarded(true); }}/>
    </>
  );

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,.06)', background: 'var(--nav-bg,rgba(0,0,0,.2))', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="leaf" style={{ fontSize: 22, filter: 'drop-shadow(0 0 10px rgba(58,158,122,.4))' }}>➿</div>
          <div className="logo-text" style={{ fontSize: 20 }}>littleloop</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotificationCenter userId={sitterId}/>
          <button className="bg" style={{ padding: '6px 12px', fontSize: 12 }} onClick={onSignOut}>Sign out</button>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.06)', background: 'var(--nav-bg,rgba(0,0,0,.15))' }}>
        {NAV.map(n => (
          <div key={n.id} className={`nav-tab ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <span style={{ fontSize: 18 }}>{n.icon}</span>
              {n.badge > 0 && <span style={{ position: 'absolute', top: -3, right: -5, width: 8, height: 8, borderRadius: '50%', background: '#E05A5A', boxShadow: '0 0 0 2px var(--body-bg,#0C1420)' }}/>}
            </span>
            <span>{n.label}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', maxWidth: 800, width: '100%', margin: '0 auto' }}>
        {tab === 'families' && <FamiliesTab sitterId={sitterId} sitterName={name}/>}
        {tab === 'feed'     && <SitterFeedWrapper sitterId={sitterId} sitterName={name}/>}
        {tab === 'invoices' && <SitterInvoicesTab sitterId={sitterId} sitterName={name}/>}
        {tab === 'messages' && <SitterMessagesWrapper sitterId={sitterId} sitterName={name}/>}
        {tab === 'profile'  && <SitterProfileTab sitterId={sitterId} sitterName={name} onNameChange={setName}/>}
      </div>
    </div>
  );
}
