import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { POST_TYPES, POST_MOODS } from '../../lib/constants';
import { invokeNotification, sendPushNotification } from '../../services/push';
import { Modal } from '../ui/Modal';
import Spinner from '../ui/Spinner';
import SectionLabel from '../ui/SectionLabel';

export default function NewPostModal({
  open, onClose, familyId, sitterId, sitterName, familyName,
  children, onPosted, startWithPhoto = false,
}) {
  const [type,    setType]    = useState('note');
  const [mood,    setMood]    = useState('');
  const [text,    setText]    = useState('');
  const [tagged,  setTagged]  = useState([]);
  const [photo,   setPhoto]   = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert,   setAlert]   = useState(null);
  const fileInputRef          = useRef(null);

  useEffect(() => {
    if (open && startWithPhoto) {
      setTimeout(() => fileInputRef.current?.click(), 100);
    }
  }, [open, startWithPhoto]);

  function reset() {
    setType('note'); setMood(''); setText(''); setTagged([]);
    setPhoto(null); setPreview(null); setAlert(null);
  }

  function close() { if (loading) return; reset(); onClose(); }

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setAlert({ t: 'e', m: 'Photo must be under 10MB.' }); return; }
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  }

  function toggleChild(id) {
    setTagged(t => t.includes(id) ? t.filter(x => x !== id) : [...t, id]);
  }

  async function submit(e) {
    e.preventDefault();
    if (!text.trim() && !photo) { setAlert({ t: 'e', m: 'Add some text or a photo.' }); return; }
    setLoading(true);
    setAlert(null);
    try {
      let photo_url = null;
      if (photo) {
        const ext  = photo.name.split('.').pop();
        const path = `${familyId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('post-photos').upload(path, photo, { contentType: photo.type });
        if (upErr) throw upErr;
        const urlResult = supabase.storage.from('post-photos').getPublicUrl(path);
        photo_url = urlResult?.data?.publicUrl || null;
        if (!photo_url) throw new Error('Could not get photo URL. Check that the post-photos bucket is set to public in Supabase Storage.');
      }

      const { data: post, error: postErr } = await supabase.from('posts').insert({
        family_id: familyId, author_id: sitterId, author_role: 'sitter',
        type, mood: mood || null, text: text.trim() || null, photo_url,
      }).select().single();
      if (postErr) throw postErr;

      if (tagged.length > 0) {
        await supabase.from('post_children').insert(tagged.map(child_id => ({ post_id: post.id, child_id })));
      }

      invokeNotification({ body: {
        type: 'new_post',
        payload: { familyId, sitterName, familyName, postType: type, postContent: text.trim() },
      }}).catch(console.error);

      supabase.from('members').select('user_id')
        .eq('family_id', familyId).in('role', ['admin', 'member']).eq('status', 'active')
        .then(({ data: mems }) => {
          const ids = (mems || []).map(m => m.user_id).filter(Boolean);
          sendPushNotification(ids, `New update from ${sitterName}`, text.trim().slice(0, 80) || 'Tap to see the latest update', '/?portal=parent', 'new_post');
        });

      reset();
      onPosted();
      onClose();
    } catch (err) {
      setAlert({ t: 'e', m: err.message || 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={close}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
        {startWithPhoto && !preview ? '📷 Add a Photo' : 'New Post'}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 20, lineHeight: 1.6 }}>
        {startWithPhoto && !preview ? 'Choose a photo to share with this family.' : 'Share an update with this family.'}
      </p>
      {alert && <div className={`al al-${alert.t}`}>{alert.m}</div>}

      <form onSubmit={submit}>
        {/* Photo — shown first in photo mode */}
        <div style={{ marginBottom: 16, order: startWithPhoto ? -1 : 0 }}>
          {!startWithPhoto && <SectionLabel>Photo (optional)</SectionLabel>}
          {preview
            ? (
              <div style={{ position: 'relative' }}>
                <img src={preview} alt="preview" style={{ width: '100%', maxHeight: startWithPhoto ? 360 : 200, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }}/>
                <button type="button" onClick={() => { setPhoto(null); setPreview(null); }}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.6)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 14 }}>✕</button>
                <label style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,.5)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: '#fff' }}>
                  Change <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }}/>
                </label>
              </div>
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: startWithPhoto ? '40px 16px' : '12px 16px', borderRadius: 12, border: `1px dashed ${startWithPhoto ? 'rgba(58,111,212,.4)' : 'rgba(255,255,255,.15)'}`, cursor: 'pointer', color: 'var(--text-dim)', fontSize: 13, background: startWithPhoto ? 'rgba(58,111,212,.05)' : 'transparent' }}>
                <span style={{ fontSize: startWithPhoto ? 36 : 20 }}>📷</span>
                <span>{startWithPhoto ? 'Tap to choose a photo' : 'Choose a photo'}</span>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }}/>
              </label>
            )
          }
        </div>

        <div style={{ marginBottom: 14 }}>
          <SectionLabel>Type</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {POST_TYPES.map(t => (
              <button key={t.id} type="button" onClick={() => setType(t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, border: `1px solid ${type === t.id ? '#7BAAEE' : 'rgba(255,255,255,.1)'}`, background: type === t.id ? 'rgba(111,163,232,.15)' : 'rgba(255,255,255,.04)', color: type === t.id ? '#7BAAEE' : 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer' }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <SectionLabel>Mood (optional)</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {POST_MOODS.map(m => (
              <button key={m.id} type="button" onClick={() => setMood(mood === m.id ? '' : m.id)}
                style={{ width: 36, height: 36, borderRadius: 10, border: `2px solid ${mood === m.id ? '#7BAAEE' : 'rgba(255,255,255,.1)'}`, background: mood === m.id ? 'rgba(111,163,232,.15)' : 'rgba(255,255,255,.04)', cursor: 'pointer', fontSize: 20 }}>
                {m.icon}
              </button>
            ))}
          </div>
        </div>

        {children.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Tag children (optional)</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {children.map(c => (
                <button key={c.id} type="button" onClick={() => toggleChild(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, border: `1px solid ${tagged.includes(c.id) ? c.color || '#7BAAEE' : 'rgba(255,255,255,.1)'}`, background: tagged.includes(c.id) ? `${c.color || '#8B78D4'}22` : 'rgba(255,255,255,.04)', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer' }}>
                  {c.avatar} {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="fl">{startWithPhoto ? 'Caption (optional)' : 'Update'}</label>
          <textarea className="fi" value={text} onChange={e => setText(e.target.value)}
            placeholder={startWithPhoto ? 'Add a caption…' : "What's happening today?"}
            rows={3} style={{ resize: 'vertical', marginBottom: 14 }}/>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="bp full" disabled={loading}>
            {loading ? <><Spinner/> Posting…</> : 'Post Update'}
          </button>
          <button type="button" className="bg" onClick={close}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
