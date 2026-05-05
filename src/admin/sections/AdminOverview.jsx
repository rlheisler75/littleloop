import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminHeader, AdminSpinner } from '../AdminUI';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function fmt$(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Stat({ label, value, sub, color = '#7BAAEE', icon }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
      borderRadius: 14, padding: '16px 18px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }}/>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Cormorant Garamond',serif", color, marginBottom: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: sub ? 3 : 0 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{sub}</div>}
    </div>
  );
}

function Health({ label, value, total, color, isAlert }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const c   = isAlert && value > 0 ? '#F5924A' : color;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      background: 'rgba(255,255,255,.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,.07)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 5 }}>{label}</div>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 2, transition: 'width .4s' }}/>
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: c, flexShrink: 0, minWidth: 40, textAlign: 'right' }}>
        {value}<span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', fontWeight: 400 }}>/{total}</span>
      </div>
    </div>
  );
}

function Activity({ icon, text, time }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,.05)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', lineHeight: 1.4 }}>{text}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>{time}</div>
      </div>
    </div>
  );
}

export default function AdminOverview() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [
      { count: sitterCount },
      { count: familyCount },
      { count: memberCount },
      { count: invoiceCount },
      { count: activeConns },
      { count: pendingConns },
      { count: publicSitters },
      { count: pendingBg },
      { data: paidItems },
      { data: sentItems },
      { data: recentSitters },
      { data: recentFamilies },
      { data: unpaidInvoices },
      { data: recentReviews },
    ] = await Promise.all([
      supabase.from('sitters').select('id', { count: 'exact', head: true }),
      supabase.from('families').select('id', { count: 'exact', head: true }),
      supabase.from('members').select('id', { count: 'exact', head: true }),
      supabase.from('invoices').select('id', { count: 'exact', head: true }),
      supabase.from('family_sitters').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('family_sitters').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('sitters').select('id', { count: 'exact', head: true }).eq('public_profile', true),
      supabase.from('sitters').select('id', { count: 'exact', head: true })
        .eq('background_check', true)
        .not('background_check_doc_url', 'is', null)
        .eq('background_check_verified', false),
      supabase.from('invoice_items').select('amount, invoices!inner(status)').eq('invoices.status', 'paid'),
      supabase.from('invoice_items').select('amount, invoices!inner(status)').eq('invoices.status', 'sent'),
      supabase.from('sitters').select('id,name,created_at').order('created_at', { ascending: false }).limit(6),
      supabase.from('families').select('id,name,created_at').order('created_at', { ascending: false }).limit(6),
      supabase.from('invoices')
        .select('id,invoice_number,status,created_at,families(name),sitters(name)')
        .eq('status', 'sent').order('created_at', { ascending: false }).limit(5),
      supabase.from('sitter_reviews')
        .select('id,rating,created_at,sitters(name)')
        .order('created_at', { ascending: false }).limit(5),
    ]);

    const paidRevenue = (paidItems || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const outstanding = (sentItems  || []).reduce((s, r) => s + Number(r.amount || 0), 0);

    const activity = [
      ...(recentSitters  || []).map(s => ({ ts: s.created_at, icon: '👤', text: `${s.name} joined as a sitter` })),
      ...(recentFamilies || []).map(f => ({ ts: f.created_at, icon: '👨‍👩‍👧', text: `${f.name} family signed up` })),
      ...(recentReviews  || []).map(r => ({ ts: r.created_at, icon: '⭐', text: `New ${r.rating}★ review for ${r.sitters?.name || 'a sitter'}` })),
    ].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 12);

    const { count: familiesNoSitter } = await supabase
      .from('families').select('id', { count: 'exact', head: true })
      .not('id', 'in', `(SELECT DISTINCT family_id FROM family_sitters WHERE status = 'active')`);

    setData({
      sitterCount, familyCount, memberCount, invoiceCount,
      activeConns, pendingConns, publicSitters, pendingBg,
      familiesNoSitter: familiesNoSitter || 0,
      paidRevenue, outstanding,
      unpaidInvoices: unpaidInvoices || [],
      recentSitters:  recentSitters  || [],
      activity,
    });
    setLoading(false);
  }

  if (loading) return <AdminSpinner/>;
  const d = data;

  return (
    <div>
      <AdminHeader
        title="Overview"
        subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      />

      {/* Stats grid — 2 cols on mobile, 4 on desktop */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <Stat icon="💰" label="Total revenue" value={fmt$(d.paidRevenue)}  color="#88D8B8" sub={`${d.invoiceCount} invoices`}/>
        <Stat icon="⏳" label="Outstanding"   value={fmt$(d.outstanding)}  color="#F5924A" sub={`${d.unpaidInvoices.length} unpaid`}/>
        <Stat icon="👤" label="Sitters"       value={d.sitterCount}        color="#7BAAEE" sub={`${d.publicSitters} public`}/>
        <Stat icon="👨‍👩‍👧" label="Families"     value={d.familyCount}        color="#CFA8FF" sub={`${d.memberCount} members`}/>
      </div>

      {/* Platform health */}
      <div style={{
        background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
        borderRadius: 14, padding: '16px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>
          Platform health
        </div>
        {/* 1 col on mobile, 2 on desktop */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
          <Health label="Active connections"        value={d.activeConns}      total={d.familyCount}  color="#88D8B8"/>
          <Health label="Public sitter profiles"    value={d.publicSitters}    total={d.sitterCount}  color="#7BAAEE"/>
          <Health label="Families without a sitter" value={d.familiesNoSitter} total={d.familyCount}  color="#F5924A" isAlert/>
          <Health label="BG checks pending"         value={d.pendingBg}        total={d.sitterCount}  color="#F5924A" isAlert/>
        </div>
        {(d.pendingConns > 0 || d.pendingBg > 0) && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.pendingConns > 0 && (
              <div style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(245,146,74,.1)', border: '1px solid rgba(245,146,74,.25)', fontSize: 12, color: '#F5924A' }}>
                ⚠️ {d.pendingConns} connection request{d.pendingConns !== 1 ? 's' : ''} awaiting sitter approval
              </div>
            )}
            {d.pendingBg > 0 && (
              <div style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(245,146,74,.1)', border: '1px solid rgba(245,146,74,.25)', fontSize: 12, color: '#F5924A' }}>
                🛡️ {d.pendingBg} background check{d.pendingBg !== 1 ? 's' : ''} waiting for your review
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom — stacks on mobile, 2-col on desktop */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>

        {/* Activity feed */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>
            Recent activity
          </div>
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '0 16px' }}>
            {d.activity.length === 0
              ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', padding: '24px 0', textAlign: 'center' }}>No recent activity</div>
              : d.activity.map((a, i) => <Activity key={i} icon={a.icon} text={a.text} time={timeAgo(a.ts)}/>)
            }
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Unpaid invoices */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>
              Unpaid invoices
            </div>
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden' }}>
              {d.unpaidInvoices.length === 0
                ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', padding: '20px', textAlign: 'center' }}>🎉 All invoices paid</div>
                : d.unpaidInvoices.map(inv => (
                  <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.05)', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>#{inv.invoice_number}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {inv.families?.name || '—'} · {inv.sitters?.name || '—'}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(245,146,74,.15)', color: '#F5924A', fontWeight: 700, flexShrink: 0 }}>
                      UNPAID
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Recent sitter signups */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>
              Recent sitter signups
            </div>
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden' }}>
              {d.recentSitters.length === 0
                ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', padding: '20px', textAlign: 'center' }}>No sitters yet</div>
                : d.recentSitters.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{timeAgo(s.created_at)}</div>
                  </div>
                ))
              }
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
