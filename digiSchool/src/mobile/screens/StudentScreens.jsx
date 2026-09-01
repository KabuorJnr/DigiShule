import { useMemo } from 'react';
import { CalendarDays, PlayCircle, BookOpen } from 'lucide-react';
import { getChild, Empty, SecHead } from './kit';
import { ParentResults, ParentFees } from './ParentScreens';

// A student's own results/finance are the same views the parent sees, keyed to
// the student's own record — so we reuse them directly.
export function StudentResults(props) { return <ParentResults {...props} />; }
export function StudentFinance(props) { return <ParentFees {...props} />; }

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function StudentTimetable({ store, user }) {
  const child = getChild(user, store);
  const timetables = store.timetables || {};

  const { day, periods } = useMemo(() => {
    const cls = child.class;
    const tt = cls ? (timetables[cls] || timetables[String(cls).trim()]) : null;
    const grid = tt?.grid;
    const days = tt?.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    if (!grid) return { day: null, periods: [] };
    // Pick today if it's a school day, else the first school day.
    const todayName = DAY_NAMES[new Date().getDay()];
    let dayIdx = days.indexOf(todayName);
    let label = todayName;
    if (dayIdx === -1) { dayIdx = 0; label = days[0]; }
    const out = [];
    for (let p = 0; p < grid.length; p++) {
      const cell = grid[p]?.[dayIdx];
      if (cell && cell.subject) out.push({ period: p + 1, subject: cell.subject, teacher: cell.teacher });
    }
    return { day: label, periods: out };
  }, [child.class, timetables]);

  if (!child.class) return <Empty icon={CalendarDays} text="Your class hasn't been set yet. Ask your class teacher." />;
  if (periods.length === 0) return <Empty icon={CalendarDays} text={`No timetable published for ${child.class} yet.`} />;
  return (
    <>
      <SecHead title={`${day} · ${child.class}`} />
      <div className="eo-list-card">
        {periods.map((p) => (
          <div className="eo-tt" key={p.period}>
            <span className="eo-ttime">P{p.period}</span>
            <span className="eo-tbar" />
            <div className="eo-tbody"><b>{p.subject}</b><span>{p.teacher || ''}</span></div>
          </div>
        ))}
      </div>
    </>
  );
}

export function StudentLearn() {
  return (
    <Empty icon={PlayCircle} text="Your learning resources and assignments will appear here as your teachers share them." />
  );
}

export function StudentClasses({ store, user }) {
  const child = getChild(user, store);
  return (
    <>
      <SecHead title="My class" />
      <div className="eo-list-card">
        <div className="eo-li" style={{ cursor: 'default' }}>
          <span className="eo-lic" style={{ background: 'var(--eo-blue-50)', color: 'var(--eo-blue)' }}><BookOpen /></span>
          <div className="eo-lt"><b>{child.class || 'Not assigned'}</b><span>Admission no. {child.adm || '—'}</span></div>
        </div>
      </div>
    </>
  );
}
