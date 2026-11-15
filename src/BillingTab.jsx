import { useState } from 'react';
import { FREE_FAMILY_LIMIT, PRO_PRICE, isComplimentary, startProCheckout } from './lib/plan';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const formatDate = iso => iso
  ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  : '—';

const box = { background: 'var(--input-bg)', borderRadius: 10, padding: '12px 14px' };
const label = { fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' };

export default function BillingTab({ session, subscriptionData, isPro }) {
  const [loading, setLoading] = useState(false);
  const [plan,    setPlan]    = useState('monthly');
  const [error,   setError]   = useState(null);

  const { subscription_status, subscription_plan, trial_ends_at, current_period_end, stripe_customer_id } = subscriptionData || {};
  const comp = isComplimentary(subscriptionData);

  const openPortal = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/billing?action=portal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: window.location.origin }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      console.error('Portal error:', e);
    } finally {
      setLoading(false);
    }
  };

  const upgrade = async () => {
    setLoading(true); setError(null);
    const err = await startProCheckout(session, plan);
    if (err) { setError(err); setLoading(false); }
  };

  // ── Pro ──────────────────────────────────────────────────────────────────────
  if (isPro) return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Your plan</h2>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>littleloop Pro</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#3A9E7A', background: '#3A9E7A18', padding: '3px 10px', borderRadius: 20 }}>
            {subscription_status === 'trialing' ? '⏳ Trial' : '✅ Active'}
          </div>
        </div>

        {comp ? (
          <div style={{ padding: 14, background: 'rgba(58,158,122,.08)', border: '1px solid rgba(58,158,122,.2)', borderRadius: 12, fontSize: 13, color: 'var(--text-dim)' }}>
            🎁 You're on a complimentary Pro plan as an early member. Thank you! No billing required.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={box}>
              <div style={label}>Billing</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {subscription_plan === 'yearly' ? `${PRO_PRICE.yearly} / year` : `${PRO_PRICE.monthly} / month`}
              </div>
            </div>
            <div style={box}>
              <div style={label}>{subscription_status === 'trialing' ? 'Trial ends' : 'Renews'}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(subscription_status === 'trialing' ? trial_ends_at : current_period_end)}</div>
            </div>
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 14 }}>Unlimited families and automatic recurring invoices.</div>
      </div>

      {!comp && stripe_customer_id && (
        <button className="bp full" onClick={openPortal} disabled={loading} style={{ width: '100%', padding: 13, fontSize: 14 }}>
          {loading ? 'Opening billing portal…' : '💳 Manage subscription'}
        </button>
      )}
      {!comp && <p style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', marginTop: 14 }}>Billing is managed securely through Stripe. Cancel anytime.</p>}
    </div>
  );

  // ── Free ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Your plan</h2>

      {subscription_status === 'past_due' && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(224,90,90,.1)', border: '1px solid rgba(224,90,90,.25)', borderRadius: 10, fontSize: 13, color: '#E05A5A' }}>
          ⚠️ Your last Pro payment failed. Update your payment method to keep unlimited families.
          {stripe_customer_id && <div><button className="bg" style={{ marginTop: 8, fontSize: 12 }} onClick={openPortal}>Update payment method</button></div>}
        </div>
      )}

      <div className="card" style={{ padding: 20, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Free</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', background: 'var(--input-bg)', padding: '3px 10px', borderRadius: 20 }}>Current plan</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Check-ins, daily updates, GPS field trips, invoices and messaging for up to {FREE_FAMILY_LIMIT} families. No card needed.
        </div>
      </div>

      <div className="card" style={{ padding: 20, border: '1.5px solid var(--accent,#7BAAEE)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Pro</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 16 }}>
          Unlimited families, plus recurring invoices that send themselves every week or month.
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[
            { id: 'monthly', price: PRO_PRICE.monthly, per: '/mo' },
            { id: 'yearly',  price: PRO_PRICE.yearly,  per: '/yr', badge: '2 months free' },
          ].map(p => (
            <div key={p.id} onClick={() => setPlan(p.id)} style={{
              flex: 1, padding: '12px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
              border: `2px solid ${plan === p.id ? 'var(--accent,#7BAAEE)' : 'var(--border)'}`,
              background: plan === p.id ? 'rgba(123,170,238,.08)' : 'transparent',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{p.price}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-dim)' }}>{p.per}</span></div>
              {p.badge && <div style={{ fontSize: 11, color: '#3A9E7A', fontWeight: 600, marginTop: 2 }}>{p.badge}</div>}
            </div>
          ))}
        </div>

        {error && <div style={{ fontSize: 13, color: '#E05A5A', marginBottom: 10 }}>{error}</div>}
        <button className="bp full" onClick={upgrade} disabled={loading} style={{ width: '100%', padding: 13, fontSize: 14 }}>
          {loading ? 'Opening checkout…' : 'Upgrade to Pro'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', margin: '12px 0 0' }}>Secure checkout with Stripe. Cancel anytime.</p>
      </div>
    </div>
  );
}
