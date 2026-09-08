import { useMemo, useState, useEffect } from 'react';
import { Users, BarChart3, Bell } from 'lucide-react';
import AcademicAnalytics from '../../components/AcademicAnalytics';
import { upsertRow } from '../../lib/api';
import { fmtKES, useTable, StatCard, Prog, DList, Empty, SecHead, Loading, Composer } from './kit';

// Audience label -> notifications.audience array.
const AUDIENCE = {
  Everyone: ['all'], Parents: ['parents'], Teachers: ['teacher'], Students: ['student'], 'Admins & staff': ['admins'],
};

const paidStatuses = (p) => p.status !== 'Verification Pending' && p.status !== 'Pending';
function levelsFor(store) {
  const s = store?.settings || {};
  return s.classes?.length ? s.classes.map((c) => c.name) : (s.levels || ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']);
}

export function AdminAcademics({ store }) {
  const students = store.students || [];
  if (students.length === 0) return <Empty icon={BarChart3} text="Analytics appear once students and marks are in the system." />;
  return (
    <div className="eom-analytics" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
        <div className="eom-cap">Fees collected this term</div>
        <div className="eom-big eom-num">{stats.rate}%</div>
        <Prog value={stats.rate} />
        <div className="eom-split">
          <div className="eom-cell"><div className="eom-l">Collected</div><div className="eom-v eom-num">{fmtKES(stats.collected)}</div></div>
          <div className="eom-cell"><div className="eom-l">Outstanding</div><div className="eom-v eom-num" style={{ color: '#DC2626' }}>{fmtKES(stats.outstanding)}</div></div>
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

export function AdminNotices({ store, user }) {
  const { rows, loading } = useTable('notifications');
  const [items, setItems] = useState([]);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    setItems((rows || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  }, [rows]);

  const publish = async ({ to, subject, body }) => {
    const now = new Date().toISOString();
    const row = {
      id: `notice_${Date.now()}`, title: subject, message: body.slice(0, 240), body,
      posted_by: user?.name || 'Administration', role: user?.role || 'admin',
      audience: AUDIENCE[to] || ['all'], read: false, created_at: now,
    };
    await upsertRow('notifications', row);
    setItems((prev) => [row, ...prev]);
    setComposing(false);
  };

  if (loading) return <Loading />;
  if (composing) {
    return (
      <Composer
        title="Publish a notice"
        recipients={Object.keys(AUDIENCE)}
        onSend={publish} onCancel={() => setComposing(false)}
      />
    );
  }
  return (
    <>
      <div className="eom-sec"><h5>Notices</h5><a onClick={() => setComposing(true)}>Publish</a></div>
      {items.length === 0 ? (
        <Empty icon={Bell} text="No notices yet. Tap “Publish” to broadcast an announcement." />
      ) : (
        <div className="eom-list-card">
          {items.slice(0, 40).map((n) => (
            <div className="eom-li" key={n.id} style={{ cursor: 'default', alignItems: 'flex-start' }}>
              <span className="eom-lic" style={{ background: 'var(--eom-warn-100)', color: 'var(--eom-warn)' }}><Bell /></span>
              <div className="eom-lt">
                <b>{n.title}</b>
                <span style={{ whiteSpace: 'normal' }}>{(n.body || n.message || '').slice(0, 120)}</span>
              </div>
              <span className="eom-rt">{String(n.created_at || '').slice(0, 10)}</span>
            </div>
          ))}
        </div>
      )}
      <button className="eom-fab" onClick={() => setComposing(true)} aria-label="Publish notice"><Bell /></button>
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
        <div className="eom-cap">Active staff</div>
        <div className="eom-big eom-num">{active}</div>
      </StatCard>
      <SecHead title="By role" />
      <DList items={byRole.map(([r, n]) => ({ k: String(r).replace(/_/g, ' '), v: n }))} />
    </>
  );
}
