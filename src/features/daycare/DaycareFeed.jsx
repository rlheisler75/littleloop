import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { POST_TYPES, POST_MOODS } from '../../lib/constants';
import { invokeNotification } from '../../services/push';
import { timeAgo, getTypeIcon, getMoodIcon } from '../../services/format';
import { Confirm } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import SectionLabel from '../../components/ui/SectionLabel';
import PhotoLightbox from '../children/PhotoLightbox';
import { errText } from './api';
import { loadPhotoConsent } from './enrollment';

// Classroom updates: one post to a room (or a few children) lands in each family's feed,
// tagged with only that family's children.
export default function DaycareFeed({ facility, facilityId, myName }) {
  const [rooms,    setRooms]    = useState([]);
  const [kids,     setKids]     = useState([]);     // enrolled children with classroom_id
  const [posts,    setPosts]    = useState([]);     // grouped
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [photoOk,  setPhotoOk]  = useState({});     // family_id -> 'yes' | 'no'

  const load = useCallback(async () => {
    const [{ data: rm }, { data: en }, { data: ps }, consent] = await Promise.all([
      supabase.from('classrooms').select('id, name, color').eq('facility_id', facilityId).eq('active', true).order('sort').order('name'),
      supabase.from('facility_enrollments').select('child_id, classroom_id').eq('facility_id', facilityId).eq('status', 'active'),
      supabase.from('posts').select('id, family_id, author_id, author_name, type, mood, text, photo_url, created_at')
        .eq('facility_id', facilityId).order('created_at', { ascending: false }).limit(150),
      loadPhotoConsent(facilityId),
    ]);
    setPhotoOk(consent || {});
    const ids = (en || []).map(e => e.child_id);
    const roomOf = Object.fromEntries((en || []).map(e => [e.child_id, e.classroom_id]));
    const postIds = (ps || []).map(p => p.id);
    const [{ data: ch }, { data: pc }] = await Promise.all([
      ids.length ? supabase.from('children').select('id, name, preferred_name, avatar, color, family_id').in('id', ids).order('name') : { data: [] },
      postIds.length ? supabase.from('post_children').select('post_id, child_id').in('post_id', postIds) : { data: [] },
    ]);
    setRooms(rm || []);
    setKids((ch || []).map(c => ({ ...c, classroom_id: roomOf[c.id] || null })));

    // One classroom update is stored as one post per family; show it once.
    const childName = Object.fromEntries((ch || []).map(c => [c.id, c.preferred_name || c.name]));
    const tags = (pc || []).reduce((g, r) => ((g[r.post_id] ||= []).push(r.child_id), g), {});
    const groups = [];
    const byKey = {};
    for (const p of ps || []) {
      const key = [p.author_id, p.created_at.slice(0, 19), p.type, p.text || '', p.photo_url || ''].join('|');
      if (!byKey[key]) { byKey[key] = { ...p, ids: [], kids: [] }; groups.push(byKey[key]); }
      byKey[key].ids.push(p.id);
      byKey[key].kids.push(...(tags[p.id] || []).map(id => childName[id] || 'a child'));
    }
    setPosts(groups.slice(0, 40));
    setLoading(false);
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  async function remove() {
    const g = deleting;
    setDeleting(null);
    const { error } = await supabase.from('posts').delete().in('id', g.ids);
    if (error) console.error('delete post failed:', error);
    load();
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;

  return (
    <div>
      <Composer facility={facility} facilityId={facilityId} myName={myName} rooms={rooms} kids={kids} photoOk={photoOk} onPosted={load}/>

      <SectionLabel>Recent updates</SectionLabel>
      {posts.length === 0
        ? <div className="es" style={{ padding: '30px 20px' }}><div className="ic">🌸</div><h3>No updates yet</h3><p>Share what the class did today. Each family sees it in their feed.</p></div>
        : posts.map(p => (
          <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
            {p.photo_url && <img src={p.photo_url} alt="" onClick={() => setLightbox(p.photo_url)} style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block', cursor: 'zoom-in' }}/>}
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {getTypeIcon(p.type)} {p.author_name || 'Staff'} {p.mood && <span>{getMoodIcon(p.mood)}</span>}
                  <span style={{ fontWeight: 500, fontSize: 11, color: 'var(--text-faint)' }}> · {timeAgo(p.created_at)}</span>
                </div>
                <button onClick={() => setDeleting(p)} aria-label="Delete update" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: .45 }}>🗑️</button>
              </div>
              {p.text && <p style={{ fontSize: 14, lineHeight: 1.6, margin: '8px 0' }}>{p.text}</p>}
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                Sent to {p.ids.length} famil{p.ids.length === 1 ? 'y' : 'ies'}{p.kids.length ? ` · ${[...new Set(p.kids)].join(', ')}` : ''}
              </div>
            </div>
          </div>
        ))}

      {lightbox && <PhotoLightbox url={lightbox} onClose={() => setLightbox(null)}/>}
      <Confirm open={!!deleting} danger title="Delete this update?"
        message={`It will be removed from ${deleting?.ids.length || 0} famil${deleting?.ids.length === 1 ? 'y\'s feed' : 'ies\' feeds'}, with any comments.`}
        onConfirm={remove} onCancel={() => setDeleting(null)}/>
    </div>
  );
}

function Composer({ facility, facilityId, myName, rooms, kids, photoOk, onPosted }) {
  const [room,    setRoom]    = useState(rooms[0]?.id || 'all');
  const [picked,  setPicked]  = useState([]);
  const [type,    setType]    = useState('activity');
  const [mood,    setMood]    = useState('');
  const [text,    setText]    = useState('');
  const [photo,   setPhoto]   = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [alert,   setAlert]   = useState(null);
  const fileRef = useRef(null);

  const roomKids = room === 'all' ? kids : kids.filter(k => k.classroom_id === room);
  // Switching rooms selects the whole room.
  useEffect(() => { setPicked(roomKids.filter(k => !(photo && noPhoto(k))).map(k => k.id)); }, [room, kids.length]);

  // Families who said no to photos: their children can't be in a post with a photo.
  const noPhoto = k => photoOk[k.family_id] === 'no';
  const blocked = id => !!photo && noPhoto(kids.find(k => k.id === id) || {});
  const toggle = id => { if (blocked(id)) return; setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); };

  function choosePhoto(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setAlert({ t: 'e', m: 'Photo must be under 10MB.' }); return; }
    setPhoto(f); setPreview(URL.createObjectURL(f));
    const removed = kids.filter(k => picked.includes(k.id) && noPhoto(k));
    if (removed.length) {
      setPicked(p => p.filter(id => !removed.some(k => k.id === id)));
      setAlert({ t: 'w', m: `Took ${removed.map(k => k.preferred_name || k.name).join(', ')} off this post: their family said no to photos. Post a text-only update for them.` });
    }
  }

  async function post() {
    setAlert(null);
    if (!picked.length) { setAlert({ t: 'e', m: 'Pick at least one child.' }); return; }
    if (!text.trim() && !photo) { setAlert({ t: 'e', m: 'Add some text or a photo.' }); return; }
    setSaving(true);
    try {
      let photo_url = null;
      if (photo) {
        const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `daycare-${facilityId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('post-photos').upload(path, photo, { contentType: photo.type });
        if (upErr) throw upErr;
        photo_url = supabase.storage.from('post-photos').getPublicUrl(path)?.data?.publicUrl || null;
      }
      const { data: created, error } = await supabase.rpc('post_to_children', {
        p_child_ids: picked, p_type: type, p_mood: mood || null, p_text: text.trim() || null, p_photo_url: photo_url,
      });
      if (error) throw error;
      const by = `${myName} (${facility.name})`.slice(0, 60);
      for (const row of created || []) {
        invokeNotification({ body: { type: 'new_post', payload: { familyId: row.family_id, postId: row.post_id, sitterName: by, postType: type, postContent: text.trim() } } });
      }
      setText(''); setMood(''); setPhoto(null); setPreview(null);
      setAlert({ t: 's', m: `Posted to ${created?.length || 0} famil${created?.length === 1 ? 'y' : 'ies'}.` });
      onPosted();
    } catch (err) {
      setAlert({ t: 'e', m: errText(err) });
    } finally {
      setSaving(false);
    }
  }

  if (!kids.length) return (
    <div className="al al-i" style={{ marginBottom: 18 }}>Enroll a family first. Updates go to the families of the children you pick.</div>
  );

  return (
    <div className="card" style={{ padding: '16px 16px 14px', marginBottom: 20 }}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 10 }}>Share an update</div>
      {alert && <div className={`al al-${alert.t}`}>{alert.m}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {[...rooms.map(r => ({ id: r.id, label: r.name, color: r.color })), { id: 'all', label: 'All children' }].map(r => (
          <Pill key={r.id} on={room === r.id} onClick={() => setRoom(r.id)}>
            {r.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, display: 'inline-block' }}/>} {r.label}
          </Pill>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{picked.length} of {roomKids.length} children · {new Set(kids.filter(k => picked.includes(k.id)).map(k => k.family_id)).size} families</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setPicked(roomKids.filter(k => !blocked(k.id)).map(k => k.id))} style={linkBtn}>All</button>
          <button type="button" onClick={() => setPicked([])} style={linkBtn}>None</button>
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, maxHeight: 150, overflowY: 'auto' }}>
        {roomKids.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>No children in this room.</span>}
        {roomKids.map(k => (
          <button key={k.id} type="button" onClick={() => toggle(k.id)} disabled={blocked(k.id)}
            title={noPhoto(k) ? 'Family said no to photos' : undefined}
            aria-label={`${k.preferred_name || k.name}${noPhoto(k) ? ' (family said no to photos)' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 20, fontSize: 12, cursor: blocked(k.id) ? 'not-allowed' : 'pointer',
              border: `1px solid ${picked.includes(k.id) ? (k.color || 'var(--accent)') : 'var(--border)'}`,
              background: picked.includes(k.id) ? `${k.color || '#8B78D4'}22` : 'var(--input-bg)', color: 'var(--text-dim)', opacity: picked.includes(k.id) ? 1 : .6 }}>
            {k.avatar || '🌟'} {k.preferred_name || k.name}{noPhoto(k) && ' 📵'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {POST_TYPES.map(t => <Pill key={t.id} on={type === t.id} onClick={() => setType(t.id)}>{t.icon} {t.label}</Pill>)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {POST_MOODS.map(m => (
          <button key={m.id} type="button" onClick={() => setMood(mood === m.id ? '' : m.id)} aria-label={m.id} aria-pressed={mood === m.id}
            style={{ width: 34, height: 34, borderRadius: 10, fontSize: 18, cursor: 'pointer', border: `2px solid ${mood === m.id ? 'var(--accent)' : 'var(--border)'}`, background: mood === m.id ? 'color-mix(in srgb,var(--accent) 15%,transparent)' : 'var(--input-bg)' }}>
            {m.icon}
          </button>
        ))}
      </div>

      <textarea className="fi" rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="What did the class do today?" style={{ resize: 'vertical' }} maxLength={5000}/>

      {preview && (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <img src={preview} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12 }}/>
          <button type="button" onClick={() => { setPhoto(null); setPreview(null); }} aria-label="Remove photo"
            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.6)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: '#fff' }}>✕</button>
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10 }}>
        A photo goes to every family you picked. Only share group photos when each family is fine with that.
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="bg" onClick={() => fileRef.current?.click()}>📷 Photo</button>
        <input ref={fileRef} type="file" accept="image/*" onChange={choosePhoto} style={{ display: 'none' }}/>
        <button type="button" className="bp" style={{ marginLeft: 'auto' }} disabled={saving} onClick={post}>
          {saving ? <><Spinner/> Posting…</> : 'Post update'}
        </button>
      </div>
    </div>
  );
}

const linkBtn = { background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 };

function Pill({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
        border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'color-mix(in srgb,var(--accent) 15%,transparent)' : 'var(--input-bg)', color: on ? 'var(--accent)' : 'var(--text-dim)' }}>
      {children}
    </button>
  );
}
