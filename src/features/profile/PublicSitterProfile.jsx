// src/features/profile/PublicSitterProfile.jsx
// Public sitter profile page —  no auth required.
// Route: littleloop.xyz/?sitter=username
//
// Layout:
//   Desktop → two-column: sidebar (avatar + CTA + quick stats) | main content
//   Mobile  → stacked: banner → avatar → name → stats → content
//
// Banner fallback: if no headline_photo_url, renders a gradient using the
// sitter's accent color derived from their name (deterministic, always looks good).

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';
import SitterAvatar from '../../components/ui/SitterAvatar';

// ── Responsive hook ──────────────────────────────────────────────────────────
function useIsMobile(bp = 700) {
  const [is, setIs] = useState(() => typeof window !== 'undefined' && window.innerWidth <= bp);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const h = e => setIs(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [bp]);
  return is;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  const d = Math.floor((Date.now() - new Date(ts)) / 86400000);
  if (d < 1)  return 'Today';
  if (d < 30) return `${d}d ago`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m}mo ago`;
  return `${Math.floor(m / 12)}yr ago`;
}

function StarRating({ value = 0, size = 14 }) {
  return (
    <span style={{ fontSize: size, letterSpacing: 1 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= value ? '#F5C518' : 'var(--border)' }}>★</span>
      ))}
    </span>
  );
}

// Deterministic gradient from a name string — no blank banners ever
function nameToBannerGradient(name = '') {
  const gradients = [
    'linear-gradient(135deg, #0D1F1E 0%, #0BA5AD 60%, #8869F7 100%)',
    'linear-gradient(135deg, #0D1B2A 0%, #7BAAEE 60%, #4A7FCC 100%)',
    'linear-gradient(135deg, #0D1F1A 0%, #4CD99A 60%, #28A870 100%)',
    'linear-gradient(135deg, #1A0F20 0%, #C084F5 60%, #9050D0 100%)',
    'linear-gradient(135deg, #1C1008 0%, #F5924A 60%, #C86020 100%)',
    'linear-gradient(135deg, #091520 0%, #2AA8D4 60%, #1580A8 100%)',
  ];
  const idx = (name.charCodeAt(0) || 0) % gradients.length;
  return gradients[idx];
}

function Stat({ icon, text, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      fontSize: 12, color: color || 'var(--text-dim)',
    }}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{
        fontSize: 13, fontWeight: 700, letterSpacing: '.6px',
        textTransform: 'uppercase', color: 'var(--text-faint)',
        marginBottom: 12,
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Chip({ label, icon, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 12px', borderRadius: 20,
      background: color ? `${color}18` : 'var(--card-bg)',
      border: `1px solid ${color ? `${color}40` : 'var(--border)'}`,
      color: color || 'var(--text-dim)',
      fontSize: 12, fontWeight: 500,
    }}>
      {icon && <span>{icon}</span>}
      {label}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PublicSitterProfile({ username, session }) {
  const [sitter,   setSitter]   = useState(null);
  const [reviews,  setReviews]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Connection state for logged-in families
  const [connStatus,  setConnStatus]  = useState(null);
  const [connLoading, setConnLoading] = useState(false);
  const [familyId,    setFamilyId]    = useState(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    load();
  }, [username]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('sitters')
      .select('*')
      .eq('username', username)
      .eq('public_profile', true)
      .single();

    if (error || !data) { setNotFound(true); setLoading(false); return; }
    setSitter(data);

    const { data: revs } = await supabase
      .from('sitter_reviews')
      .select('*, families(name)')
      .eq('sitter_id', data.id)
      .order('created_at', { ascending: false });
    setReviews(revs || []);

    // If logged in as a family member, check connection status
    if (session?.user) {
      const { data: member } = await supabase
        .from('members')
        .select('family_id')
        .eq('user_id', session.user.id)
        .single();

      if (member) {
        setFamilyId(member.family_id);
        const { data: conn } = await supabase
          .from('connections')
          .select('status')
          .eq('sitter_id', data.id)
          .eq('family_id', member.family_id)
          .maybeSingle();
        setConnStatus(conn ? conn.status : 'none');
      }
    }

    setLoading(false);
  }

  async function requestConnection() {
    if (!familyId || !sitter) return;
    setConnLoading(true);
    await supabase.from('connections').insert({
      sitter_id: sitter.id,
      family_id: familyId,
      status: 'pending',
    });
    setConnStatus('pending');
    setConnLoading(false);
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={24} />
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, marginBottom: 8 }}>Profile not found</h2>
        <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6, marginBottom: 20 }}>
          This sitter hasn't set up a public profile yet, or the link may have changed.
        </p>
        <button className="bp" onClick={() => window.location.href = '/?browse'}>Browse Sitters</button>
      </div>
    </div>
  );

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const bannerGrad = nameToBannerGradient(sitter.name);
  const bioWords   = (sitter.bio || '').split(' ');
  const bioShort   = bioWords.slice(0, 40).join(' ');
  const bioLong    = sitter.bio;
  const hasBioMore = bioWords.length > 40;

  // CTA block — changes based on viewer auth state + connection status
  function CtaBlock({ compact = false }) {
    const firstName = sitter.name?.split(' ')[0] || 'this sitter';

    if (!session) return (
      <div style={{
        padding: compact ? '14px 16px' : '20px',
        borderRadius: 14,
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: compact ? 13 : 15, fontWeight: 700, marginBottom: 4 }}>
          Interested in {firstName}?
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12, lineHeight: 1.5 }}>
          Join littleloop to connect and manage your childcare in one place.
        </div>
        <button
          className="bp full"
          onClick={() => window.location.href = '/?portal=parent'}
          style={{ fontSize: 13 }}
        >
          🤝 Join littleloop — it's free
        </button>
        <button
          className="bg full"
          onClick={() => window.location.href = '/'}
          style={{ fontSize: 12, marginTop: 8 }}
        >
          Already have an account? Sign in
        </button>
      </div>
    );

    if (connStatus === 'active') return (
      <div style={{
        padding: compact ? '14px 16px' : '20px',
        borderRadius: 14,
        background: 'rgba(58,158,122,.08)',
        border: '1px solid rgba(58,158,122,.25)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, color: '#88D8B8', fontWeight: 600 }}>✅ Connected</div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
          You're already connected with {firstName}.
        </div>
      </div>
    );

    if (connStatus === 'pending') return (
      <div style={{
        padding: compact ? '14px 16px' : '20px',
        borderRadius: 14,
        background: 'rgba(200,120,74,.08)',
        border: '1px solid rgba(200,120,74,.25)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, color: '#F5C098', fontWeight: 600 }}>⏳ Request Pending</div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
          Waiting for {firstName} to accept your request.
        </div>
      </div>
    );

    // connStatus === 'none' or family logged in
    return (
      <div style={{
        padding: compact ? '14px 16px' : '20px',
        borderRadius: 14,
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: compact ? 13 : 15, fontWeight: 700, marginBottom: 4 }}>
          Interested in {firstName}?
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12, lineHeight: 1.5 }}>
          Send a connection request to get started.
        </div>
        <button
          className="bp full"
          onClick={requestConnection}
          disabled={connLoading}
          style={{ fontSize: 13 }}
        >
          {connLoading ? <Spinner size={12} /> : '🤝 Request Connection'}
        </button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--body-bg)' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--nav-bg)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px',
      }}>
        <button
          onClick={() => window.history.back()}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back
        </button>
        <div className="logo-text" style={{ fontSize: 18 }}>littleloop</div>
        {!session && (
          <button
            className="bp"
            onClick={() => window.location.href = '/?portal=parent'}
            style={{ fontSize: 12, padding: '8px 14px' }}
          >
            Join littleloop
          </button>
        )}
        {session && <div style={{ width: 80 }} />}
      </div>

      {/* ── Banner ──────────────────────────────────────────────────────── */}
      <div style={{
        width: '100%',
        height: isMobile ? 160 : 220,
        background: bannerGrad,   /* always show gradient — photo layered on top */
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Photo covers gradient when present */}
        {sitter.headline_photo_url && (
          <img
            src={sitter.headline_photo_url}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {/* Bottom fade so avatar blends cleanly */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.55) 100%)',
        }} />
      </div>

      {/* ── Page body ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isMobile ? '0 16px 60px' : '0 24px 60px' }}>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 0 : 32,
          alignItems: 'flex-start',
        }}>

          {/* ── MOBILE header: avatar row overlapping banner ─────────────── */}
          {isMobile && (
            <div style={{ width: '100%', marginTop: -44, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 10 }}>
                <div style={{
                  width: 88, height: 88, flexShrink: 0,
                  borderRadius: '50%',
                  border: '3px solid var(--body-bg)',
                  overflow: 'hidden',
                  background: 'var(--card-bg)',
                  boxShadow: '0 4px 16px rgba(0,0,0,.4)',
                }}>
                  <SitterAvatar url={sitter.avatar_url} name={sitter.name} size={88} style={{ borderRadius: '50%' }} />
                </div>
                <div style={{ paddingBottom: 4, minWidth: 0 }}>
                  <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>
                    {sitter.name}
                  </h1>
                  {sitter.tagline && (
                    <p style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', lineHeight: 1.3, margin: 0 }}>
                      {sitter.tagline}
                    </p>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 12px', marginBottom: 14 }}>
                {(sitter.city || sitter.state) && <Stat icon="📍" text={[sitter.city, sitter.state].filter(Boolean).join(', ')} />}
                {(sitter.hourly_rate_min || sitter.hourly_rate_max) && <Stat icon="💰" text={`$${sitter.hourly_rate_min || '?'}–$${sitter.hourly_rate_max || '?'}/hr`} />}
                {sitter.years_experience > 0 && <Stat icon="🏅" text={`${sitter.years_experience} yr${sitter.years_experience !== 1 ? 's' : ''}`} />}
                {avgRating && <Stat icon="⭐" text={`${avgRating} (${reviews.length})`} />}
                {sitter.background_check && <Stat icon="✅" text="Background checked" color="#88D8B8" />}
                {sitter.has_car && <Stat icon="🚗" text="Has car" />}
              </div>
              <CtaBlock compact />
            </div>
          )}

          {/* ── DESKTOP sidebar: sticky, overlapping banner ──────────────── */}
          {!isMobile && (
            <div style={{ flexShrink: 0, width: 260, marginTop: -60, position: 'sticky', top: 72 }}>
              <div style={{
                width: 120, height: 120,
                borderRadius: '50%',
                border: '4px solid var(--body-bg)',
                overflow: 'hidden',
                marginBottom: 14,
                background: 'var(--card-bg)',
                boxShadow: '0 4px 20px rgba(0,0,0,.35)',
              }}>
                <SitterAvatar url={sitter.avatar_url} name={sitter.name} size={120} style={{ borderRadius: '50%' }} />
              </div>
              <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}>
                {sitter.name}
              </h1>
              {sitter.tagline && (
                <p style={{ fontSize: 13, color: 'var(--text-faint)', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.4 }}>
                  {sitter.tagline}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {(sitter.city || sitter.state) && <Stat icon="📍" text={[sitter.city, sitter.state].filter(Boolean).join(', ')} />}
                {(sitter.hourly_rate_min || sitter.hourly_rate_max) && <Stat icon="💰" text={`$${sitter.hourly_rate_min || '?'}–$${sitter.hourly_rate_max || '?'}/hr`} />}
                {sitter.years_experience > 0 && <Stat icon="🏅" text={`${sitter.years_experience} yr${sitter.years_experience !== 1 ? 's' : ''} exp`} />}
                {avgRating && <Stat icon="⭐" text={`${avgRating} (${reviews.length} review${reviews.length !== 1 ? 's' : ''})`} />}
                {sitter.response_time && <Stat icon="⚡" text={sitter.response_time} />}
                {sitter.background_check && <Stat icon="✅" text="Background checked" color="#88D8B8" />}
                {sitter.has_car && <Stat icon="🚗" text="Has car" />}
                {sitter.can_drive_kids && <Stat icon="👶" text="Can drive kids" />}
              </div>
              <CtaBlock />
            </div>
          )}

            {/* ── MAIN CONTENT ──────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: isMobile ? 0 : 20 }}>

            {/* About */}
            {sitter.bio && (
              <Section title="About">
                <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-dim)' }}>
                  {expanded ? bioLong : bioShort}
                  {hasBioMore && !expanded && '…'}
                </p>
                {hasBioMore && (
                  <button
                    onClick={() => setExpanded(v => !v)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: '6px 0 0', fontWeight: 600 }}
                  >
                    {expanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </Section>
            )}

            {/* Services */}
            {sitter.services?.length > 0 && (
              <Section title="Services Offered">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {sitter.services.map(s => <Chip key={s} label={s} />)}
                </div>
              </Section>
            )}

            {/* Works with */}
            {sitter.age_ranges?.length > 0 && (
              <Section title="Works With">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {sitter.age_ranges.map(r => <Chip key={r} label={r} icon="👶" />)}
                </div>
              </Section>
            )}

            {/* Certifications */}
            {sitter.certifications?.length > 0 && (
              <Section title="Certifications">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {sitter.certifications.map(c => <Chip key={c} label={c} icon="✅" color="#88D8B8" />)}
                </div>
              </Section>
            )}

            {/* Details grid */}
            {(sitter.education || sitter.languages?.length > 0 || sitter.comfortable_with?.length > 0) && (
              <Section title="Details">
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 12,
                }}>
                  {sitter.education && (
                    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.8px', color: 'var(--text-faint)', marginBottom: 4 }}>EDUCATION</div>
                      <div style={{ fontSize: 13 }}>{sitter.education}</div>
                    </div>
                  )}
                  {sitter.languages?.length > 0 && (
                    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.8px', color: 'var(--text-faint)', marginBottom: 4 }}>LANGUAGES</div>
                      <div style={{ fontSize: 13 }}>{sitter.languages.join(', ')}</div>
                    </div>
                  )}
                  {sitter.comfortable_with?.length > 0 && (
                    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.8px', color: 'var(--text-faint)', marginBottom: 4 }}>COMFORTABLE WITH</div>
                      <div style={{ fontSize: 13 }}>{sitter.comfortable_with.join(', ')}</div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Availability */}
            {sitter.availability && Object.keys(sitter.availability).length > 0 && (
              <Section title="Availability">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(sitter.availability).map(([day, slots]) =>
                    slots?.length > 0 && (
                      <div key={day} style={{
                        padding: '6px 12px', borderRadius: 20,
                        background: 'var(--card-bg)', border: '1px solid var(--border)',
                        fontSize: 12,
                      }}>
                        <span style={{ fontWeight: 600 }}>{day}:</span>{' '}
                        <span style={{ color: 'var(--text-dim)' }}>{slots.join(', ')}</span>
                      </div>
                    )
                  )}
                </div>
              </Section>
            )}

            {/* Photo gallery */}
            {sitter.photo_gallery?.length > 0 && (
              <Section title="Photos">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                  {sitter.photo_gallery.map((url, i) => (
                    <div key={i} style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden' }}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Reviews */}
            <Section title={`Reviews (${reviews.length})`}>
              {reviews.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-faint)', fontStyle: 'italic' }}>No reviews yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {reviews.map(r => (
                    <div key={r.id} style={{
                      padding: '14px 16px', borderRadius: 12,
                      background: 'var(--card-bg)', border: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <StarRating value={r.rating} size={13} />
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{r.families?.name || 'A family'}</span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{timeAgo(r.created_at)}</span>
                      </div>
                      {r.review && <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>{r.review}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Section>

          </div>{/* end main content */}
        </div>{/* end flex row */}
      </div>{/* end page body */}
{/* Version stamp — remove once deployment is reliable */}
<div style={{ fontSize: 9, color: 'var(--text-faint)', textAlign: 'center', marginTop: 8, opacity: .4 }}>
  {FILE_VERSION}
</div>
    </div>
  );
}
