import { useState } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function BillingTab({ session, subscriptionData }) {
  const [loading, setLoading] = useState(false);

  const { subscription_status, subscription_plan, trial_ends_at, current_period_end } = subscriptionData || {};

  const openPortal = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe?action=portal`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
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

  const statusColor = {
    active:   '#3A9E7A',
    trialing: '#F5A623',
    past_due: '#E05A5A',
    canceled: '#888',
  }[subscription_status] || '#888';

  const statusLabel = {
    active:   '✅ Active',
    trialing: '⏳ Trial',
    past_due: '⚠️ Past Due',
    canceled: '❌ Canceled',
  }[subscription_status] || 'Unknown';

  const formatDate = (iso) => iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—';

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Billing & Subscription</h2>

      {/* Status card */}
      <div className="card" style={{ padding: '20px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Sitter Membership</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: statusColor,background: `${statusColor}18`, padding: '3px 10px', borderRadius: 20 }}>
            {statusLabel}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Plan</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {subscription_plan === 'yearly' ? '$50 / year' : subscription_plan === 'monthly' ? '$5 / month' : '—'}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {subscription_status === 'trialing' ? 'Trial Ends' : 'Renews'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {subscription_status === 'trialing'
                ? formatDate(trial_ends_at)
                : formatDate(current_period_end)}
            </div>
          </div>
        </div>

        {subscription_status === 'trialing' && trial_ends_at && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(245,166,35,.1)', border: '1px solid rgba(245,166,35,.25)', borderRadius: 10, fontSize: 13, color: '#F5A623' }}>
            🎉 Your free trial is active — you won't be charged until {formatDate(trial_ends_at)}.
          </div>
        )}

        {subscription_status === 'past_due' && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(224,90,90,.1)', border: '1px solid rgba(224,90,90,.25)', borderRadius: 10, fontSize: 13, color: '#E05A5A' }}>
            ⚠️ Your last payment failed. Please update your payment method to keep your account active.
          </div>
        )}
      </div>

      {/* Manage button */}
      {subscription_status && subscription_status !== 'canceled' && (
        <button
          className="btn-primary"
          onClick={openPortal}
          disabled={loading}
          style={{ width: '100%', padding: '13px', fontSize: 14 }}
        >
          {loading ? 'Opening billing portal…' : '💳 Manage Subscription'}
        </button>
      )}

      {subscription_status === 'canceled' && (
        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: 14 }}>
          Your subscription is canceled. Your profile remains visible but dashboard features are locked.
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 14 }}>
        Billing is managed securely through Stripe. Cancel anytime.
      </p>
    </div>
  );
}
