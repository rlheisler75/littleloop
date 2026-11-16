import { esc } from '../../services/format';
import { loopMarkSvg } from '../../lib/loopMark';
import { ACKNOWLEDGMENT, LEGAL_NOTE } from './defaultTemplate';

// Split "[blank]" markers out so they can be highlighted.
function Inline({ text }) {
  const parts = String(text).split(/(\[[^\]]{1,80}\])/g);
  return parts.map((p, i) => /^\[[^\]]+\]$/.test(p)
    ? <mark key={i} style={{ background: 'color-mix(in srgb,var(--warn-text,#B7791F) 18%,transparent)', color: 'var(--warn-text,#B7791F)', borderRadius: 4, padding: '0 3px' }}>{p}</mark>
    : <span key={i}>{p}</span>);
}

// Blocks of paragraphs and "- " bullet lists.
export function parseBody(body = '') {
  const blocks = [];
  for (const chunk of String(body).split(/\n\s*\n/)) {
    const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.every(l => l.startsWith('- '))) blocks.push({ type: 'ul', items: lines.map(l => l.slice(2)) });
    else {
      // Mixed chunk: keep bullets as bullets, text as paragraphs
      let para = [];
      let list = [];
      const flushP = () => { if (para.length) blocks.push({ type: 'p', text: para.join(' ') }); para = []; };
      const flushL = () => { if (list.length) blocks.push({ type: 'ul', items: list }); list = []; };
      for (const l of lines) {
        if (l.startsWith('- ')) { flushP(); list.push(l.slice(2)); } else { flushL(); para.push(l); }
      }
      flushP(); flushL();
    }
  }
  return blocks;
}

export function SectionBody({ body }) {
  return parseBody(body).map((b, i) => b.type === 'ul'
    ? <ul key={i} style={{ margin: '0 0 10px', paddingLeft: 20 }}>{b.items.map((it, j) => <li key={j} style={{ marginBottom: 5 }}><Inline text={it}/></li>)}</ul>
    : <p key={i} style={{ margin: '0 0 10px' }}><Inline text={b.text}/></p>);
}

export const PERIODS = ['week', 'month', 'day', 'hour'];

export function termsRows(terms = {}) {
  const rows = [];
  if (terms.children)       rows.push(['Children', terms.children]);
  if (terms.days)           rows.push(['Usual schedule', terms.days]);
  if (terms.dropoff || terms.pickup) rows.push(['Drop-off / pick-up', [terms.dropoff, terms.pickup].filter(Boolean).join(' – ')]);
  if (terms.rate)           rows.push(['Tuition', `$${terms.rate} per ${terms.period || 'week'}`]);
  if (terms.payment_method) rows.push(['Payment method', terms.payment_method]);
  return rows;
}

// Full read-only agreement. `signatures` = [{signed_name, signed_at}]
export default function AgreementView({ agreement, signatures = [] }) {
  if (!agreement) return null;
  const rows = termsRows(agreement.terms);
  return (
    <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-dim)' }}>
      {agreement.business_name && <div style={{ fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700 }}>{agreement.business_name}</div>}
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, color: 'var(--text)', margin: '2px 0 14px' }}>{agreement.title}</div>

      {rows.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 18 }}>
          {rows.map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', gap: 10, padding: '8px 12px', borderTop: i ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
              <div style={{ width: 130, flexShrink: 0, color: 'var(--text-faint)', fontWeight: 600 }}>{k}</div>
              <div style={{ color: 'var(--text)' }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {(agreement.sections || []).map((s, i) => (
        <div key={s.id || i} style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{i + 1}. {s.title}</div>
          <SectionBody body={s.body}/>
        </div>
      ))}

      <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 12, background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Acknowledgment</div>
        <div>{ACKNOWLEDGMENT}</div>
        {(agreement.sitter_signed_name || signatures.length > 0) && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {signatures.map((s, i) => <SigLine key={i} who="Parent/Guardian" name={s.signed_name} at={s.signed_at}/>)}
            {agreement.sitter_signed_name && <SigLine who="Provider" name={agreement.sitter_signed_name} at={agreement.sitter_signed_at}/>}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10, fontStyle: 'italic' }}>{LEGAL_NOTE}</div>
    </div>
  );
}

function SigLine({ who, name, at }) {
  return (
    <div style={{ fontSize: 12 }}>
      <span style={{ color: 'var(--ok-text)' }}>✓</span> <strong style={{ color: 'var(--text)' }}>{name}</strong>
      <span style={{ color: 'var(--text-faint)' }}> · {who}{at ? ` · signed ${new Date(at).toLocaleDateString()}` : ''}</span>
    </div>
  );
}

// ─── Printable copy ──────────────────────────────────────────────────────────

export function printAgreement(agreement, signatures = []) {
  const rows = termsRows(agreement.terms);
  const sections = (agreement.sections || []).map((s, i) => {
    const body = parseBody(s.body).map(b => b.type === 'ul'
      ? `<ul>${b.items.map(it => `<li>${esc(it)}</li>`).join('')}</ul>`
      : `<p>${esc(b.text)}</p>`).join('');
    return `<h2>${i + 1}. ${esc(s.title)}</h2>${body}`;
  }).join('');
  const sigRow = (label, name, at) => `<tr><td>${label}</td><td>${name ? esc(name) : ''}</td><td>${at ? esc(new Date(at).toLocaleDateString()) : ''}</td></tr>`;
  const sigs = [
    ...signatures.map(s => sigRow('Parent/Guardian', s.signed_name, s.signed_at)),
    ...(signatures.length ? [] : [sigRow('Parent/Guardian', '', ''), sigRow('Second parent/guardian', '', '')]),
    sigRow('Provider', agreement.sitter_signed_name, agreement.sitter_signed_at),
  ].join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(agreement.title)}</title>
<style>
body{font-family:'Helvetica Neue',Arial,sans-serif;color:#22244D;max-width:760px;margin:32px auto;padding:0 24px;font-size:13px;line-height:1.6}
.brand{display:flex;align-items:center;gap:8px;font-weight:700;color:#E8553F;font-size:14px}
.biz{text-align:center;letter-spacing:2px;text-transform:uppercase;font-size:12px;color:#555;margin-top:18px}
h1{text-align:center;font-size:24px;margin:4px 0 18px}
h2{font-size:15px;margin:18px 0 6px;break-after:avoid}
table{width:100%;border-collapse:collapse;margin:8px 0 14px}
td{border:1px solid #ccc;padding:6px 10px;vertical-align:top}
td:first-child{width:34%;font-weight:600;background:#faf7f0}
ul{margin:0 0 8px;padding-left:20px}li{margin-bottom:3px}p{margin:0 0 8px}
.note{font-size:11px;color:#666;font-style:italic;margin-top:16px}
@media print{.no-print{display:none}body{margin:0 auto}}
</style></head><body>
<div class="brand">${loopMarkSvg()}littleloop</div>
${agreement.business_name ? `<div class="biz">${esc(agreement.business_name)}</div>` : ''}
<h1>${esc(agreement.title)}</h1>
${rows.length ? `<table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}
${sections}
<h2>Acknowledgment &amp; Signatures</h2>
<p>${esc(ACKNOWLEDGMENT)}</p>
<table><tr><td>Role</td><td style="font-weight:600;background:#faf7f0">Name (signed electronically in littleloop)</td><td style="font-weight:600;background:#faf7f0;width:18%">Date</td></tr>${sigs}</table>
<div class="note">${esc(LEGAL_NOTE)}</div>
<div class="no-print" style="text-align:center;margin:24px 0">
<button onclick="window.print()" style="padding:12px 28px;background:#E8553F;color:#fff;border:none;border-radius:999px;font-size:14px;font-weight:600;cursor:pointer">Print / Save as PDF</button>
</div></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  window.open(url, '_blank');
}
