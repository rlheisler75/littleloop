import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { subscribeToPush } from './services/push';
import { ROLE_LABELS } from './lib/constants';
import Bg from './components/ui/Bg';
import Spinner from './components/ui/Spinner';
import SectionLabel from './components/ui/SectionLabel';
import { Confirm } from './components/ui/Modal';
import { NotificationCenter } from './features/notifications/index';
import { FamilyNameEditor, MemberProfileTab } from './features/members/MemberProfileTab';
import { CheckInButton } from './features/children/CheckInButton';
import { HoursSummaryCard } from './features/children/HoursSummaryCard';
import { CheckinHistoryModal } from './components/modals/CheckinModals';
import { WeeklyScheduleCard, OnMyWayButton } from './features/schedule/index';
import { FeedTab } from './features/feed/index';
import { MessagesTabWrapper } from './features/messages/index';
import { FamilyInvoicesTab } from './features/invoices/index';
import { FamilyIconPicker, FamilyOnboarding } from './components/modals/FamilyOnboarding';
import FindSitterModal from './components/modals/FindSitterModal';
import { LeaveReviewModal } from './components/modals/LeaveReviewModal';
import { ChildProfileModal, ChildModal } from './components/modals/ChildModal';
import MemberModal from './components/modals/MemberModal';
import { BrowseSitters } from './features/profile/index';

export default function ParentDashboard({ session, onSignOut }) {
  const [member,   setMember]   = useState(null);
  const [family,   setFamily]   = useState(null);
  const [children, setChildren] = useState([]);
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('home');
  const [name,     setName]     = useState(session.user.user_metadata?.name || session.user.email.split('@')[0]);
  const [unread,   setUnread]   = useState({ messages: 0, invoices: 0, feed: 0 });

  // Modal state
  const [selectedChild,    setSelectedChild]    = useState(null);
  const [editChild,        setEditChild]        = useState(null);
  const [showAddChild,     setShowAddChild]     = useState(false);
  const [editMember,       setEditMember]       = useState(null);
  const [showAddMember,    setShowAddMember]    = useState(false);
  const [reviewTarget,     setReviewTarget]     = useState(null);
  const [showCheckinHist,  setShowCheckinHist]  = useState(false);
  const [showFindSitter,   setShowFindSitter]   = useState(false);
  const [showIconPicker,   setShowIconPicker]   = useState(false);
  const [showOnboarding,   setShowOnboarding]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: mem } = await supabase.from('members').select('*').eq('user_id', session.user.id).maybeSingle();
    if (!mem) { setLoading(false); return; }
    setMember(mem);

    const [{ data: fam }, { data: kids }, { data: mems }, { data: fsRows }] = await Promise.all([
      supabase.from('families').select('*').eq('id', mem.family_id).single(),
      supabase.from('children').select('*').eq('family_id', mem.family_id),
      supabase.from('members').select('*').eq('family_id', mem.family_id),
      supabase.from('family_sitters').select('status,sitters(id,name,avatar_url)').eq('family_id', mem.family_id).neq('status', 'inactive'),
    ]);

    const sittersList = (fsRows || []).map(r => ({ ...r.sitters, connection_status: r.status })).filter(Boolean);
    const famWithSitters = fam ? { ...fam, sitters_list: sittersList, sitter_name: sittersList[0]?.name || 'Sitter' } : fam;
    setFamily(famWithSitters);
    setChildren(kids || []);
    setMembers(mems || []);

    // Show onboarding for new empty families
    if (famWithSitters && !(kids || []).length && !sittersList.length) {
      const seen = localStorage.getItem(`ll_onboarded_family_${famWithSitters.id}`);
      if (!seen) setShowOnboarding(true);
    }
    setLoading(false);
  }, [session.user.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (session?.user?.id) subscribeToPush(session.user.id); }, [session?.user?.id]);

  // Unread badge counts
  useEffect(() => {
    if (!member || !family) return;
    const userId = session.user.id;

    async function checkUnread() {
      const lastSeenMsg = localStorage.getItem(`ll_seen_msg_${userId}`)                   || '1970-01-01';
      const lastSeenInv = localStorage.getItem(`ll_seen_inv_${family.id}_${userId}`)      || '1970-01-01';
      const lastSeenFeed= localStorage.getItem(`ll_seen_feed_${family.id}_${userId}`)     || '1970-01-01';
      const [{ count: msgCount }, { count: invCount }, { count: feedCount }] = await Promise.all([
        supabase.from('messages').select('id', { count: 'exact', head: true }).neq('sender_id', userId).gt('created_at', lastSeenMsg),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('family_id', family.id).in('status', ['sent']).gt('created_at', lastSeenInv),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('family_id', family.id).gt('created_at', lastSeenFeed),
      ]);
      setUnread({ messages: msgCount || 0, invoices: invCount || 0, feed: feedCount || 0 });
    }
    checkUnread();

    const ch = supabase.channel('parent-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => {
        if (p.new.sender_id !== session.user.id) setUnread(u => ({ ...u, messages: u.messages + 1 }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `family_id=eq.${family?.id}` }, () => {
        setUnread(u => ({ ...u, feed: u.feed + 1 }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'invoices', filter: `family_id=eq.${family?.id}` }, () => {
        setUnread(u => ({ ...u, invoices: u.invoices + 1 }));
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [member, family]);

  // Clear badges when tabs open
  useEffect(() => {
    const userId = session.user.id;
    if (tab === 'messages') {
      localStorage.setItem(`ll_seen_msg_${userId}`, new Date().toISOString());
      setUnread(u => ({ ...u, messages: 0 }));
    }
    if (tab === 'invoices' && family) {
      localStorage.setItem(`ll_seen_inv_${family.id}_${userId}`, new Date().toISOString());
      setUnread(u => ({ ...u, invoices: 0 }));
    }
    if (tab === 'feed' && family) {
      localStorage.setItem(`ll_seen_feed_${family.id}_${userId}`, new Date().toISOString());
      setUnread(u => ({ ...u, feed: 0 }));
    }
  }, [tab, family]);

  const isAdmin  = member?.role === 'admin';
  const canView  = ['admin', 'member'].includes(member?.role);
  const feedOnly = member?.role === 'feed_only';
  const pickup   = member?.role === 'pickup';

  // Default tab based on role
  useEffect(() => {
    if (pickup)   setTab('messages');
    else if (feedOnly) setTab('feed');
  }, [pickup, feedOnly]);

  const NAV = [
    ...(!feedOnly && !pickup ? [{ id: 'home',     icon: '🏠', label: 'Home',     badge: 0 }] : []),
    { id: 'feed',     icon: '🌸', label: 'Feed',     badge: unread.feed },
    ...(canView || isAdmin ? [{ id: 'invoices', icon: '💰', label: 'Invoices', badge: unread.invoices }] : []),
    { id: 'messages', icon: '💬', label: 'Messages', badge: unread.messages },
    { id: 'browse',   icon: '🔍', label: 'Browse',   badge: 0 },
    { id: 'profile',  icon: '⚙️', label: 'Profile',  badge: 0 },
  ];

  if (loading) return (
    <>
      <Bg/>
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={24}/>
      </div>
    </>
  );

  function dismissOnboarding() {
    localStorage.setItem(`ll_onboarded_family_${family.id}`, '1');
    setShowOnboarding(false);
    load();
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,.06)', background: 'var(--nav-bg,rgba(0,0,0,.2))', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="leaf" style={{ fontSize: 22, filter: 'drop-shadow(0 0 10px rgba(58,158,122,.4))' }}>➿</div>
          <div className="logo-text" style={{ fontSize: 20 }}>littleloop</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotificationCenter userId={session.user.id}/>
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

        {/* ── Home Tab ── */}
        {tab === 'home' && (
          <div>
            {!family
              ? <div className="es"><div className="ic">👨‍👩‍👧</div><h3>Not connected yet</h3><p>Your account isn't linked to a family yet.<br/>Make sure you signed up with the email your sitter invited.</p></div>
              : (
                <>
                  <WeeklyScheduleCard familyId={family.id} sitters={family.sitters_list || []}/>
                  <HoursSummaryCard familyId={family.id} children={children}/>

                  <div className="card fade-up" style={{ padding: 24, marginBottom: 16 }}>
                    {/* Family header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                      {isAdmin
                        ? <button onClick={() => setShowIconPicker(true)} style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#3A9E7A,#2A7A5A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, border: 'none', cursor: 'pointer', position: 'relative' }}>
                            {family.icon || '👨‍👩‍👧'}
                            <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: 10, background: 'var(--card-bg)', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>✏️</span>
                          </button>
                        : <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#3A9E7A,#2A7A5A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{family.icon || '👨‍👩‍👧'}</div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isAdmin
                          ? <FamilyNameEditor familyId={family.id} name={family.name} onSaved={n => setFamily(f => ({ ...f, name: n }))}/>
                          : <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600 }}>{family.name}</div>
                        }
                        <span className={`sb sb-${family.status === 'active' ? 'a' : 'p'}`} style={{ marginTop: 4 }}>{family.status}</span>
                      </div>
                    </div>

                    {/* Children */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <SectionLabel>Children</SectionLabel>
                        {isAdmin && <button className="bp" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => setShowAddChild(true)}>+ Add Child</button>}
                      </div>
                      {children.length === 0
                        ? <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>No children added yet.</div>
                        : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {children.map(c => (
                              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: `${c.color || '#8B78D4'}12`, borderRadius: 14, border: `1px solid ${c.color || '#8B78D4'}33` }}>
                                <button onClick={() => setSelectedChild(c)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', flex: 1, minWidth: 0, padding: 0 }}>
                                  <span style={{ fontSize: 22 }}>{c.avatar || '🌟'}</span>
                                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
                                  {isAdmin && <span style={{ fontSize: 11, opacity: .4, marginLeft: 4 }} onClick={e => { e.stopPropagation(); setEditChild(c); }}>✏️</span>}
                                </button>
                                {(isAdmin || member?.role === 'member' || member?.role === 'pickup') && (
                                  <CheckInButton child={c} familyId={family.id} currentUserId={session.user.id} checkerName={name} isSitter={false}/>
                                )}
                              </div>
                            ))}
                          </div>
                        )
                      }
                    </div>

                    {/* On My Way */}
                    {(isAdmin || member?.role === 'member') && (
                      <OnMyWayButton familyId={family.id} memberId={member?.id} memberName={name}/>
                    )}

                    {/* Sitters */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <SectionLabel>Sitters</SectionLabel>
                        {isAdmin && <button className="bp" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setShowFindSitter(true)}>+ Find Sitter</button>}
                      </div>
                      {(family.sitters_list || []).length === 0
                        ? <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>No sitters connected yet.</div>
                        : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {family.sitters_list.map(s => (
                              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--input-bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
                                <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: 'var(--card-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                                  {s.avatar_url ? <img src={s.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={s.name}/> : '➿'}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  {s.connection_status === 'active'
                                    ? <button className="bg" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => setReviewTarget({ sitterId: s.id, sitterName: s.name })}>⭐ Review</button>
                                    : <span className="sb sb-p" style={{ fontSize: 9 }}>Pending</span>
                                  }
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      }
                    </div>

                    {/* Family members */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <SectionLabel>Family Members</SectionLabel>
                        {isAdmin && <button className="bp" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => setShowAddMember(true)}>+ Add Member</button>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {members.map(m => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid rgba(255,255,255,.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {m.photo_url
                                ? <img src={m.photo_url} style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} alt={m.name}/>
                                : <span style={{ fontSize: 22 }}>{m.avatar || '👤'}</span>
                              }
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>
                                  {m.name}
                                  {m.user_id === session.user.id && <span style={{ fontSize: 10, color: 'var(--text-faint)', marginLeft: 6 }}>(you)</span>}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{m.email}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <span className={`sb sb-${m.status === 'active' ? 'a' : 'p'}`} style={{ fontSize: 9 }}>{ROLE_LABELS[m.role] || m.role}</span>
                              {(isAdmin || m.user_id === session.user.id) && (
                                <button className="bg" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setEditMember(m)}>✏️</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )
            }
          </div>
        )}

        {tab === 'feed'     && family && <FeedTab familyId={family.id} sitterId={null} memberId={member?.id} isSitter={false} children={children} unseenCount={0} onMarkSeen={null} sitterName={family.sitter_name || 'Sitter'} currentUserName={name} currentUserAvatar={member?.avatar || '👤'}/>}
        {tab === 'feed'     && !family && <div className="es"><div className="ic">🌸</div><h3>Not connected</h3><p>No family connected yet.</p></div>}
        {tab === 'messages' && <MessagesTabWrapper currentUserId={session.user.id} member={member} family={family} memberName={name} memberAvatar={member?.avatar || '👤'}/>}
        {tab === 'invoices' && family && <FamilyInvoicesTab familyId={family.id} currentUserId={session.user.id}/>}
        {tab === 'browse'   && <BrowseSitters session={session} familyId={family?.id} familyName={family?.name} onConnected={load}/>}
        {tab === 'profile'  && <MemberProfileTab memberId={member?.id} memberName={name} onNameChange={setName}/>}
      </div>

      {/* Modals */}
      <ChildProfileModal open={!!selectedChild} onClose={() => setSelectedChild(null)} child={selectedChild} sitterId={null} isParent={true}/>
      <ChildModal open={showAddChild || !!editChild} onClose={() => { setShowAddChild(false); setEditChild(null); }} familyId={family?.id} child={editChild || null} onSaved={load}/>
      <MemberModal open={showAddMember || !!editMember} onClose={() => { setShowAddMember(false); setEditMember(null); }} familyId={family?.id} familyName={family?.name} member={editMember || null} adminName={name} onSaved={load} canEditRole={isAdmin && editMember?.user_id !== session.user.id}/>
      <CheckinHistoryModal open={showCheckinHist} onClose={() => setShowCheckinHist(false)} familyId={family?.id} children={children}/>
      <FindSitterModal open={showFindSitter} onClose={() => setShowFindSitter(false)} familyId={family?.id} familyName={family?.name} onRequested={load}/>
      <FamilyIconPicker open={showIconPicker} onClose={() => setShowIconPicker(false)} familyId={family?.id} current={family?.icon || '👨‍👩‍👧'} onSaved={icon => { setFamily(f => ({ ...f, icon })); setShowIconPicker(false); }}/>
      <FamilyOnboarding open={showOnboarding} onClose={dismissOnboarding} familyId={family?.id} familyName={family?.name} onDone={dismissOnboarding}/>
      {reviewTarget && <LeaveReviewModal open={!!reviewTarget} onClose={() => setReviewTarget(null)} sitterId={reviewTarget.sitterId} sitterName={reviewTarget.sitterName} familyId={family?.id} reviewerId={session.user.id} reviewerName={member?.name || name}/>}
    </div>
  );
}
