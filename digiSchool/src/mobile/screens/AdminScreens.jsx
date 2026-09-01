import { useMemo } from 'react';
import { Users, BarChart3 } from 'lucide-react';
import AcademicAnalytics from '../../components/AcademicAnalytics';
import { fmtKES, useTable, StatCard, Prog, DList, Empty, SecHead, Loading } from './kit';

const paidStatuses = (p) => p.status !== 'Verification Pending' && p.status !== 'Pending';
function levelsFor(store) {
  const s = store?.settings || {};
  return s.classes?.length ? s.classes.map((c) => c.name) : (s.levels || ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']);
}

export function AdminAcademics({ store }) {
  const students = store.students || [];
  if (students.length === 0) return <Empty icon={BarChart3} text="Analytics appear once students and marks are in the system." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AcademicAnalytics students={students} gradeBoundaries={store.gradeBoundaries} />
    </div>
  );
}

export function AdminFinance({ store }) {
  const students = store.students || [];
  const feeStructure = store.feeStructure || [];
  const levels = levelsFor(store);
  const { rows: payments, loading } = useTable('payments');

  const stats = useMemo(() => {
    const feeForLevel = (lvl) => feeStructure.reduce((s, f) => s + (Number(f[lvl]) || 0), 0);
    const paidByStudent = {};
    (payments || []).filter(paidStatuses).forEach((p) => {
      const key = p.student_id || p.adm;
      paidByStudent[key] = (paidByStudent[key] || 0) + Number(p.amount || 0);
    });
    let expected = 0, collected = 0, defaulters = 0;
    students.forEach((s) => {
      const lvl = levels.find((l) => s.class?.startsWith(l)) || s.class;
      const due = feeForLevel(lvl);
      const paid = paidByStudent[s.id] || paidByStudent[s.adm] || 0;
      expected += due;
      collected += Math.min(paid, due);
      if (due - paid > 0) defaulters += 1;
    });
    const rate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
    return { expected, collected, outstanding: Math.max(0, expected - collected), defaulters, rate };
  }, [students, feeStructure, levels, payments]);

  if (loading) return <Loading />;
  return (
    <>
      <StatCard>
        <div className="eo-cap">Fees collected this term</div>
        <div className="eo-big eo-num">{stats.rate}%</div>
        <Prog value={stats.rate} />
        <div className="eo-split">
          <div className="eo-cell"><div className="eo-l">Collected</div><div className="eo-v eo-num">{fmtKES(stats.collected)}</div></div>
          <div className="eo-cell"><div className="eo-l">Outstanding</div><div className="eo-v eo-num" style={{ color: '#DC2626' }}>{fmtKES(stats.outstanding)}</div></div>
        </div>
      </StatCard>
      <SecHead title="Summary" />
      <DList items={[
        { k: 'Expected (term)', v: fmtKES(stats.expected) },
        { k: 'Students', v: students.length },
        { k: 'Fee defaulters', v: stats.defaulters, color: stats.defaulters ? '#DC2626' : '#059669' },
      ]} />
    </>
  );
}

export function AdminStaff({ store }) {
  const { rows: staff, loading } = useTable('staff');
  const byRole = useMemo(() => {
    const m = {};
    (staff || []).filter((s) => s.status !== 'Inactive').forEach((s) => {
      const r = (s.role || s.dept || 'Staff');
      m[r] = (m[r] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [staff]);
  const active = (staff || []).filter((s) => s.status !== 'Inactive').length;

  if (loading) return <Loading />;
  if (active === 0) return <Empty icon={Users} text="No staff records yet." />;
  return (
    <>
      <StatCard>
        <div className="eo-cap">Active staff</div>
        <div className="eo-big eo-num">{active}</div>
      </StatCard>
      <SecHead title="By role" />
      <DList items={byRole.map(([r, n]) => ({ k: String(r).replace(/_/g, ' '), v: n }))} />
    </>
  );
}
