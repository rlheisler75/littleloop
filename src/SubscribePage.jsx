import { useState } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function SubscribePage({ session, onBack }) {
  const [plan, setPlan] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe/checkout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          successUrl: `${origin}/?subscribed=true`,
          cancelUrl: `${origin}/`,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Could not create checkout session. Please try again.');
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      zIndex: 1,
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 36, marginBottom: 8, filter: 'drop-shadow(0 0 16px rgba(58,158,122,.5))' }}>➿</div>
          <div className="logo-text" style={{ fontSize: 26 }}>littleloop</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Sitter Membership</div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '28px 24px' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700 }}>Start your free trial</h2>
          <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5 }}>
            14 days free, then choose your plan. Cancel anytime.
          </p>

          {/* Plan toggle */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {[
              { id: 'monthly', label: 'Monthly', price: '$5', per: '/mo' },
              { id: 'yearly',  label: 'Yearly',  price: '$50', per: '/yr', badge: 'Save 17%' },
            ].map(p => (
              <div
                key={p.id}
                onClick={() => setPlan(p.id)}
                style={{
                  flex: 1,
                  padding: '14px 12px',
                  borderRadius: 12,
                  border: `2px solid ${plan === p.id ? 'var(--accent)' : 'rgba(255,255,255,.08)'}`,
                  background: plan === p.id ? 'rgba(58,158,122,.1)' : 'rgba(255,255,255,.03)',
                  cursor: 'pointer',
                  transition: 'all .2s',
                  position: 'relative',
                  textAlign: 'center',
                }}
              >
                {p.badge && (
                  <div style={{
                    position: 'absolute',
                    top: -10,
                    right: 8,
                    background: 'var(--accent)',
                    color: '#000',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 20,
                  }}>{p.badge}</div>
                )}
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{p.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{p.price}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>{p.per}</span></div>
              </div>
            ))}
          </div>

          {/* Features */}
          <div style={{ marginBottom: 24 }}>
            {[
              '📋 Public sitter profile',
              '👨‍👩‍👧 Connect with local families',
              '💬 In-app messaging',
              '💰 Invoice & session management',
              '🛡️ Verification badges',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', fontSize: 14, borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                {f}
              </div>
            ))}
          </div>

          {error && (
            <div style={{ background: 'rgba(224,90,90,.15)', border: '1px solid rgba(224,90,90,.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#E05A5A', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleSubscribe}
            disabled={loading}
            style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 600 }}
          >
            {loading ? 'Redirecting to Stripe…' : 'Start 14-day free trial →'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 14, marginBottom: 0 }}>
            No charge until your trial ends. Secure payment via Stripe.
          </p>
        </div>

        {onBack && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="bg" style={{ fontSize: 13, padding: '6px 14px' }} onClick={onBack}>
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
