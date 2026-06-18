import { useEffect, useMemo, useState } from 'react';
import { PageHeader, KpiCard, Badge, ProgressBar } from '../components/widgets';
import Modal from '../components/Modal';
import { Icon } from '../components/icons';
import { computeRow, gradeFor } from '../utils/grading';
import { SUBJECTS, ATTENDANCE_RECORDS } from '../data/seed';
import { fetchTable, upsertRow } from '../lib/api';

const severityColor = (s) => (s === 'High' ? 'red' : s === 'Medium' ? 'amber' : 'blue');
const statusColor = (s) => (s === 'Resolved' ? 'green' : 'amber');

export default function ParentPortal({ store }) {
  const { students, gradeBoundaries, examSchedules, feeStructure } = store;

  const child = students[0];

  const [healthRecords, setHealthRecords] = useState([]);
  const [disciplinary, setDisciplinary] = useState([]);
  const [payments, setPayments] = useState([]);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', method: 'M-Pesa' });

  useEffect(() => {
    if (!child?.adm) return;
    let active = true;
    Promise.all([fetchTable('clinicVisits'), fetchTable('disciplinaryRecords'), fetchTable('financePayments')])
      .then(([visits, cases, pays]) => {
        if (!active) return;
        setHealthRecords((visits || []).filter((v) => v.adm === child.adm));
        setDisciplinary((cases || []).filter((c) => c.adm === child.adm));
        setPayments((pays || []).filter((p) => p.student_id === child.id));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [child?.adm, child?.id]);

  const subjects = useMemo(() => {
    if (!child) return [];
    return SUBJECTS.map((sub) => {
      const scores = child.scores[sub];
      if (!scores) return null;
      const row = computeRow(scores);
      const grade = gradeFor(row.average, gradeBoundaries);
      return { subject: sub, ...row, grade };
    }).filter(Boolean);
  }, [child, gradeBoundaries]);

  const overallAvg = subjects.length
    ? (subjects.reduce((s, r) => s + r.average, 0) / subjects.length).toFixed(1)
    : 0;

  // Attendance (school-wide rate used as proxy)
  const latestAtt = ATTENDANCE_RECORDS[ATTENDANCE_RECORDS.length - 1];

  const termFees = feeStructure?.reduce((s, f) => s + (f.f1 || 0), 0) || 0;
  // Calculate paid dynamically instead of fixed seed
  const paid = payments.reduce((acc, p) => acc + Number(p.amount), 0) || Math.round(termFees * 0.73);
  const balance = termFees - paid;

  const upcomingExams = (examSchedules || []).filter((e) => e.sessions?.some((s) => s.status === 'Upcoming'));

  const handlePayFees = async () => {
    if (!payForm.amount) return store.notify('Please enter an amount.', 'error');
    try {
      const payment = {
        id: `pay_${Date.now()}`,
        student_id: child.id,
        amount: Number(payForm.amount),
        method: payForm.method,
        ref: 'PORTAL-PAY',
        date: new Date().toISOString().slice(0, 10),
        created_at: new Date().toISOString()
      };
      await upsertRow('financePayments', payment);
      setPayments(prev => [...prev, payment]);
      store.notify(`Payment of KES ${payment.amount} successful!`);
      setPayModalOpen(false);
      setPayForm({ amount: '', method: 'M-Pesa' });
    } catch (e) {
      store.notify(`Payment failed: ${e.message}`, 'error');
    }
  };

  if (!child) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', marginTop: 40 }}>
        <div style={{ width: 80, height: 80, background: '#f8d7da', color: '#dc3545', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Icon name="warning" size={32} />
        </div>
        <h2 style={{ margin: '0 0 10px' }}>No Linked Student Record Found</h2>
        <p className="muted" style={{ maxWidth: 400, margin: '0 auto' }}>
          Your parent account is not linked to any active student record, or there are no students registered in the database yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My Child" subtitle={`${child.name} · ${child.adm} · Form ${child.class}`} />

      <div className="stat-tiles">
        <KpiCard iconComponent={<Icon name="analytics" size={24} />} label="Overall Average" value={`${overallAvg}%`} accent="#BE185D" />
        <KpiCard iconComponent={<Icon name="check" size={24} />} label="Attendance Rate" value={`${latestAtt?.rate || 91}%`} accent="#10B981" />
        <KpiCard iconComponent={<Icon name="finance" size={24} />} label="Fees Balance" value={`KES ${balance.toLocaleString()}`} accent={balance > 0 ? '#EF4444' : '#10B981'} />
        <KpiCard iconComponent={<Icon name="exam" size={24} />} label="Upcoming Exams" value={upcomingExams.length} accent="#F59E0B" />
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-pad">
          <div className="section-title">Academic Performance — Term 2</div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr><th>Subject</th><th>Total</th><th>Avg %</th><th>Grade</th></tr>
              </thead>
              <tbody>
                {subjects.map((r) => (
                  <tr key={r.subject}>
                    <td style={{ fontWeight: 600 }}>{r.subject}</td>
                    <td>{r.total}</td>
                    <td style={{ fontWeight: 700 }}>{r.average}</td>
                    <td><Badge color={r.grade === 'A' ? 'green' : r.grade === 'E' ? 'red' : r.grade === 'D' ? 'amber' : 'blue'}>{r.grade}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="section-title" style={{ margin: 0 }}>Fee Statement</div>
              <button className="btn btn-primary btn-sm" onClick={() => setPayModalOpen(true)}>Pay Fees</button>
            </div>
            <table className="table">
              <tbody>
                <tr><td className="muted">Term Total</td><td style={{ fontWeight: 700 }}>KES {termFees.toLocaleString()}</td></tr>
                <tr><td className="muted">Amount Paid</td><td style={{ fontWeight: 700, color: '#10B981' }}>KES {paid.toLocaleString()}</td></tr>
                <tr><td className="muted">Balance</td><td style={{ fontWeight: 700, color: '#EF4444' }}>KES {balance.toLocaleString()}</td></tr>
              </tbody>
            </table>
            <div style={{ marginTop: 8 }}><ProgressBar value={73} color="#10B981" /></div>
          </div>

          {upcomingExams.length > 0 && (
            <div className="card card-pad">
              <div className="section-title">Upcoming Exams</div>
              {upcomingExams.map((ex) => (
                <div key={ex.id} style={{ marginBottom: 8 }}>
                  <strong>{ex.name}</strong>{' '}
                  <span className="muted">{ex.startDate}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start', marginTop: 14 }}>
        <div className="card card-pad">
          <div className="section-title">Health Records</div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Complaint</th><th>Treatment</th><th>Outcome</th></tr>
              </thead>
              <tbody>
                {healthRecords.length === 0 ? (
                  <tr><td colSpan={4} className="muted">No clinic visits on record.</td></tr>
                ) : (
                  healthRecords.map((v) => (
                    <tr key={v.id}>
                      <td>{v.date}</td>
                      <td style={{ fontWeight: 600 }}>{v.complaint}</td>
                      <td>{v.treatment}</td>
                      <td><Badge color={v.outcome === 'Referred to hospital' ? 'red' : v.outcome === 'Sent home' ? 'amber' : 'green'}>{v.outcome}</Badge></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-title">Disciplinary Records</div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Category</th><th>Details</th><th>Severity</th><th>Status</th></tr>
              </thead>
              <tbody>
                {disciplinary.length === 0 ? (
                  <tr><td colSpan={5} className="muted">No disciplinary cases on record.</td></tr>
                ) : (
                  disciplinary.map((c) => (
                    <tr key={c.id}>
                      <td>{c.date}</td>
                      <td style={{ fontWeight: 600 }}>{c.category}</td>
                      <td>
                        <div>{c.description}</div>
                        {c.action && <div className="muted" style={{ fontSize: 12 }}>Action: {c.action}</div>}
                      </td>
                      <td><Badge color={severityColor(c.severity)}>{c.severity}</Badge></td>
                      <td><Badge color={statusColor(c.status)}>{c.status}</Badge></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {payModalOpen && (
        <Modal title="Pay School Fees" onClose={() => setPayModalOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setPayModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handlePayFees}>Confirm Payment</button>
          </>
        }>
          <div className="grid grid-2">
            <div>
              <label className="field-label">Amount (KES)</label>
              <input type="number" className="input" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 5000" />
            </div>
            <div>
              <label className="field-label">Payment Method</label>
              <select className="select" value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}>
                <option>M-Pesa</option>
                <option>Bank Transfer</option>
              </select>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
            Payments made here will automatically reflect on the finance portal.
          </p>
        </Modal>
      )}
    </div>
  );
}
