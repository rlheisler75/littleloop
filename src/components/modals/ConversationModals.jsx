import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ROLE_LABELS } from '../../lib/constants';
import { Modal } from '../ui/Modal';
import Field from '../ui/Field';
import Spinner from '../ui/Spinner';
import SectionLabel from '../ui/SectionLabel';
import SitterAvatar from '../ui/SitterAvatar';

// ─── New Conversation Modal ───────────────────────────────────────────────────

export function NewConversationModal({
  open, onClose, familyId, currentUserId, isSitter,
  families = [], members, sitterName, sitterAvatar, onCreated,
}) {
  const [title,           setTitle]           = useState('');
  const [selected,        setSelected]        = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [alert,           setAlert]           = useState(null);
  const [availableMembers,setAvailableMembers]= useState([]);
  const [availableSitters,setAvailableSitters]= useState([]);
  const [selectedSitters, setSelectedSitters] = useState([]);
  const [selectedFamily,  setSelectedFamily]  = useState(familyId || '');

  function reset() { setTitle(''); setSelected([]); setAlert(null); }
  function close() { if (loading) return; reset(); onClose(); }
  function toggleMember(m) {
    setSelected(s => s.find(x => x.user_id === m.user_id) ? s.filter(x => x.user_id !== m.user_id) : [...s, m]);
  }

  useEffect(() => {
    if (!open) return;
    setSelectedFamily(familyId || '');
    setSelected([]);
    setSelectedSitters([]);
  }, [open, familyId]);

  useEffect(() => {
    if (!selectedFamily) return;
    async function loadMembers() {
      const { data } = await supabase.from('members').select('*').eq('family_id', selectedFamily);
      setAvailableMembers((data || []).filter(m =>
        m.user_id && m.user_id !== currentUserId && ['admin', 'member'].includes(m.role)
      ));
    }
    async function loadSitters() {
      const { data } = await supabase.from('family_sitters')
        .select('sitter_id, sitters(id,name,avatar_url)')
        .eq('family_id', selectedFamily).eq('status', 'active');
      setAvailableSitters((data || []).map(r => ({ id: r.sitter_id, ...r.sitters })));
      if ((data || []).length === 1) setSelectedSitters([data[0].sitter_id]);
    }
    loadMembers();
    if (!isSitter) loadSitters();
  }, [selectedFamily, currentUserId, isSitter]);

  async function create(e) {
    e.preventDefault();
    if (isSitter && selected.length === 0) { setAlert({ t: 'e', m: 'Select at least one family member.' }); return; }
    setLoading(true);
    setAlert(null);
    try {
      const { data: conv, error: convErr } = await supabase.from('conversations').insert({
        family_id:  selectedFamily || familyId,
        created_by: currentUserId,
        title:      title.trim() || null,
      }).select().single();
      if (convErr) throw convErr;

      const participants = [
        { conversation_id: conv.id, user_id: currentUserId, participant_name: isSitter ? sitterName : 'You', participant_avatar: isSitter ? '➿' : sitterAvatar || '👤', is_sitter: isSitter },
        ...selected.map(m => ({ conversation_id: conv.id, user_id: m.user_id, participant_name: m.name, participant_avatar: m.avatar || '👤', is_sitter: false })),
      ];

      if (!isSitter) {
        const sittersToAdd = selectedSitters.length > 0
          ? availableSitters.filter(s => selectedSitters.includes(s.id))
          : availableSitters;
        for (const s of sittersToAdd) {
          participants.push({ conversation_id: conv.id, user_id: s.id, participant_name: s.name || 'Sitter', participant_avatar: s.avatar_url || '➿', is_sitter: true });
        }
      }

      const { error: partErr } = await supabase.from('conversation_participants').insert(participants);
      if (partErr) throw partErr;

      reset();
      onCreated(conv.id);
      onClose();
    } catch (err) {
      setAlert({ t: 'e', m: err.message || 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={close}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 600, marginBottom: 4 }}>New Conversation</div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 20, lineHeight: 1.6 }}>
        {isSitter ? 'Start a conversation with family members.' : 'Start a conversation with your sitter and family members.'}
      </p>
      {alert && <div className={`al al-${alert.t}`}>{alert.m}</div>}

      <form onSubmit={create}>
        {isSitter && families.length > 1 && (
          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Family</SectionLabel>
            <select className="fi" value={selectedFamily} onChange={e => { setSelectedFamily(e.target.value); setSelected([]); }} style={{ marginBottom: 0 }}>
              <option value="">Select a family…</option>
              {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}

        {!isSitter && availableSitters.length > 1 && (
          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Message which sitter?</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {availableSitters.map(s => {
                const sel = selectedSitters.includes(s.id);
                return (
                  <div key={s.id} onClick={() => setSelectedSitters(prev => sel ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${sel ? '#7BAAEE' : 'rgba(255,255,255,.1)'}`, background: sel ? 'rgba(111,163,232,.1)' : 'rgba(255,255,255,.03)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: 'var(--card-bg)', border: '1px solid var(--border)', flexShrink: 0 }}>
                      <SitterAvatar url={s.avatar_url} name={s.name} size={32} radius="0"/>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{s.name}</span>
                    {sel && <span style={{ fontSize: 14, color: '#7BAAEE' }}>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isSitter && availableSitters.length === 0 && (
          <div className="al al-i" style={{ marginBottom: 12 }}>No connected sitters yet. Connect with a sitter from the Home tab first.</div>
        )}

        <Field label="Title (optional)" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Emma's schedule" required={false} autoComplete="off"/>

        <div style={{ marginBottom: 16 }}>
          <SectionLabel>{isSitter ? 'Add family members' : 'Add more family members (optional)'}</SectionLabel>
          {!isSitter && availableSitters.length === 1 && (
            <p style={{ fontSize: 11, color: 'rgba(88,158,122,.8)', marginBottom: 8 }}>✓ {availableSitters[0]?.name || 'Your sitter'} will be included</p>
          )}
          {availableMembers.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>{isSitter ? 'No family members available yet.' : 'No other members to add.'}</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {availableMembers.map(m => {
                  const sel = !!selected.find(x => x.user_id === m.user_id);
                  return (
                    <div key={m.id} onClick={() => toggleMember(m)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, border: `1px solid ${sel ? '#7BAAEE' : 'rgba(255,255,255,.07)'}`, background: sel ? 'rgba(111,163,232,.1)' : 'rgba(255,255,255,.03)', cursor: 'pointer' }}>
                      <span style={{ fontSize: 22 }}>{m.avatar || '👤'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{ROLE_LABELS[m.role]}</div>
                      </div>
                      <span style={{ fontSize: 16 }}>{sel ? '✅' : '○'}</span>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="bp full" disabled={loading || (isSitter && selected.length === 0)}>
            {loading ? <><Spinner/> Creating…</> : 'Start Conversation'}
          </button>
          <button type="button" className="bg" onClick={close}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Add Participant Modal ────────────────────────────────────────────────────

export function AddParticipantModal({ open, onClose, convId, familyId, currentParticipants, currentUserId, isSitter, onAdded }) {
  const [members,  setMembers]  = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!open) return;
    async function load() {
      const { data } = await supabase.from('members').select('*').eq('family_id', familyId);
      setMembers((data || []).filter(m =>
        m.user_id &&
        m.user_id !== currentUserId &&
        ['admin', 'member'].includes(m.role) &&
        !currentParticipants.find(p => p.user_id === m.user_id)
      ));
    }
    load();
  }, [open, familyId, currentParticipants]);

  async function add() {
    if (selected.length === 0) return;
    setLoading(true);
    await supabase.from('conversation_participants').insert(
      selected.map(m => ({ conversation_id: convId, user_id: m.user_id, participant_name: m.name, participant_avatar: m.avatar || '👤', is_sitter: false }))
    );
    setLoading(false);
    setSelected([]);
    onAdded();
    onClose();
  }

  function toggle(m) {
    setSelected(s => s.find(x => x.user_id === m.user_id) ? s.filter(x => x.user_id !== m.user_id) : [...s, m]);
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 16 }}>Add People</div>
      {members.length === 0
        ? <p style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 20 }}>Everyone is already in this conversation.</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {members.map(m => {
              const sel = !!selected.find(x => x.user_id === m.user_id);
              return (
                <div key={m.id} onClick={() => toggle(m)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, border: `1px solid ${sel ? '#7BAAEE' : 'rgba(255,255,255,.07)'}`, background: sel ? 'rgba(111,163,232,.1)' : 'rgba(255,255,255,.03)', cursor: 'pointer' }}>
                  <span style={{ fontSize: 22 }}>{m.avatar || '👤'}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{m.name}</span>
                  <span style={{ fontSize: 16 }}>{sel ? '✅' : '○'}</span>
                </div>
              );
            })}
          </div>
        )
      }
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="bp full" onClick={add} disabled={loading || selected.length === 0}>{loading ? <Spinner/> : 'Add'}</button>
        <button className="bg" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
