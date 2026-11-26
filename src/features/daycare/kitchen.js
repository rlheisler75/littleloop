import { supabase } from '../../lib/supabase';
import { addDays, localDate } from './enrollment';
import { weekText, esc, printWindow } from './learning';

// Daycare kitchen (phase 5A): meals, food groups, allergens, the USDA food program (CACFP)
// meal pattern check, and matching a menu against each child's allergies and diet.

export const MEALS = [
  { id: 'breakfast', label: 'Breakfast',       short: 'Breakfast', icon: '🥣' },
  { id: 'am_snack',  label: 'Morning snack',   short: 'AM snack',  icon: '🍎', snack: true },
  { id: 'lunch',     label: 'Lunch',           short: 'Lunch',     icon: '🍽️' },
  { id: 'pm_snack',  label: 'Afternoon snack', short: 'PM snack',  icon: '🧀', snack: true },
  { id: 'supper',    label: 'Supper',          short: 'Supper',    icon: '🍲' },
  { id: 'evening_snack', label: 'Evening snack', short: 'Eve snack', icon: '🌙', snack: true },   // evening and overnight care
];
export const DEFAULT_MEALS = ['breakfast', 'am_snack', 'lunch', 'pm_snack'];
export const mealOf = id => MEALS.find(m => m.id === id) || null;
export const mealLabel = id => mealOf(id)?.label || 'Meal';
export const servedMeals = settings => MEALS.filter(m => (settings?.meals || DEFAULT_MEALS).includes(m.id));

export const COMPONENTS = [
  { id: 'milk',      label: 'Milk',      icon: '🥛' },
  { id: 'fruit',     label: 'Fruit',     icon: '🍎' },
  { id: 'vegetable', label: 'Vegetable', icon: '🥦' },
  { id: 'grain',     label: 'Grain',     icon: '🍞' },
  { id: 'protein',   label: 'Protein',   icon: '🍗' },   // the program calls this "meat/meat alternate"
  { id: 'other',     label: 'Other',     icon: '🍴' },
];
export const componentOf = id => COMPONENTS.find(c => c.id === id) || COMPONENTS[COMPONENTS.length - 1];

// The 9 major food allergens (FDA)
export const ALLERGENS = [
  { id: 'milk', label: 'Milk' }, { id: 'egg', label: 'Egg' }, { id: 'peanut', label: 'Peanut' },
  { id: 'tree_nut', label: 'Tree nut' }, { id: 'fish', label: 'Fish' }, { id: 'shellfish', label: 'Shellfish' },
  { id: 'wheat', label: 'Wheat' }, { id: 'soy', label: 'Soy' }, { id: 'sesame', label: 'Sesame' },
];
export const allergenLabel = id => ALLERGENS.find(a => a.id === id)?.label || id;

// Which meal it probably is right now (only meals this daycare serves)
export function guessMeal(served, d = new Date()) {
  if (!served?.length) return null;
  const m = d.getHours() * 60 + d.getMinutes();
  // Overnight (24-hour care): after 7 PM and before 5 AM is the evening snack
  const id = m < 5 * 60 ? 'evening_snack' : m < 9 * 60 + 30 ? 'breakfast' : m < 11 * 60 ? 'am_snack' : m < 13 * 60 + 30 ? 'lunch'
    : m < 16 * 60 + 30 ? 'pm_snack' : m < 19 * 60 ? 'supper' : 'evening_snack';
  if (served.includes(id)) return id;
  const at = i => MEALS.findIndex(x => x.id === i);
  return [...served].sort((a, b) => Math.abs(at(a) - at(id)) - Math.abs(at(b) - at(id)))[0];
}

// USDA food program meal pattern for children 1 and older (infant meals follow a different pattern).
export function cacfpCheck(meal, foods = []) {
  if (!foods.length) return { ok: false, missing: [] };
  const has = c => foods.some(f => f.component === c);
  const vegs = foods.filter(f => f.component === 'vegetable').length;
  const missing = [];
  if (meal === 'breakfast') {
    if (!has('milk')) missing.push('milk');
    if (!has('fruit') && !has('vegetable')) missing.push('a fruit or vegetable');
    if (!has('grain') && !has('protein')) missing.push('a grain');
  } else if (meal === 'lunch' || meal === 'supper') {
    if (!has('milk')) missing.push('milk');
    if (!has('protein')) missing.push('a protein');
    if (!has('vegetable')) missing.push('a vegetable');
    if (!has('fruit') && vegs < 2) missing.push('a fruit (or a second vegetable)');
    if (!has('grain')) missing.push('a grain');
  } else {
    const groups = new Set(foods.map(f => f.component).filter(c => c && c !== 'other'));
    if (groups.size < 2) missing.push(groups.size ? 'a second food group' : 'two food groups');
  }
  return { ok: missing.length === 0, missing };
}

// ── Allergies and diets ─────────────────────────────────────────────────────────
// Words in a child's allergy list that point to one of the 9 allergens
const ALLERGY_WORDS = {
  milk: ['milk', 'dairy', 'lactose', 'casein', 'whey'],
  egg: ['egg'],
  peanut: ['peanut'],
  tree_nut: ['tree nut', 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'brazil nut'],
  fish: ['fish', 'salmon', 'tuna', 'cod', 'tilapia'],
  shellfish: ['shellfish', 'shrimp', 'crab', 'lobster', 'crawfish', 'prawn', 'clam', 'oyster', 'scallop'],
  wheat: ['wheat', 'gluten', 'celiac'],
  soy: ['soy'],
  sesame: ['sesame'],
};
// Words in a FOOD's name that give the allergen away even if nobody tagged it
const FOOD_WORDS = {
  milk: ['milk', 'cheese', 'yogurt', 'yoghurt'], egg: ['egg'], peanut: ['peanut'],
  tree_nut: ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'nutella'],
  fish: ['fish', 'salmon', 'tuna', 'cod', 'tilapia'], shellfish: ['shrimp', 'crab', 'lobster', 'prawn'],
  wheat: ['wheat'], soy: ['soy', 'tofu', 'edamame'], sesame: ['sesame', 'tahini', 'hummus'],
};
const DIET_ALLERGENS = {
  'Dairy-free': ['milk'], 'Vegan': ['milk', 'egg', 'fish', 'shellfish'], 'Gluten-free': ['wheat'],
  'Nut-free': ['peanut', 'tree_nut'], 'Egg-free': ['egg'],
};
const MEAT = ['chicken', 'beef', 'pork', 'turkey', 'ham', 'bacon', 'sausage', 'meatball', 'pepperoni', 'hot dog', 'burger', 'meat'];
const DIET_WORDS = {
  'Vegetarian': [...MEAT, 'fish', 'tuna', 'salmon'], 'Vegan': [...MEAT, 'fish', 'tuna', 'salmon', 'honey'],
  'No pork': ['pork', 'ham', 'bacon', 'sausage', 'pepperoni', 'hot dog'], 'No beef': ['beef', 'hamburger', 'meatball', 'burger'],
};
const HAND_CHECK_DIETS = ['Halal', 'Kosher'];

const norm = s => String(s || '').toLowerCase();
const stem = w => /ies$/.test(w) ? w.replace(/ies$/, 'y') : /(ches|shes|xes|oes)$/.test(w) ? w.slice(0, -2) : /[^s]s$/.test(w) ? w.slice(0, -1) : w;
const stemmed = s => norm(s).split(/[^a-z0-9]+/).filter(Boolean).map(stem).join(' ');
const hasWord = (text, word) => new RegExp(`(^| )${stem(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(text);

// What a child can't have: allergen tags (with the reason to show) and extra words to look for in food names
export function restrictionsOf(child) {
  const tags = new Map(), words = [];
  for (const a of (child?.allergies || []).filter(Boolean)) {
    const t = norm(a);
    let mapped = false;
    for (const [id, kws] of Object.entries(ALLERGY_WORDS)) {
      const text = id === 'fish' ? t.replace(/shellfish/g, '') : t;   // "shellfish" isn't a fish allergy
      if (kws.some(k => text.includes(k))) { tags.set(id, `${a} allergy`); mapped = true; }
    }
    if (/\bnuts?\b/.test(t) && !t.includes('peanut') && !t.includes('tree')) { tags.set('peanut', `${a} allergy`); tags.set('tree_nut', `${a} allergy`); mapped = true; }
    if (!mapped && stemmed(a).length >= 3) words.push({ word: stemmed(a), reason: `${a} allergy` });
  }
  for (const d of child?.diet_types || []) {
    (DIET_ALLERGENS[d] || []).forEach(id => { if (!tags.has(id)) tags.set(id, d); });
    (DIET_WORDS[d] || []).forEach(w => words.push({ word: stem(w), reason: d }));
  }
  const handCheck = [...(child?.diet_types || []).filter(d => HAND_CHECK_DIETS.includes(d)), child?.dietary_restrictions, child?.feeding_notes]
    .map(s => (s || '').trim()).filter(Boolean);
  return { tags, words, handCheck, severe: !!child?.allergy_severe };
}
export const hasRestrictions = child => {
  const r = restrictionsOf(child);
  return r.tags.size > 0 || r.words.length > 0 || r.handCheck.length > 0;
};

// The foods in a meal this child shouldn't have, and why: [{ food, why: [...] }]
export function conflictsFor(child, foods = []) {
  const r = restrictionsOf(child);
  if (!r.tags.size && !r.words.length) return [];
  const out = [];
  for (const f of foods) {
    const name = stemmed(f.name);
    const why = new Set();
    for (const a of f.allergens || []) if (r.tags.has(a)) why.add(r.tags.get(a));
    for (const [id, kws] of Object.entries(FOOD_WORDS)) {
      const text = id === 'milk' ? name.replace(/(almond|soy|oat|rice|coconut|cashew|hemp|pea) milk/g, '') : name;   // plant milks aren't dairy
      if (r.tags.has(id) && kws.some(k => hasWord(text, k))) why.add(r.tags.get(id));
    }
    for (const w of r.words) if (hasWord(name, w.word)) why.add(w.reason);   // whole words: "ham" isn't in "graham crackers"
    if (why.size) out.push({ food: f.name, why: [...why] });
  }
  return out;
}

// Children with a problem at this meal, most serious first
export function mealConflicts(kids, foods) {
  return kids.map(k => ({ kid: k, hits: conflictsFor(k, foods) })).filter(x => x.hits.length)
    .sort((a, b) => (b.kid.allergy_severe ? 1 : 0) - (a.kid.allergy_severe ? 1 : 0) || kidName(a.kid).localeCompare(kidName(b.kid)));
}
export const kidName = k => k?.preferred_name || k?.name || 'Child';

// "Lunch: pasta, peas, milk" (for the daily report)
export const servedText = (meal, foods) => foods?.length ? `${mealLabel(meal)}: ${foods.map(f => f.name).join(', ')}` : '';

// ── Data ────────────────────────────────────────────────────────────────────────
export async function loadKitchenSettings(facilityId) {
  const { data } = await supabase.from('daycare_kitchen_settings').select('*').eq('facility_id', facilityId).maybeSingle();
  return data || { facility_id: facilityId, meals: DEFAULT_MEALS, cacfp: false, _new: true };
}
export async function loadKitchenKids(facilityId) {
  const { data, error } = await supabase.rpc('daycare_kitchen_children', { p_facility: facilityId });
  if (error) console.error('kitchen children:', error);
  return data || [];
}
// Menus for days [from, to], as { 'YYYY-MM-DD|meal': row }
export async function loadMenus(facilityId, from, to) {
  const { data } = await supabase.from('daycare_menus').select('*').eq('facility_id', facilityId).gte('day', from).lte('day', to);
  return Object.fromEntries((data || []).map(r => [`${r.day}|${r.meal}`, r]));
}
// Substitutes for days [from, to], as { 'YYYY-MM-DD|meal|child_id': row }
export async function loadSubs(facilityId, from, to) {
  const { data } = await supabase.from('daycare_meal_subs').select('*').eq('facility_id', facilityId).gte('day', from).lte('day', to);
  return Object.fromEntries((data || []).map(r => [`${r.day}|${r.meal}|${r.child_id}`, r]));
}

// Monday to Friday, or to Sunday for a daycare open on weekends
export const weekDays = (monday, n = 5) => Array.from({ length: n }, (_, i) => addDays(monday, i));
export const openDays = settings => settings?.weekends ? 7 : 5;
export function weekRange(monday, n = 5) {
  const a = new Date(monday + 'T12:00:00'), b = new Date(addDays(monday, n - 1) + 'T12:00:00');
  return `${a.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${b.toLocaleDateString([], a.getMonth() === b.getMonth() ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`;
}
export const dayLabel = iso => new Date(iso + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
export const isToday = iso => iso === localDate();

// Print the week's menu to post on the wall
export function printMenu(monday, menus, meals, facilityName, n = 5) {
  const days = weekDays(monday, n);
  const cell = (d, m) => {
    const r = menus[`${d}|${m.id}`];
    return r?.foods?.length ? r.foods.map(f => esc(f.name)).join('<br>') + (r.note ? `<div class="note">${esc(r.note)}</div>` : '') : '<span class="none">—</span>';
  };
  printWindow(`Menu: week of ${weekRange(monday, n)}`, `
    @page{size:landscape;margin:12mm}
    table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#f1f5f9;font-size:13px;padding:6px;border:1px solid #cbd5e1}
    td{vertical-align:top;border:1px solid #cbd5e1;padding:6px;font-size:13px;line-height:1.5}th.meal{width:110px;text-align:left}
    .none{color:#94a3b8}.note{font-size:11px;color:#64748b;font-style:italic;margin-top:4px}.foot{font-size:11px;color:#64748b;margin-top:10px}`,
    `<h1>Menu: week of ${esc(weekRange(monday, n))}</h1><div class="sub">${esc(facilityName || '')}</div>
     <table><tr><th class="meal"></th>${days.map(d => `<th>${esc(dayLabel(d))}</th>`).join('')}</tr>
     ${meals.map(m => `<tr><th class="meal">${esc(m.label)}</th>${days.map(d => `<td>${cell(d, m)}</td>`).join('')}</tr>`).join('')}</table>
     <div class="foot">Children with food allergies or special diets get a safe substitute. Menu may change.</div>`);
}
