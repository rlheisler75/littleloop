import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FAMILY_ICONS, CHILD_AVATARS } from '../../lib/constants';
import { Modal } from '../ui/Modal';
import Spinner from '../ui/Spinner';
import SectionLabel from '../ui/SectionLabel';

// ─── Family Icon Picker ───────────────────────────────────────────────────────

export function FamilyIconPicker({ open, onClose, familyId, current, onSaved }) {
  const [selected, setSelected] = useState(current);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { if (open) setSelected(current); }, [open, current]);

  async function save() {
    setSaving(true);
    await supabase.from('families').update({ icon: selected }).eq('id', familyId);
    setSaving(false);
    onSaved(selected);
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Family Icon</div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16 }}>Choose an icon for your family.</p>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg,#3A9E7A,#2A7A5A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 }}>
          {selected}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20, maxHeight: 280, overflowY: 'auto' }}>
        {FAMILY_ICONS.map(icon => (
          <button key={icon} type="button" onClick={() => setSelected(icon)}
            style={{ width: 44, height: 44, borderRadius: 12, fontSize: 24, cursor: 'pointer', border: `2px solid ${selected === icon ? '#7BAAEE' : 'rgba(255,255,255,.08)'}`, background: selected === icon ? 'rgba(111,163,232,.15)' : 'rgba(255,255,255,.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .15s' }}>
            {icon}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="bp full" onClick={save} disabled={saving || selected === current}>
          {saving ? <Spinner/> : 'Save Icon'}
        </button>
        <button className="bg" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ─── Family Onboarding Flow ───────────────────────────────────────────────────

export function FamilyOnboarding({ open, onClose, familyId, familyName, onDone }) {
  const [step,        setStep]        = useState(0);
  const [childName,   setChildName]   = useState('');
  const [childAvatar, setChildAvatar] = useState('🌟');
  const [saving,      setSaving]      = useState(false);

  const steps = [
    { id: 'welcome', title: 'Welcome to littleloop! 👋' },
    { id: 'child',   title: 'Add your first child' },
    { id: 'sitter',  title: 'Connect with a sitter' },
    { id: 'done',    title: "You're all set! 🎉" },
  ];

  async function addChild() {
    if (!childName.trim()) { setStep(2); return; }
    setSaving(true);
    await supabase.from('children').insert({
      family_id: familyId, name: childName.trim(), avatar: childAvatar, color: '#8B78D4',
    });
    setSaving(false);
    setStep(2);
  }

  const progress = (step / (steps.length - 1)) * 100;

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ height: 3, background: 'var(--border)', borderRadius: 3, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#3A6FD4,#3A9E7A)', borderRadius: 3, transition: 'width .4s ease' }}/>
      </div>

      {step === 0 && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>➿</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Welcome to littleloop!</div>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.7, marginBottom: 24 }}>
            littleloop connects your family with your childcare provider — posts, messages, invoices, check-ins, and more. Let's get you set up in two quick steps.
          </p>
          <button className="bp full" onClick={() => setStep(1)}>Get started →</button>
        </div>
      )}

      {step === 1 && (
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Add your first child</div>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 20, lineHeight: 1.6 }}>Your sitter will see this when they check in. You can add more later.</p>
          <div style={{ marginBottom: 14 }}>
            <label className="fl">Child's name</label>
            <input className="fi" value={childName} onChange={e => setChildName(e.target.value)} placeholder="e.g. Emma" autoFocus/>
          </div>
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Pick an avatar</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CHILD_AVATARS.map(a => (
                <button key={a} type="button" onClick={() => setChildAvatar(a)}
                  style={{ width: 38, height: 38, borderRadius: 10, fontSize: 22, cursor: 'pointer', border: `2px solid ${childAvatar === a ? '#7BAAEE' : 'rgba(255,255,255,.1)'}`, background: childAvatar === a ? 'rgba(111,163,232,.15)' : 'rgba(255,255,255,.04)' }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <button className="bp full" onClick={addChild} disabled={saving}>
            {saving ? <Spinner/> : childName.trim() ? 'Add & continue' : 'Skip for now'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Connect with a sitter</div>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 20, lineHeight: 1.6 }}>Search for your sitter by name or username, or skip this and they can invite you.</p>
          <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Option 1 — Search for your sitter</div>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10 }}>If your sitter has a public profile on littleloop, you can find them and send a connection request.</p>
            <button className="bp" style={{ width: '100%' }} onClick={() => { onDone(); }}>🔍 Find my sitter</button>
          </div>
          <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Option 2 — Ask your sitter to invite you</div>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>Your sitter can invite you by email from their littleloop account. You'll get a link to join automatically.</p>
          </div>
          <button className="bg full" onClick={() => setStep(3)}>Skip for now</button>
        </div>
      )}

      {step === 3 && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 600, marginBottom: 8 }}>You're all set!</div>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.7, marginBottom: 24 }}>Your family profile is ready. Once your sitter connects, you'll see their posts, invoices, and check-ins all in one place.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, textAlign: 'left' }}>
            {[
              { icon: '🌸', label: 'Feed — sitter posts updates and photos' },
              { icon: '💰', label: 'Invoices — pay your sitter directly' },
              { icon: '🟢', label: 'Check-ins — see when kids arrive and leave' },
              { icon: '💬', label: 'Messages — chat with your sitter' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{f.label}</span>
              </div>
            ))}
          </div>
          <button className="bp full" onClick={onDone}>Start using littleloop →</button>
        </div>
      )}
    </Modal>
  );
}
