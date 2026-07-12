import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DAYS } from '../../lib/constants';
import { Modal } from '../ui/Modal';
import Field from '../ui/Field';
import Spinner from '../ui/Spinner';
import SectionLabel from '../ui/SectionLabel';
import StarRating from '../ui/StarRating';

// ─── Leave a Review ───────────────────────────────────────────────────────────

export function LeaveReviewModal({ open, onClose, sitterId, sitterName, familyId, reviewerId, reviewerName }) {
  const [rating,   setRating]   = useState(0);
  const [text,     setText]     = useState('');
  const [saving,   setSaving]   = useState(false);
  const [alert,    setAlert]    = useState(null);
  const [existing, setExisting] = useState(null);

  useEffect(() => {
    if (!open) return;
    async function load() {
      const { data } = await supabase.from('sitter_reviews')
        .select('*').eq('sitter_id', sitterId).eq('family_id', familyId).maybeSingle();
      if (data) { setExisting(data); setRating(data.rating); setText(data.review_text || ''); }
      else { setExisting(null); setRating(0); setText(''); }
    }
    load();
  }, [open, sitterId, familyId]);

  async function save() {
    if (!rating) { setAlert({ t: 'e', m: 'Please select a star rating.' }); return; }
    setSaving(true);
    setAlert(null);
    const payload = {
      sitter_id: sitterId, family_id: familyId,
      reviewer_id: reviewerId, reviewer_name: reviewerName,
      rating, review_text: text.trim() || null,
    };
    const { error } = existing
      ? await supabase.from('sitter_reviews').update(payload).eq('id', existing.id)
      : await supabase.from('sitter_reviews').insert(payload);
    setSaving(false);
    if (error) { setAlert({ t: 'e', m: error.message }); return; }
    setAlert({ t: 's', m: 'Review saved! Thank you.' });
    setTimeout(onClose, 1200);
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
        {existing ? 'Edit Review' : 'Leave a Review'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16 }}>for {sitterName}</div>
      {alert && <div className={`al al-${alert.t}`} style={{ marginBottom: 12 }}>{alert.m}</div>}

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>Rating</label>
        <StarRating value={rating} onChange={setRating} size={28}/>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Review (optional)</label>
        <textarea className="fi" value={text} onChange={e => setText(e.target.value)}
          placeholder="Share your experience with this sitter…" rows={4} style={{ resize: 'vertical' }}/>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="bp" onClick={save} disabled={saving}>
          {saving ? <><Spinner/> Saving…</> : existing ? 'Update Review' : 'Submit Review'}
        </button>
        <button className="bg" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ─── Schedule Slot Modal ──────────────────────────────────────────────────────

export function ScheduleSlotModal({ open, onClose, sitterId, familyId, slot, onSaved }) {
  const [day,     setDay]     = useState(slot?.day_of_week ?? 1);
  const [start,   setStart]   = useState(slot?.start_time?.slice(0, 5) || '09:00');
  const [end,     setEnd]     = useState(slot?.end_time?.slice(0, 5) || '17:00');
  const [label,   setLabel]   = useState(slot?.label || '');
  const [loading, setLoading] = useState(false);
  const [alert,   setAlert]   = useState(null);

  useEffect(() => {
    if (open) {
      setDay(slot?.day_of_week ?? 1);
      setStart(slot?.start_time?.slice(0, 5) || '09:00');
      setEnd(slot?.end_time?.slice(0, 5) || '17:00');
      setLabel(slot?.label || '');
      setAlert(null);
    }
  }, [open, slot]);

  async function save(e) {
    e.preventDefault();
    if (end <= start) { setAlert({ t: 'e', m: 'End time must be after start time.' }); return; }
    setLoading(true);
    const data = {
      family_id: familyId, sitter_id: sitterId,
      day_of_week: day, start_time: start, end_time: end,
      label: label.trim() || null, active: true,
    };
    const { error } = slot
      ? await supabase.from('schedules').update(data).eq('id', slot.id)
      : await supabase.from('schedules').insert(data);
    setLoading(false);
    if (error) { setAlert({ t: 'e', m: error.message }); return; }
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 20 }}>
        {slot ? 'Edit Schedule' : 'Add Schedule'}
      </div>
      {alert && <div className={`al al-${alert.t}`}>{alert.m}</div>}
      <form onSubmit={save}>
        <div style={{ marginBottom: 14 }}>
          <SectionLabel>Day of week</SectionLabel>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DAYS.map((d, i) => (
              <button key={i} type="button" onClick={() => setDay(i)}
                style={{ padding: '7px 10px', borderRadius: 10, fontSize: 12, cursor: 'pointer', border: `1px solid ${day === i ? '#7BAAEE' : 'rgba(255,255,255,.1)'}`, background: day === i ? 'rgba(111,163,232,.15)' : 'rgba(255,255,255,.04)', color: day === i ? '#7BAAEE' : 'rgba(255,255,255,.5)' }}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label className="fl">Start time</label>
            <input className="fi" type="time" value={start} onChange={e => setStart(e.target.value)} required/>
          </div>
          <div style={{ flex: 1 }}>
            <label className="fl">End time</label>
            <input className="fi" type="time" value={end} onChange={e => setEnd(e.target.value)} required/>
          </div>
        </div>
        <Field label="Label (optional)" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. After school, Morning" required={false}/>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" className="bp full" disabled={loading}>
            {loading ? <Spinner/> : slot ? 'Save Changes' : 'Add to Schedule'}
          </button>
          <button type="button" className="bg" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
