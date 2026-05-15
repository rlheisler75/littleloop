/**
 * PaywallScreen.jsx
 * Place at: src/components/auth/PaywallScreen.jsx
 *
 * Shown to sitters who are logged in but have subscription_status = 'none'.
 * Lets them choose monthly ($5) or yearly ($50) and sends them to Stripe checkout.
 */
import { useState } from 'react';

const SUPABASE_FUNCTIONS_URL = 'https://ukcxammnzhirxjdlqelr.supabase.co/functions/v1';

export default function PaywallScreen({ session, onSignOut, onComplete }) {
  const [plan,    setPlan]    = useState('monthly'); // 'monthly' | 'yearly'
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const startCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/billing?action=checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          plan,
          successUrl: `${window.location.origin}/?subscribed=true`,
          cancelUrl:  `${window.location.origin}/`,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      setError('Could not connect. Please try again.');
      setLoading(false);
    }
  };

  const savings = Math.round(100 - (50 / (5 * 12)) * 100); // ~17%

  return (
    <div style={{
      position: 'relative', zIndex: 1, minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>➿</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
            Start your littleloop membership
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-faint)', margin: 0, lineHeight: 1.6 }}>
            Everything you need to run your childcare business — invoices, messaging, check-ins, and more.
          </p>
        </div>

        {/* Plan picker */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {/* Monthly */}
          <button
            onClick={() => setPlan('monthly')}
            style={{
              flex: 1, padding: '16px 12px', borderRadius: 12, cursor: 'pointer',
              border: `2px solid ${plan === 'monthly' ? 'var(--accent, #3A6FD4)' : 'var(--border)'}`,
              background: plan === 'monthly' ? 'var(--accent-subtle, rgba(58,111,212,0.1))' : 'var(--card-bg)',
              textAlign: 'center', transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 }}>Monthly</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>$5</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>per month</div>
          </button>

          {/* Yearly */}
          <button
            onClick={() => setPlan('yearly')}
            style={{
              flex: 1, padding: '16px 12px', borderRadius: 12, cursor: 'pointer',
              border: `2px solid ${plan === 'yearly' ? 'var(--accent, #3A6FD4)' : 'var(--border)'}`,
              background: plan === 'yearly' ? 'var(--accent-subtle, rgba(58,111,212,0.1))' : 'var(--card-bg)',
              textAlign: 'center', transition: 'all 0.15s', position: 'relative',
            }}
          >
            <div style={{
              position: 'absolute', top: -10, right: 10,
              background: 'linear-gradient(135deg,#3A6FD4,#2550A8)',
              color: '#fff', fontSize: 10, fontWeight: 700,
              padding: '3px 8px', borderRadius: 20, letterSpacing: '0.5px',
            }}>
              SAVE {savings}%
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 }}>Yearly</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>$50</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>per year</div>
          </button>
        </div>

        {/* Promo code callout */}
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>🎉</span>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.5 }}>
            Have a promo code? Enter it on the next screen for <strong style={{ color: 'var(--text)' }}>3 months free</strong>.
          </p>
        </div>

        {/* What's included */}
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '16px 20px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 14 }}>
            What's included
          </div>
          {[
            ['💬', 'Family messaging & daily updates'],
            ['✅', 'Child check-in / check-out'],
            ['💳', 'Invoice creation & payment tracking'],
            ['📍', 'Field trip GPS tracking'],
            ['🛡️', 'Verified certifications badge'],
            ['👤', 'Public sitter profile page'],
          ].map(([icon, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{icon}</span>
              <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ef4444' }}>
            {error}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={startCheckout}
          disabled={loading}
          style={{
            width: '100%', padding: '15px', borderRadius: 12, border: 'none',
            background: loading ? 'var(--border)' : 'linear-gradient(135deg,#3A6FD4,#2550A8)',
            color: '#fff', fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.15s', marginBottom: 12,
          }}
        >
          {loading ? 'Redirecting to Stripe…' : `Start with ${plan === 'yearly' ? '$50/year' : '$5/month'} →`}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-faint)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Secure checkout via Stripe · Cancel anytime · Families are always free
        </p>

        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onSignOut}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-faint)', textDecoration: 'underline' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
