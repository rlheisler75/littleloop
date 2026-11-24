// Incident / accident reports: labels, status text and the printable copy (staff and parents).
export const INCIDENT_KINDS = [
  { id: 'injury',   icon: '🩹', label: 'Injury or accident' },
  { id: 'illness',  icon: '🤒', label: 'Illness' },
  { id: 'behavior', icon: '🧩', label: 'Behavior' },
  { id: 'other',    icon: '📄', label: 'Other' },
];
export const incidentKind = id => INCIDENT_KINDS.find(k => k.id === id) || INCIDENT_KINDS[3];

export const TOLD_HOW = [
  { id: 'phone',     label: 'Phone call' },
  { id: 'in_person', label: 'In person' },
  { id: 'text',      label: 'Text or app message' },
  { id: 'other',     label: 'Other' },
];
export const toldHowLabel = id => TOLD_HOW.find(t => t.id === id)?.label || '';

export const STATUS = {
  review: { label: 'Needs review', tone: 'warn' },
  sent:   { label: 'Waiting for signature', tone: 'info' },
  signed: { label: 'Signed', tone: 'ok' },
};

export const when = ts => new Date(ts).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function printIncident(r, child, facilityName) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const row = (label, value) => value ? `<tr><th>${esc(label)}</th><td>${esc(value).replace(/\n/g, '<br>')}</td></tr>` : '';
  const corrections = (r.corrections || []).map(c =>
    `<div class="corr"><b>Correction ${esc(new Date(c.at).toLocaleString())}${c.by_name ? ` by ${esc(c.by_name)}` : ''}:</b> ${esc(c.text)}</div>`).join('');
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Incident report: ${esc(child?.name || '')}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;margin:32px;max-width:720px}
    h1{font-size:22px;margin:0 0 2px}.sub{color:#64748b;font-size:12px;margin-bottom:18px}
    table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;width:190px;color:#475569;vertical-align:top;padding:7px 8px;background:#f8fafc}
    td{padding:7px 8px;border-bottom:1px solid #e2e8f0}.sig{margin-top:22px;padding:12px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px}
    .corr{margin-top:10px;padding:8px 10px;background:#fffbeb;border-left:3px solid #f59e0b;font-size:12px}
  </style></head><body>
  <h1>${esc(facilityName || 'Daycare')}: incident report</h1>
  <div class="sub">Printed ${esc(new Date().toLocaleString())}</div>
  <table>
    ${row('Child', child?.name)}
    ${row('Type', incidentKind(r.kind).label)}
    ${row('When', new Date(r.occurred_at).toLocaleString())}
    ${row('Where', r.location)}
    ${row('What happened', r.description)}
    ${row('First aid / action taken', r.first_aid)}
    ${row('Witness', r.witness)}
    ${row('Parent told', r.parent_told_at ? `${new Date(r.parent_told_at).toLocaleString()}${r.parent_told_how ? ` (${toldHowLabel(r.parent_told_how)})` : ''}` : '')}
    ${row('Written by', r.reported_by_name)}
    ${row('Sent to the family', r.sent_at ? `${new Date(r.sent_at).toLocaleString()}${r.sent_by_name ? ` by ${r.sent_by_name}` : ''}` : 'Not yet')}
  </table>
  ${corrections}
  <div class="sig">${r.parent_signed_at
    ? `Signed by <b>${esc(r.parent_signed_name)}</b> on ${esc(new Date(r.parent_signed_at).toLocaleString())}${r.parent_comment ? `<br>Parent comment: ${esc(r.parent_comment)}` : ''}`
    : 'Parent signature: ______________________________ &nbsp; Date: ____________'}</div>
  </body></html>`);
  w.document.close();
  w.onload = () => w.print();
}
