import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { invokeNotification, sendPushNotification } from '../../services/push';
import { timeAgo } from '../../services/format';
import { NewConversationModal, AddParticipantModal } from '../../components/modals/ConversationModals';
import Spinner from '../../components/ui/Spinner';

// ─── Conversation Thread ──────────────────────────────────────────────────────

export function ConversationThread({ conv, currentUserId, isSitter, familyId, onBack, participants, onParticipantsChanged }) {
  const [messages,     setMessages]     = useState([]);
  const [newMsg,       setNewMsg]       = useState('');
  const [sending,      setSending]      = useState(false);
  const [showAdd,      setShowAdd]      = useState(false);
  const [initialLoad,  setInitialLoad]  = useState(true);
  const [seenBy,       setSeenBy]       = useState([]);
  const bottomRef                       = useRef(null);

  const senderName   = isSitter ? 'Your Sitter' : (participants.find(p => p.user_id === currentUserId)?.participant_name || 'You');
  const senderAvatar = isSitter ? '➿' : (participants.find(p => p.user_id === currentUserId)?.participant_avatar || '👤');

  const loadRef = useRef(null);
  loadRef.current = async () => {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', conv.id).order('created_at', { ascending: true });
    setMessages(data || []);
    setInitialLoad(false);
    await supabase.from('message_seen').upsert({ conversation_id: conv.id, user_id: currentUserId, last_seen_at: new Date().toISOString() }, { onConflict: 'conversation_id,user_id' });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  useEffect(() => { loadRef.current(); }, [conv.id]);

  useEffect(() => {
    const sub = supabase.channel(`conv-${conv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv.id}` }, payload => {
        const msg = payload.new;
        if (!msg) { loadRef.current(); return; }
        if (msg.sender_id !== currentUserId) {
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      }).subscribe();
    return () => supabase.removeChannel(sub);
  }, [conv.id, currentUserId]);

  useEffect(() => {
    async function loadSeen() {
      const { data } = await supabase.from('message_seen').select('user_id,last_seen_at').eq('conversation_id', conv.id).neq('user_id', currentUserId);
      setSeenBy(data || []);
    }
    loadSeen();
    const ch = supabase.channel(`seen-${conv.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_seen', filter: `conversation_id=eq.${conv.id}` }, loadSeen)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [conv.id, currentUserId]);

  async function send() {
    if (!newMsg.trim()) return;
    setSending(true);
    const msgText    = newMsg.trim();
    const optimistic = { id: `opt-${Date.now()}`, conversation_id: conv.id, sender_id: currentUserId, sender_name: senderName, sender_avatar: senderAvatar, is_sitter: isSitter, text: msgText, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setNewMsg('');
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    const { data: inserted } = await supabase.from('messages').insert({
      conversation_id: conv.id, sender_id: currentUserId, sender_name: senderName,
      sender_avatar: senderAvatar, is_sitter: isSitter, text: msgText,
    }).select().single();
    if (inserted) setMessages(prev => prev.map(m => m.id === optimistic.id ? inserted : m));
    setSending(false);

    const others = participants.filter(p => p.user_id !== currentUserId);
    for (const p of others) {
      invokeNotification({ body: { type: 'new_message', payload: { recipientId: p.user_id, senderName, messagePreview: msgText, isSitter } } });
      sendPushNotification([p.user_id], `New message from ${senderName}`, msgText.slice(0, 80), '/?portal=' + (isSitter ? 'parent' : 'sitter'), 'new_message');
    }
  }

  const convTitle = conv.title || participants.filter(p => p.user_id !== currentUserId).map(p => p.participant_name).join(', ') || 'Conversation';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', minHeight: 400 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,.06)', marginBottom: 12, flexShrink: 0 }}>
        <button onClick={onBack} className="bg" style={{ padding: '6px 10px', fontSize: 12 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{convTitle}</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{participants.map(p => p.participant_name).join(', ')}</div>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg" style={{ padding: '6px 10px', fontSize: 12 }}>+ Add</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
        {messages.length === 0 && !initialLoad
          ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)', fontSize: 13 }}>No messages yet. Say hello! 👋</div>
          : messages.map((m, i) => {
            const isMe       = m.sender_id === currentUserId;
            const showAvatar = i === 0 || messages[i - 1].sender_id !== m.sender_id;
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                {!isMe && showAvatar  && <span style={{ fontSize: 22, flexShrink: 0 }}>{m.sender_avatar}</span>}
                {!isMe && !showAvatar && <span style={{ width: 30, flexShrink: 0 }}/>}
                <div style={{ maxWidth: '80%' }}>
                  {showAvatar && !isMe && <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 3, marginLeft: 2 }}>{m.sender_name}</div>}
                  <div style={{ padding: '9px 13px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: isMe ? 'linear-gradient(135deg,#3A6FD4,#2550A8)' : 'rgba(255,255,255,.08)', fontSize: 13, lineHeight: 1.5, color: '#E4EAF4', wordBreak: 'break-word' }}>{m.text}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>{timeAgo(m.created_at)}</div>
                  {isMe && i === messages.length - 1 && seenBy.length > 0 && (
                    <div style={{ fontSize: 9, color: 'var(--text-faint)', textAlign: 'right', marginTop: 1 }}>
                      Seen by {seenBy.map(s => participants.find(p => p.user_id === s.user_id)?.participant_name || 'them').join(', ')}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        }
        <div ref={bottomRef}/>
      </div>

      <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
        <input className="fi" value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message…" style={{ marginBottom: 0, flex: 1 }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}/>
        <button className="bp" onClick={send} disabled={sending || !newMsg.trim()} style={{ padding: '8px 16px', flexShrink: 0 }}>
          {sending ? <Spinner/> : 'Send'}
        </button>
      </div>

      <AddParticipantModal open={showAdd} onClose={() => setShowAdd(false)} convId={conv.id} familyId={familyId}
        currentParticipants={participants} currentUserId={currentUserId} isSitter={isSitter}
        onAdded={() => { onParticipantsChanged(); setShowAdd(false); }}/>
    </div>
  );
}

// ─── Messages Tab ─────────────────────────────────────────────────────────────

export function MessagesTab({ currentUserId, isSitter, families = [], memberInfo, allMembers = {}, sitterName = '', memberName = '', memberAvatar = '👤' }) {
  const [convs,         setConvs]         = useState([]);
  const [participants,  setParticipants]  = useState({});
  const [lastMessages,  setLastMessages]  = useState({});
  const [unseenCounts,  setUnseenCounts]  = useState({});
  const [hiddenIds,     setHiddenIds]     = useState(new Set());
  const [selectedConv,  setSelectedConv]  = useState(null);
  const [showNew,       setShowNew]       = useState(false);
  const [showHidden,    setShowHidden]    = useState(false);
  const [menuOpen,      setMenuOpen]      = useState(null); // conv id with menu open
  const [loading,       setLoading]       = useState(true);
  const [newConvFamId,  setNewConvFamId]  = useState(null);

  const familyId   = memberInfo?.family_id || null;
  const familyList = families.length > 0 ? families : (memberInfo ? [{ id: memberInfo.family_id, name: 'My Family' }] : []);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('conversations').select('*').order('updated_at', { ascending: false });
    if (!isSitter && familyId) query = query.eq('family_id', familyId);
    const { data: convData } = await query;
    const filtered = (convData || []).filter(c => isSitter || familyList.find(f => f.id === c.family_id));
    setConvs(filtered);

    // Load which conversations this user has hidden
    const { data: hiddenRows } = await supabase.from('conversation_hidden')
      .select('conversation_id').eq('user_id', currentUserId);
    setHiddenIds(new Set((hiddenRows || []).map(r => r.conversation_id)));

    if (filtered.length) {
      const ids = filtered.map(c => c.id);
      const { data: parts } = await supabase.from('conversation_participants').select('*').in('conversation_id', ids);
      const pg = {};
      (parts || []).forEach(p => { if (!pg[p.conversation_id]) pg[p.conversation_id] = []; pg[p.conversation_id].push(p); });
      setParticipants(pg);

      const lastMsgs = {};
      await Promise.all(ids.map(async id => {
        const { data } = await supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: false }).limit(1);
        if (data?.[0]) lastMsgs[id] = data[0];
      }));
      setLastMessages(lastMsgs);

      const { data: seen } = await supabase.from('message_seen').select('*').eq('user_id', currentUserId).in('conversation_id', ids);
      const seenMap = {};
      (seen || []).forEach(s => { seenMap[s.conversation_id] = s.last_seen_at; });
      const unseen = {};
      await Promise.all(ids.map(async id => {
        const since = seenMap[id];
        let q = supabase.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', id).neq('sender_id', currentUserId);
        if (since) q = q.gt('created_at', since);
        const { count } = await q;
        unseen[id] = count || 0;
      }));
      setUnseenCounts(unseen);
    }
    setLoading(false);
  }, [currentUserId, isSitter, familyId]);

  useEffect(() => { load(); }, [load]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handle() { setMenuOpen(null); }
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, [menuOpen]);

  useEffect(() => {
    const sub = supabase.channel('messages-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => {
        const msg = p.new;
        if (!msg) return;
        setLastMessages(prev => ({ ...prev, [msg.conversation_id]: msg }));
        if (msg.sender_id !== currentUserId) {
          setUnseenCounts(prev => ({ ...prev, [msg.conversation_id]: (prev[msg.conversation_id] || 0) + 1 }));
        }
      }).subscribe();
    return () => supabase.removeChannel(sub);
  }, [currentUserId]);

  async function hideConv(convId) {
    setMenuOpen(null);
    await supabase.from('conversation_hidden').upsert(
      { user_id: currentUserId, conversation_id: convId },
      { onConflict: 'user_id,conversation_id' }
    );
    setHiddenIds(prev => new Set([...prev, convId]));
  }

  async function unhideConv(convId) {
    await supabase.from('conversation_hidden')
      .delete().eq('user_id', currentUserId).eq('conversation_id', convId);
    setHiddenIds(prev => { const n = new Set(prev); n.delete(convId); return n; });
  }

  const visibleConvs = convs.filter(c => !hiddenIds.has(c.id));
  const hiddenConvs  = convs.filter(c => hiddenIds.has(c.id));
  const displayConvs = showHidden ? hiddenConvs : visibleConvs;
  const totalUnseen  = Object.entries(unseenCounts)
    .filter(([id]) => !hiddenIds.has(id))
    .reduce((a, [, b]) => a + b, 0);

  const selectedConvData = convs.find(c => c.id === selectedConv);
  const selectedParts    = participants[selectedConv] || [];

  if (loading && !convs.length) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;

  if (selectedConv && selectedConvData) return (
    <ConversationThread conv={selectedConvData} currentUserId={currentUserId} isSitter={isSitter}
      familyId={selectedConvData.family_id} participants={selectedParts}
      onBack={() => { setSelectedConv(null); load(); }} onParticipantsChanged={load}/>
  );

  function ConvRow({ c, isHidden }) {
    const parts    = participants[c.id] || [];
    const last     = lastMessages[c.id];
    const unseen   = unseenCounts[c.id] || 0;
    const title    = c.title || parts.filter(p => p.user_id !== currentUserId).map(p => p.participant_name).join(', ') || 'Conversation';
    const fam      = familyList.find(f => f.id === c.family_id);
    const showPart = parts.find(p => p.is_sitter && p.user_id !== currentUserId) || parts.find(p => p.user_id !== currentUserId);
    const isMenuOpen = menuOpen === c.id;

    return (
      <div key={c.id} style={{ position: 'relative' }}>
        <div
          className="fc"
          onClick={() => { if (menuOpen) { setMenuOpen(null); return; } setSelectedConv(c.id); }}
          style={{ padding: '14px 16px', opacity: isHidden ? 0.6 : 1 }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {showPart?.participant_avatar?.startsWith('http')
              ? <img src={showPart.participant_avatar} style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} alt={showPart.participant_name}/>
              : <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#3A6FD4,#3A9E7A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{showPart?.participant_avatar || '💬'}</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {title}
                  {unseen > 0 && !isHidden && <span style={{ background: '#3A6FD4', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{unseen}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {last && <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{timeAgo(last.created_at)}</div>}
                  {/* ··· menu button */}
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(isMenuOpen ? null : c.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-faint)', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
                  >
                    ···
                  </button>
                </div>
              </div>
              {isSitter && fam && <div style={{ fontSize: 10, color: 'rgba(111,163,232,.6)', marginBottom: 3 }}>{fam.name}</div>}
              {last
                ? <div style={{ fontSize: 12, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--text-dim)' }}>{last.sender_id === currentUserId ? 'You' : last.sender_name}:</strong> {last.text}</div>
                : <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>No messages yet</div>
              }
            </div>
          </div>
        </div>

        {/* Dropdown menu */}
        {isMenuOpen && (
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', top: 44, right: 12, zIndex: 50, background: 'var(--nav-bg,#111D2E)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 0', boxShadow: '0 8px 24px rgba(0,0,0,.4)', minWidth: 160 }}
          >
            {isHidden
              ? <button onClick={() => { unhideConv(c.id); setMenuOpen(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-dim)', textAlign: 'left' }}>
                  👁️ Unhide
                </button>
              : <button onClick={() => hideConv(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-dim)', textAlign: 'left' }}>
                  🙈 Hide conversation
                </button>
            }
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600 }}>
          Messages {totalUnseen > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: '#3A6FD4', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>{totalUnseen}</span>}
        </div>
        <button className="bp" onClick={() => { setNewConvFamId(families[0]?.id || familyId || null); setShowNew(true); }}>+ New</button>
      </div>

      {/* Hidden toggle — only shown when there are hidden convs */}
      {hiddenConvs.length > 0 && (
        <button onClick={() => setShowHidden(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-faint)', padding: 0 }}>
          <span>{showHidden ? '▾' : '▸'}</span>
          {showHidden ? `Showing ${hiddenConvs.length} hidden` : `${hiddenConvs.length} hidden conversation${hiddenConvs.length !== 1 ? 's' : ''}`}
        </button>
      )}

      {displayConvs.length === 0
        ? showHidden
          ? <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: 'var(--text-faint)' }}>No hidden conversations.</div>
          : <div className="es"><div className="ic">💬</div><h3>No conversations yet</h3><p>Start a conversation with {isSitter ? 'a family' : 'your sitter'}.</p><button className="bp" onClick={() => { setNewConvFamId(families[0]?.id || familyId || null); setShowNew(true); }}>+ Start a conversation</button></div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {displayConvs.map(c => <ConvRow key={c.id} c={c} isHidden={hiddenIds.has(c.id)}/>)}
          </div>
        )
      }

      <NewConversationModal open={showNew} onClose={() => setShowNew(false)} familyId={newConvFamId}
        currentUserId={currentUserId} isSitter={isSitter} families={familyList} members={[]}
        sitterName={sitterName} sitterAvatar="➿" onCreated={id => { setSelectedConv(id); load(); }}/>
    </div>
  );
}

// ─── Sitter messages wrapper ──────────────────────────────────────────────────

export function SitterMessagesWrapper({ sitterId, sitterName }) {
  const [families,   setFamilies]   = useState([]);
  const [allMembers, setAllMembers] = useState({});
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    async function load() {
      const { data: fsRows } = await supabase.from('family_sitters').select('status,families(*)').eq('sitter_id', sitterId).neq('status', 'inactive');
      const fams = (fsRows || []).map(r => r.families).filter(Boolean);
      setFamilies(fams);
      if (fams.length) {
        const { data: mems } = await supabase.from('members').select('*').in('family_id', fams.map(f => f.id));
        const g = {};
        (mems || []).forEach(m => { if (!g[m.family_id]) g[m.family_id] = []; g[m.family_id].push(m); });
        setAllMembers(g);
      }
      setLoading(false);
    }
    load();
  }, [sitterId]);

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;
  if (!families.length) return <div className="es"><div className="ic">💬</div><h3>No families yet</h3><p>Invite a family first to start messaging.</p></div>;
  return <MessagesTab currentUserId={sitterId} isSitter={true} families={families} memberInfo={null} allMembers={allMembers} sitterName={sitterName}/>;
}

// ─── Family messages wrapper ──────────────────────────────────────────────────

export function MessagesTabWrapper({ currentUserId, member, family, memberName, memberAvatar }) {
  if (!member || !family) return <div className="es"><div className="ic">💬</div><h3>Not connected</h3><p>No family connected yet.</p></div>;
  return <MessagesTab currentUserId={currentUserId} isSitter={false} families={[family]} memberInfo={{ ...member, family_id: family.id }} allMembers={{ [family.id]: [] }} sitterName="Your Sitter" memberName={memberName} memberAvatar={memberAvatar}/>;
}
