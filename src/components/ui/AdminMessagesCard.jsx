// src/components/ui/AdminMessagesCard.jsx
// Shows messages sent by admin to this sitter/member.
// Drop anywhere in a settings/profile tab.
//
// Usage:
//   import AdminMessagesCard from '../../components/ui/AdminMessagesCard';
//   <AdminMessagesCard userId={sitterId} />

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

function timeAgo(ts) {
  const d = Math.floor((Date.now() - new Date(ts)) / 86400000);
  if (d < 1) return 'Today';
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AdminMessagesCard({ userId }) {
  const [messages,  setMessages]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState(null); // message id

  useEffect(() => {
    if (!userId) return;
    load();
  }, [userId]);

  async function load() {
    const { data } = await supabase
      .from('admin_messages')
      .select('*')
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false });
    setMessages(data || []);
    setLoading(false);

    // Mark unread ones as read
    const unread = (data || []).filter(m => !m.read_at).map(m => m.id);
    if (unread.length > 0) {
      await supabase.from('admin_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unread);
    }
  }

  if (loading || messages.length === 0) return null;

  const unreadCount = messages.filter(m => !m.read_at).length;

  return (
    <div className="card" style={{ padding: '20px 18px', marginBottom: 14, border: '1px solid rgba(58,111,212,.2)', background: 'rgba(58,111,212,.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 16 }}>📬</div>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, flex: 1 }}>
          Messages from littleloop
        </div>
        {unreadCount > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, background: '#3A6FD4', color: '#fff', borderRadius: 10, padding: '2px 8px' }}>
            {unreadCount} new
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map(msg => (
          <div key={msg.id}
            onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}
            style={{
              padding: '12px 14px', borderRadius: 12, cursor: 'pointer', transition: 'all .15s',
              background: expanded === msg.id ? 'var(--input-bg)' : 'var(--card-bg)',
              border: `1px solid ${!msg.read_at ? 'rgba(58,111,212,.4)' : 'var(--border)'}`,
            }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  {!msg.read_at && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3A6FD4', flexShrink: 0 }}/>
                  )}
                  <div style={{ fontSize: 13, fontWeight: !msg.read_at ? 700 : 500 }}>{msg.subject}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  From littleloop team · {timeAgo(msg.created_at)}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', flexShrink: 0, marginTop: 1 }}>
                {expanded === msg.id ? '▲' : '▼'}
              </div>
            </div>

            {expanded === msg.id && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <pre style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: "'DM Sans',sans-serif", margin: 0 }}>
                  {msg.body}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
