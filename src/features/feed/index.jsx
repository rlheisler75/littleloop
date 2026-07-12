import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { subscribeToPush, invokeNotification, sendPushNotification } from '../../services/push';
import { timeAgo, getMoodIcon, getTypeIcon } from '../../services/format';
import { POST_TYPES } from '../../lib/constants';
import PhotoLightbox from '../children/PhotoLightbox';
import NewPostModal from '../../components/modals/NewPostModal';
import { Confirm } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

// ─── Post Card ────────────────────────────────────────────────────────────────

export function PostCard({ post, taggedChildren, currentUserId, memberId, isSitter, onDeleted, sitterName = 'Sitter', currentUserName = '', currentUserAvatar = '👤' }) {
  const [comments,     setComments]     = useState([]);
  const [likes,        setLikes]        = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment,   setNewComment]   = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [confirmDel,   setConfirmDel]   = useState(false);
  const [lightbox,     setLightbox]     = useState(false);

  const myLike = likes.find(l => l.member_id === memberId);
  const liked  = !!myLike;

  useEffect(() => { loadLikes(); }, [post.id]);
  useEffect(() => { if (showComments) loadComments(); }, [showComments, post.id]);

  async function loadLikes() {
    const { data } = await supabase.from('post_likes').select('*').eq('post_id', post.id);
    setLikes(data || []);
  }

  async function loadComments() {
    const { data } = await supabase.from('post_comments').select('*').eq('post_id', post.id).order('created_at', { ascending: true });
    setComments(data || []);
  }

  async function toggleLike() {
    if (!memberId) return;
    if (liked) await supabase.from('post_likes').delete().eq('post_id', post.id).eq('member_id', memberId);
    else        await supabase.from('post_likes').insert({ post_id: post.id, member_id: memberId });
    loadLikes();
  }

  async function addComment() {
    if (!newComment.trim()) return;
    setSubmitting(true);
    await supabase.from('post_comments').insert({
      post_id: post.id, author_id: currentUserId,
      author_role: isSitter ? 'sitter' : 'parent',
      author_name: isSitter ? sitterName : currentUserName,
      author_avatar: isSitter ? '➿' : currentUserAvatar,
      text: newComment.trim(),
    });
    setNewComment('');
    setSubmitting(false);
    loadComments();
  }

  return (
    <div className="card" style={{ padding: 0, marginBottom: 14, overflow: 'hidden' }}>
      {lightbox && <PhotoLightbox url={post.photo_url} onClose={() => setLightbox(false)}/>}

      {post.photo_url && (
        <div style={{ cursor: 'zoom-in', position: 'relative' }} onClick={() => setLightbox(true)}>
          <img src={post.photo_url} alt="post" style={{ width: '100%', maxHeight: post.text ? 360 : 520, minHeight: post.text ? 200 : 280, objectFit: 'cover', display: 'block' }}/>
          {!post.text && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(0,0,0,.6))', padding: '32px 14px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#3A6FD4,#3A9E7A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>➿</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{sitterName}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)' }}>{timeAgo(post.created_at)}</div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,.5)' }}>tap to expand</div>
            </div>
          )}
          {post.text && (
            <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,.4)', borderRadius: 6, padding: '3px 7px', fontSize: 10, color: 'rgba(255,255,255,.7)' }}>tap to expand</div>
          )}
        </div>
      )}

      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg,#3A6FD4,#3A9E7A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>➿</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{sitterName}</span>
                <span style={{ fontSize: 16 }}>{getTypeIcon(post.type)}</span>
                {post.mood && <span style={{ fontSize: 16 }}>{getMoodIcon(post.mood)}</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{timeAgo(post.created_at)}</div>
            </div>
          </div>
          {isSitter && <button onClick={() => setConfirmDel(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: .4, padding: 4 }}>🗑️</button>}
        </div>

        {post.text && <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text)', marginBottom: 10 }}>{post.text}</p>}

        {taggedChildren.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {taggedChildren.map(c => <span key={c.id} className="chip" style={{ fontSize: 11 }}>{c.avatar} {c.name}</span>)}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          {memberId && (
            <button onClick={toggleLike} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: liked ? '#F5AAAA' : 'rgba(255,255,255,.35)', fontSize: 12, padding: 0 }}>
              <span style={{ fontSize: 16 }}>{liked ? '❤️' : '🤍'}</span>
              {likes.length > 0 && <span>{likes.length}</span>}
            </button>
          )}
          <button onClick={() => setShowComments(!showComments)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: showComments ? '#7BAAEE' : 'rgba(255,255,255,.35)', fontSize: 12, padding: 0 }}>
            <span style={{ fontSize: 16 }}>💬</span>
            <span>{comments.length > 0 ? comments.length : 'Comment'}</span>
          </button>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)', textTransform: 'capitalize' }}>{post.type}</span>
        </div>

        {showComments && (
          <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 12 }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{c.author_avatar}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{c.author_name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{timeAgo(c.created_at)}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>{c.text}</p>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input className="fi" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment…" style={{ marginBottom: 0, flex: 1 }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}/>
              <button className="bp" onClick={addComment} disabled={submitting || !newComment.trim()} style={{ padding: '8px 14px', flexShrink: 0 }}>
                {submitting ? <Spinner/> : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>

      <Confirm open={confirmDel} title="Delete post?" message="This will permanently delete this post and all its comments." danger
        onConfirm={async () => { await supabase.from('posts').delete().eq('id', post.id); setConfirmDel(false); onDeleted(); }}
        onCancel={() => setConfirmDel(false)}/>
    </div>
  );
}

// ─── Feed Tab ─────────────────────────────────────────────────────────────────

export function FeedTab({ familyId, sitterId, memberId, isSitter, children, unseenCount, onMarkSeen, sitterName = 'Sitter', currentUserName = '', currentUserAvatar = '👤', familyName = '' }) {
  const [posts,     setPosts]     = useState([]);
  const [postKids,  setPostKids]  = useState({});
  const [loading,   setLoading]   = useState(true);
  const [showNew,   setShowNew]   = useState(false);
  const [photoFirst,setPhotoFirst]= useState(false);
  const [filter,    setFilter]    = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const { data: ps } = await supabase.from('posts').select('*').eq('family_id', familyId).order('created_at', { ascending: false });
    setPosts(ps || []);
    if (ps?.length) {
      const { data: pc } = await supabase.from('post_children').select('*').in('post_id', ps.map(p => p.id));
      const g = {};
      (pc || []).forEach(r => { if (!g[r.post_id]) g[r.post_id] = []; g[r.post_id].push(r.child_id); });
      setPostKids(g);
      if (unseenCount > 0 && onMarkSeen) onMarkSeen(ps.map(p => p.id));
    }
    setLoading(false);
  }, [familyId, unseenCount]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (sitterId) subscribeToPush(sitterId); }, [sitterId]);

  useEffect(() => {
    const sub = supabase.channel(`feed-${familyId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `family_id=eq.${familyId}` }, () => load())
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [familyId]);

  const childMap = {};
  children.forEach(c => { childMap[c.id] = c; });
  const filtered = filter === 'all' ? posts : posts.filter(p => p.type === filter);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600 }}>
          Feed
          {unseenCount > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: '#3A6FD4', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>{unseenCount}</span>}
        </div>
        {isSitter && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="bg" onClick={() => { setPhotoFirst(true); setShowNew(true); }} style={{ padding: '7px 12px', fontSize: 13 }}>📷</button>
            <button className="bp" onClick={() => { setPhotoFirst(false); setShowNew(true); }}>+ Post</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {[{ id: 'all', icon: '📋', label: 'All' }, ...POST_TYPES].map(t => (
          <button key={t.id} type="button" onClick={() => setFilter(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: 20, border: `1px solid ${filter === t.id ? '#7BAAEE' : 'rgba(255,255,255,.1)'}`, background: filter === t.id ? 'rgba(111,163,232,.15)' : 'rgba(255,255,255,.04)', color: filter === t.id ? '#7BAAEE' : 'rgba(255,255,255,.4)', fontSize: 11, cursor: 'pointer' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading
        ? <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>
        : filtered.length === 0
          ? <div className="es"><div className="ic">🌸</div><h3>No posts yet</h3><p>{isSitter ? 'Share your first update with this family.' : "Your sitter hasn't posted yet."}</p>{isSitter && <button className="bp" onClick={() => setShowNew(true)}>+ Post an update</button>}</div>
          : <div>{filtered.map(p => <PostCard key={p.id} post={p} taggedChildren={(postKids[p.id] || []).map(id => childMap[id]).filter(Boolean)} currentUserId={sitterId || memberId} memberId={memberId} isSitter={isSitter} onDeleted={load} sitterName={sitterName} currentUserName={currentUserName} currentUserAvatar={currentUserAvatar}/>)}</div>
      }

      {isSitter && (
        <NewPostModal open={showNew} onClose={() => { setShowNew(false); setPhotoFirst(false); }}
          familyId={familyId} sitterId={sitterId} sitterName={sitterName} familyName={familyName}
          children={children} onPosted={load} startWithPhoto={photoFirst}/>
      )}
    </div>
  );
}

// ─── Sitter feed wrapper ──────────────────────────────────────────────────────

export function SitterFeedWrapper({ sitterId, sitterName }) {
  const [families,  setFamilies]  = useState([]);
  const [children,  setChildren]  = useState({});
  const [selected,  setSelected]  = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      const { data: fsRows } = await supabase.from('family_sitters').select('status,families(*)').eq('sitter_id', sitterId).neq('status', 'inactive').order('joined_at', { ascending: false });
      const fams = (fsRows || []).map(r => r.families).filter(Boolean);
      setFamilies(fams);
      if (fams.length) {
        setSelected(fams[0].id);
        const { data: kids } = await supabase.from('children').select('*').in('family_id', fams.map(f => f.id));
        const g = {};
        (kids || []).forEach(k => { if (!g[k.family_id]) g[k.family_id] = []; g[k.family_id].push(k); });
        setChildren(g);
      }
      setLoading(false);
    }
    load();
  }, [sitterId]);

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;
  if (!families.length) return <div className="es"><div className="ic">🌸</div><h3>No families yet</h3><p>Invite a family first to start posting updates.</p></div>;

  return (
    <div>
      {families.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {families.map(f => (
            <button key={f.id} type="button" onClick={() => setSelected(f.id)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${selected === f.id ? '#7BAAEE' : 'rgba(255,255,255,.1)'}`, background: selected === f.id ? 'rgba(111,163,232,.15)' : 'rgba(255,255,255,.04)', color: selected === f.id ? '#7BAAEE' : 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer' }}>
              {f.name}
            </button>
          ))}
        </div>
      )}
      {selected && (
        <FeedTab familyId={selected} sitterId={sitterId} memberId={null} isSitter={true}
          children={children[selected] || []} unseenCount={0} onMarkSeen={null}
          sitterName={sitterName} currentUserName={sitterName} currentUserAvatar="➿"
          familyName={families.find(f => f.id === selected)?.name || ''}/>
      )}
    </div>
  );
}
