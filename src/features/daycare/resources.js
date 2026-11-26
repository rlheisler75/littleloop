import { supabase } from '../../lib/supabase';

// Parent resources a daycare shares: links and files grouped by category.
export const RESOURCE_CATEGORIES = [
  { id: 'financial',   icon: '💵', label: 'Financial help',              hint: 'Childcare subsidies, payment help, tax credits' },
  { id: 'scholarship', icon: '🎓', label: 'Scholarships',                hint: 'Tuition scholarships and grants' },
  { id: 'development', icon: '🌱', label: 'Child development',           hint: 'Milestones, parenting guides, early intervention' },
  { id: 'newsletter',  icon: '📰', label: 'Newsletters & subscriptions', hint: 'Your newsletter, sign-up links' },
  { id: 'community',   icon: '🤝', label: 'Community services',          hint: 'Food, housing, family support programs' },
  { id: 'health',      icon: '🩺', label: 'Health',                      hint: 'Clinics, immunizations, dental, mental health' },
  { id: 'other',       icon: '📌', label: 'Other',                       hint: '' },
];
export const resourceCategory = id => RESOURCE_CATEGORIES.find(c => c.id === id) || RESOURCE_CATEGORIES[RESOURCE_CATEGORIES.length - 1];

export const RESOURCE_BUCKET = 'facility-resources';
export const RESOURCE_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx';
export const RESOURCE_MAX = 20 * 1024 * 1024;

export async function loadResources(facilityId) {
  const { data, error } = await supabase.from('facility_resources').select('*').eq('facility_id', facilityId)
    .order('pinned', { ascending: false }).order('created_at', { ascending: false });
  if (error) console.error('loadResources:', error);
  return data || [];
}

export async function uploadResourceFile(facilityId, file) {
  if (file.size > RESOURCE_MAX) return { error: 'That file is over 20 MB.' };
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'pdf';
  const path = `${facilityId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(RESOURCE_BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (error) return { error: /mime|type/i.test(error.message) ? 'Upload a PDF, Word document or picture.' : error.message };
  return { path };
}

export async function removeResourceFile(path) {
  if (path) await supabase.storage.from(RESOURCE_BUCKET).remove([path]);
}

export async function openResourceFile(path) {
  const win = window.open('', '_blank');
  const { data, error } = await supabase.storage.from(RESOURCE_BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) { win?.close(); return error?.message || 'Could not open the file.'; }
  if (win) win.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  return null;
}

export const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
