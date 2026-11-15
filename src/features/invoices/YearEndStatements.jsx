import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { fmt } from '../../services/format';
import { printEarningsSummary, printCareStatement } from '../../services/statements';

const thisYear = new Date().getFullYear();
// Default to last year until March (tax season), otherwise this year.
const defaultYear = () => (new Date().getMonth() < 3 ? thisYear - 1 : thisYear);
const yearOptions = [thisYear, thisYear - 1, thisYear - 2];
const sectionTitle = { fontFamily: "'Fredoka',sans-serif", fontSize: 18, fontWeight: 600 };

// ─── Sitter side: earnings summary + tax ID ──────────────────────────────────
export function SitterYearEnd({ sitterId, sitter, families, onOpenSettings }) {
  const [open,    setOpen]    = useState(false);
  const [year,    setYear]    = useState(defaultYear);
  const [rows,    setRows]    = useState(null);     // paid invoices in year
  const [unpaid,  setUnpaid]  = useState({ count: 0, amount: 0 });
  const [tax,     setTax]     = useState(null);     // { tin, tin_type } | null
  const [editing, setEditing] = useState(false);
  const [tinType, setTinType] = useState('ssn');
  const [tin,     setTin]     = useState('');
  const [msg,     setMsg]     = useState('');

  useEffect(() => {
    supabase.from('sitter_tax_info').select('tin,tin_type').eq('sitter_id', sitterId).maybeSingle()
      .then(({ data }) => { setTax(data || null); if (data) setTinType(data.tin_type); });
  }, [sitterId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setRows(null);
      const start = `${year}-01-01`, end = `${year}-12-31`;
      const { data: invs } = await supabase.from('invoices')
        .select('id, invoice_number, family_id, status, issued_date, paid_date')
        .eq('sitter_id', sitterId).in('status', ['paid', 'sent']);
      const inYear = (invs || []).filter(i => {
        const d = i.status === 'paid' ? (i.paid_date || i.issued_date) : i.issued_date;
        return d >= start && d <= end;
      });
      const ids = inYear.map(i => i.id);
      const totals = {};
      if (ids.length) {
        const { data: items } = await supabase.from('invoice_items').select('invoice_id, amount').in('invoice_id', ids);
        (items || []).forEach(it => { totals[it.invoice_id] = (totals[it.invoice_id] || 0) + Number(it.amount || 0); });
      }
      // Names for families that may have disconnected since
      const known = Object.fromEntries((families || []).map(f => [f.id, f.name]));
      const missing = [...new Set(inYear.map(i => i.family_id))].filter(id => !known[id]);
      if (missing.length) {
        const { data: fams } = await supabase.from('families').select('id,name').in('id', missing);
        (fams || []).forEach(f => { known[f.id] = f.name; });
      }
      if (cancelled) return;
      const paid = inYear.filter(i => i.status === 'paid')
        .map(i => ({ invoice_number: i.invoice_number, family_name: known[i.family_id] || 'Former family', paid_on: i.paid_date || i.issued_date, total: totals[i.id] || 0 }))
        .sort((a, b) => a.paid_on.localeCompare(b.paid_on));
      const open_ = inYear.filter(i => i.status === 'sent');
      setRows(paid);
      setUnpaid({ count: open_.length, amount: open_.reduce((s, i) => s + (totals[i.id] || 0), 0) });
    })();
    return () => { cancelled = true; };
  }, [open, year, sitterId, families]);

  async function saveTin(e) {
    e.preventDefault();
    const digits = tin.replace(/\D/g, '');
    if (digits.length !== 9) { setMsg('A tax ID is 9 digits.'); return; }
    const { error } = await supabase.from('sitter_tax_info')
      .upsert({ sitter_id: sitterId, tin: digits, tin_type: tinType, updated_at: new Date().toISOString() });
    if (error) { setMsg(error.message); return; }
    setTax({ tin: digits, tin_type: tinType }); setTin(''); setEditing(false); setMsg('');
  }
  async function removeTin() {
    await supabase.from('sitter_tax_info').delete().eq('sitter_id', sitterId);
    setTax(null); setEditing(false);
  }

  const total = (rows || []).reduce((s, r) => s + r.total, 0);
  const famCount = new Set((rows || []).map(r => r.family_name)).size;
  const missingProfile = !sitter?.legal_name || !sitter?.address_line1 || !sitter?.city;
  const masked = tax ? (tax.tin_type === 'ein' ? `EIN ••-•••${tax.tin.slice(-4)}` : `SSN •••-••-${tax.tin.slice(-4)}`) : null;

  return (
    <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div>
          <div style={sectionTitle}>🧾 Year-end statements</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Your earnings summary, plus the tax statement your families need for FSA and Form 2441.</div>
        </div>
        <span style={{ fontSize: 18, color: 'var(--text-faint)' }}>{open ? '▾' : '▸'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <select className="fi" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 'auto', marginBottom: 0 }}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {rows === null
              ? <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>Adding up…</span>
              : <span style={{ fontSize: 14 }}><strong>{fmt(total)}</strong> <span style={{ color: 'var(--text-faint)' }}>received from {famCount} famil{famCount === 1 ? 'y' : 'ies'} · {rows.length} paid invoice{rows.length === 1 ? '' : 's'}</span></span>}
          </div>
          {unpaid.count > 0 && <div style={{ fontSize: 12, color: '#F5A623', marginBottom: 10 }}>{unpaid.count} unpaid invoice{unpaid.count === 1 ? '' : 's'} ({fmt(unpaid.amount)}) from {year} won't show until you mark them paid.</div>}

          <button className="bp" disabled={!rows?.length} style={{ padding: '8px 14px', fontSize: 13 }}
            onClick={() => printEarningsSummary({ year, sitter, invoices: rows, outstanding: unpaid })}>
            📊 Print my {year} earnings summary
          </button>

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>What your families' statement shows</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
              Parents download it from their Invoices tab. To claim childcare on taxes or an FSA, they need your legal name, address and tax ID.
            </div>
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              <div>{missingProfile ? '⚠️' : '✅'} Legal name &amp; address {missingProfile
                ? <button className="bg" style={{ padding: '3px 10px', fontSize: 11, marginLeft: 6 }} onClick={onOpenSettings}>Add in Settings</button>
                : <span style={{ color: 'var(--text-faint)' }}>· {sitter.legal_name}, {sitter.city}</span>}</div>
              <div>{tax ? '✅' : '⚠️'} Tax ID {tax && !editing && <>
                <span style={{ color: 'var(--text-faint)' }}>· {masked}</span>
                <button className="bg" style={{ padding: '3px 10px', fontSize: 11, marginLeft: 6 }} onClick={() => setEditing(true)}>Change</button>
              </>}{!tax && !editing && <button className="bg" style={{ padding: '3px 10px', fontSize: 11, marginLeft: 6 }} onClick={() => setEditing(true)}>Add</button>}</div>
            </div>

            {editing && (
              <form onSubmit={saveTin} style={{ marginTop: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-bg)' }}>
                {msg && <div className="al al-e">{msg}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select className="fi" value={tinType} onChange={e => setTinType(e.target.value)} style={{ width: 'auto', marginBottom: 0 }}>
                    <option value="ssn">SSN</option>
                    <option value="ein">EIN</option>
                  </select>
                  <input className="fi" inputMode="numeric" autoComplete="off" placeholder={tinType === 'ein' ? '12-3456789' : '123-45-6789'}
                    value={tin} onChange={e => setTin(e.target.value)} style={{ flex: 1, minWidth: 140, marginBottom: 0 }}/>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', margin: '8px 0' }}>
                  Only families who paid you that year see it, and only on their statement.
                  Prefer not to share your SSN? A free EIN from the IRS (irs.gov/ein, about 10 minutes) works the same way.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="bp" type="submit" style={{ padding: '7px 14px', fontSize: 12 }}>Save</button>
                  <button className="bg" type="button" style={{ padding: '7px 14px', fontSize: 12 }} onClick={() => { setEditing(false); setMsg(''); setTin(''); }}>Cancel</button>
                  {tax && <button className="bd" type="button" style={{ padding: '7px 14px', fontSize: 12, marginLeft: 'auto' }} onClick={removeTin}>Remove</button>}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Family side: download the statement ─────────────────────────────────────
export function FamilyYearEnd({ familyId, role }) {
  const [year, setYear] = useState(defaultYear);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');
  if (role && !['admin', 'member'].includes(role)) return null;

  async function download() {
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('get_care_statement', { p_family_id: familyId, p_year: year });
    setBusy(false);
    if (error) { setErr("Couldn't build the statement. Try again."); return; }
    if (!data?.providers?.length) { setErr(`No paid invoices recorded for ${year}.`); return; }
    printCareStatement(data);
  }

  return (
    <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={sectionTitle}>🧾 Year-end childcare statement</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Everything you paid this year, with your provider's name, address and tax ID. Use it for your Dependent Care FSA or Form 2441.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="fi" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 'auto', marginBottom: 0 }}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="bp" style={{ padding: '8px 14px', fontSize: 13 }} disabled={busy} onClick={download}>{busy ? 'Building…' : '📄 Download'}</button>
        </div>
      </div>
      {err && <div style={{ fontSize: 12, color: '#F5A623', marginTop: 8 }}>{err}</div>}
    </div>
  );
}
