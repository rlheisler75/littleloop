import { supabase } from '../../lib/supabase';

// Enrollment packet: forms a family signs once, documents each child needs, the child's
// health & diet details, and the family's emergency contacts and approved pickups.

export const DOC_BUCKET = 'child-documents';
export const DOC_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.pdf,.jpg,.jpeg,.png,.heic,.heif,.webp';
export const DOC_MAX = 15 * 1024 * 1024;

export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return localDate(d);
}
export function fmtDate(iso) {
  return iso ? new Date(iso + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}
// For timestamps (signed_at, created_at): the local day, not the UTC one.
export function fmtStamp(ts) {
  return ts ? new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

// Everything the packet and the Records report need for one daycare (optionally a few families).
export async function loadEnrollment(facilityId, familyIds = null) {
  const byFam = q => (familyIds ? q.in('family_id', familyIds) : q);
  const [forms, types, responses, docs] = await Promise.all([
    supabase.from('facility_forms').select('*').eq('facility_id', facilityId).eq('active', true).order('sort').order('created_at'),
    supabase.from('facility_doc_types').select('*').eq('facility_id', facilityId).eq('active', true).order('sort').order('created_at'),
    byFam(supabase.from('facility_form_responses').select('id, form_id, family_id, form_version, answer, signed_name, signed_at')
      .eq('facility_id', facilityId)).order('signed_at', { ascending: false }),
    byFam(supabase.from('child_documents').select('id, child_id, family_id, doc_type_id, label, file_path, file_name, effective_date, expires_on, uploaded_by_role, created_at')
      .eq('facility_id', facilityId)).order('created_at', { ascending: false }),
  ]);
  return {
    forms: forms.data || [], docTypes: types.data || [],
    latestResp: latestBy(responses.data, r => `${r.family_id}:${r.form_id}`),
    latestDoc: latestBy(docs.data, d => `${d.child_id}:${d.doc_type_id || 'other'}`),
    otherDocs: (docs.data || []).filter(d => !d.doc_type_id),
  };
}

// Rows arrive newest first; keep the first per key.
function latestBy(rows, key) {
  const m = {};
  for (const r of rows || []) { const k = key(r); if (!m[k]) m[k] = r; }
  return m;
}

export function formState(form, resp) {
  if (!resp) return { state: form.required ? 'todo' : 'optional', label: form.required ? 'To sign' : 'Optional' };
  if (resp.form_version < form.version) return { state: 'resign', label: 'Updated: sign again', resp };
  if (form.consent_question) return { state: 'done', label: resp.answer === 'yes' ? 'Answered Yes' : 'Answered No', resp };
  return { state: 'done', label: 'Signed', resp };
}

// Document types that apply to this child (allergy plans only when the child has allergies).
export function typesForChild(docTypes, child) {
  const hasAllergies = (child.allergies || []).filter(Boolean).length > 0;
  return docTypes.filter(t => !t.only_with_allergies || hasAllergies);
}

export function docState(type, doc, today = localDate()) {
  if (!doc) return { state: type.required ? 'missing' : 'optional', label: type.required ? 'Missing' : 'Optional' };
  if (doc.expires_on && doc.expires_on < today) return { state: 'expired', label: `Expired ${fmtDate(doc.expires_on)}`, doc };
  if (doc.expires_on && doc.expires_on <= addDays(today, 30)) return { state: 'expiring', label: `Expires ${fmtDate(doc.expires_on)}`, doc };
  return { state: 'ok', label: doc.expires_on ? `On file · expires ${fmtDate(doc.expires_on)}` : 'On file', doc };
}

// What a family still has to do. `children` = this family's children enrolled at the daycare;
// `contacts` = { emergency, pickup } counts.
export function packetItems({ forms, docTypes, latestResp, latestDoc, familyId, children, contacts, today = localDate() }) {
  const items = [];
  for (const f of forms) {
    const s = formState(f, latestResp[`${familyId}:${f.id}`]);
    if (f.required) items.push({ kind: 'form', id: f.id, title: f.title, done: s.state === 'done', state: s.state });
  }
  for (const c of children) {
    for (const t of typesForChild(docTypes, c)) {
      if (!t.required) continue;
      const s = docState(t, latestDoc[`${c.id}:${t.id}`], today);
      items.push({ kind: 'doc', child: c, type: t, done: s.state === 'ok' || s.state === 'expiring', state: s.state });
    }
    items.push({ kind: 'health', child: c, done: !!c.health_confirmed_at, state: c.health_confirmed_at ? 'done' : 'todo' });
  }
  const contactsDone = (contacts?.emergency || 0) > 0 && (contacts?.pickup || 0) > 0;
  items.push({ kind: 'contacts', done: contactsDone, state: contactsDone ? 'done' : 'todo' });
  return items;
}

export async function openDocument(path) {
  // Open the tab first so the browser doesn't treat it as a pop-up after the await.
  const win = window.open('', '_blank');
  const { data, error } = await supabase.storage.from(DOC_BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) { win?.close(); return error?.message || 'Could not open the file.'; }
  if (win) win.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  return null;
}

// Upload a file for a child and record it. role: 'parent' | 'staff'.
export async function uploadChildDocument({ facilityId, childId, docTypeId = null, label = null, file, effectiveDate = null, role }) {
  if (!file) return { error: 'Choose a file.' };
  if (file.size > DOC_MAX) return { error: 'That file is over 15 MB.' };
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'pdf';
  const path = `${facilityId}/${childId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(DOC_BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (upErr) return { error: /mime|type/i.test(upErr.message) ? 'Upload a photo or a PDF.' : upErr.message };
  const { error } = await supabase.from('child_documents').insert({
    facility_id: facilityId, child_id: childId, doc_type_id: docTypeId, label: label || null,
    file_path: path, file_name: file.name.slice(0, 200), file_size: file.size, mime_type: file.type || null,
    effective_date: effectiveDate || null, uploaded_by_role: role,
  });
  if (error) {
    await supabase.storage.from(DOC_BUCKET).remove([path]);
    return { error: error.message };
  }
  return { error: null };
}

// Contacts per family: { [family_id]: { emergency, pickup } }
export async function loadContactCounts(familyIds) {
  if (!familyIds.length) return {};
  const { data } = await supabase.from('family_contacts').select('family_id, kind').in('family_id', familyIds);
  const out = {};
  for (const r of data || []) {
    const c = (out[r.family_id] ||= { emergency: 0, pickup: 0 });
    if (r.kind === 'emergency') c.emergency++;
    if (r.kind === 'pickup') c.pickup++;
  }
  return out;
}

// Latest photo-consent answer per family: { [family_id]: 'yes' | 'no' }
export async function loadPhotoConsent(facilityId) {
  const { data: form } = await supabase.from('facility_forms').select('id').eq('facility_id', facilityId).eq('purpose', 'photo').eq('active', true).maybeSingle();
  if (!form) return {};
  const { data } = await supabase.from('facility_form_responses').select('family_id, answer, signed_at')
    .eq('form_id', form.id).order('signed_at', { ascending: false });
  const out = {};
  for (const r of data || []) if (!(r.family_id in out)) out[r.family_id] = r.answer;
  return out;
}
