import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';
import LessonPlans from './LessonPlans';
import SkillsTracker from './SkillsTracker';
import ReportCards from './ReportCards';

const VIEWS = [
  { id: 'plans',   icon: '🗓️', label: 'Lesson plans' },
  { id: 'skills',  icon: '🌱', label: 'Skills' },
  { id: 'reports', icon: '🎓', label: 'Report cards' },
];

// Learning: weekly lesson plans per classroom, each child's skills progress, and report cards.
export default function LearningTab({ facility, facilityId, me, manager, userId }) {
  const [view,  setView]  = useState(() => { try { return localStorage.getItem('ll_learning_view') || 'plans'; } catch { return 'plans'; } });
  const [rooms, setRooms] = useState(null);
  const [kids,  setKids]  = useState([]);

  const load = useCallback(async () => {
    const [{ data: rm }, { data: en }] = await Promise.all([
      supabase.from('classrooms').select('id, name, color, age_group').eq('facility_id', facilityId).eq('active', true).order('sort').order('name'),
      supabase.from('facility_enrollments').select('child_id, classroom_id').eq('facility_id', facilityId).eq('status', 'active'),
    ]);
    const ids = (en || []).map(e => e.child_id);
    const { data: ch } = ids.length
      ? await supabase.from('children').select('id, name, preferred_name, avatar, dob').in('id', ids).order('name')
      : { data: [] };
    const roomOf = Object.fromEntries((en || []).map(e => [e.child_id, e.classroom_id]));
    setRooms(rm || []);
    setKids((ch || []).map(c => ({ ...c, classroom_id: roomOf[c.id] || null })));
  }, [facilityId]);
  useEffect(() => { load(); }, [load]);

  const pick = id => { setView(id); try { localStorage.setItem('ll_learning_view', id); } catch {} };
  if (!rooms) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;

  const props = { facility, facilityId, rooms, kids, myRoomId: me?.classroom_id || null, manager, userId };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600 }}>Learning</div>
        <div style={{ display: 'inline-flex', padding: 3, borderRadius: 12, background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
          {VIEWS.map(v => (
            <button key={v.id} type="button" onClick={() => pick(v.id)} aria-pressed={view === v.id}
              style={{ padding: '6px 11px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                background: view === v.id ? 'var(--accent)' : 'transparent', color: view === v.id ? '#fff' : 'var(--text-dim)' }}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>
      {view === 'plans'   && <LessonPlans {...props}/>}
      {view === 'skills'  && <SkillsTracker {...props}/>}
      {view === 'reports' && <ReportCards {...props}/>}
    </div>
  );
}
