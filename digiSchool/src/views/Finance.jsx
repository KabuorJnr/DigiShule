import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { PageHeader, KpiCard, Badge, ProgressBar } from '../components/widgets';
import Modal from '../components/Modal';
import { FINANCE_PAYMENTS, FEE_SUMMARY, fmtKES } from '../data/modules';

const pct = (c, e) => (e ? Math.round((c / e) * 100) : 0);
const barColor = (v) => (v >= 80 ? '#10B981' : v >= 60 ? '#F59E0B' : '#EF4444');

export default function Finance({ store }) {
  const { notify } = store;
  const [payments, setPayments] = useState(FINANCE_PAYMENTS);
  const [recordOpen, setRecordOpen] = useState(false);
  const [form, setForm] = useState({ student: '', adm: '', method: 'M-Pesa', ref: '', amount: '' });

  const totals = useMemo(() => {
    const collected = FEE_SUMMARY.reduce((s, f) => s + f.collected, 0);
    const expected = FEE_SUMMARY.reduce((s, f) => s + f.expected, 0);
    const today = payments.filter((p) => p.date === '2026-06-08').reduce((s, p) => s + p.amount, 0);
    return { collected, expected, rate: pct(collected, expected), today, outstanding: expected - collected };
  }, [payments]);

  const chartData = FEE_SUMMARY.map((f) => ({ form: f.form, collected: pct(f.collected, f.expected) }));

  const record = () => {
    const amt = Number(form.amount);
    if (!form.student || !form.adm || !amt) {
      notify('Student, admission no. and amount are required.', 'error');
      return;
    }
    setPayments((ps) => [
      {
        id: `p${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        student: form.student,
        adm: form.adm,
        method: form.method,
        ref: form.ref || '—',
        amount: amt,
      },
      ...ps,
    ]);
    setRecordOpen(false);
    setForm({ student: '', adm: '', method: 'M-Pesa', ref: '', amount: '' });
    notify(`Payment of ${fmtKES(amt)} recorded for ${form.student}.`);
  };

  return (
    <div>
      <PageHeader
        title="Fee Collection"
        subtitle="Payments, balances and collection performance"
        actions={<button className="btn btn-primary" onClick={() => setRecordOpen(true)}>+ Record Payment</button>}
      />

      <div className="stat-tiles">
        <KpiCard icon="💰" label="Collected (Term)" value={fmtKES(totals.collected)} accent="#047857" />
        <KpiCard icon="📈" label="Collection Rate" value={`${totals.rate}%`} accent="#F59E0B">
          <div style={{ marginTop: 8 }}><ProgressBar value={totals.rate} /></div>
        </KpiCard>
        <KpiCard icon="🧾" label="Outstanding" value={fmtKES(totals.outstanding)} accent="#EF4444" />
        <KpiCard icon="📅" label="Received Today" value={fmtKES(totals.today)} sub={`${payments.length} payments logged`} />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <div className="card card-pad">
          <div className="section-title">Collection by Form (% of expected)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} unit="%" />
              <YAxis type="category" dataKey="form" width={64} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="collected" radius={[0, 6, 6, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={barColor(d.collected)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-pad">
          <div className="section-title">Fee Balances by Form</div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr><th>Form</th><th>Billed/Student</th><th>Collected</th><th>Expected</th><th>Rate</th></tr>
              </thead>
              <tbody>
                {FEE_SUMMARY.map((f) => (
                  <tr key={f.form}>
                    <td style={{ fontWeight: 600 }}>{f.form}</td>
                    <td>{fmtKES(f.billed)}</td>
                    <td>{fmtKES(f.collected)}</td>
                    <td className="muted">{fmtKES(f.expected)}</td>
                    <td><Badge color={pct(f.collected, f.expected) >= 80 ? 'green' : pct(f.collected, f.expected) >= 60 ? 'amber' : 'red'}>{pct(f.collected, f.expected)}%</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="section-title">Recent Payments</div>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Student</th><th>Adm. No.</th><th>Method</th><th>Reference</th><th>Amount</th></tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td style={{ fontWeight: 600 }}>{p.student}</td>
                  <td className="muted">{p.adm}</td>
                  <td><Badge color={p.method === 'M-Pesa' ? 'green' : p.method === 'Bank' ? 'blue' : 'gray'}>{p.method}</Badge></td>
                  <td className="muted">{p.ref}</td>
                  <td style={{ fontWeight: 700 }}>{fmtKES(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {recordOpen && (
        <Modal title="Record Payment" onClose={() => setRecordOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setRecordOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={record}>Save Payment</button>
          </>
        }>
          <div className="grid grid-2">
            <div>
              <label className="field-label">Student Name</label>
              <input className="input" value={form.student} onChange={(e) => setForm((f) => ({ ...f, student: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Admission No.</label>
              <input className="input" value={form.adm} onChange={(e) => setForm((f) => ({ ...f, adm: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="field-label">Method</label>
              <select className="select" value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>
                <option>M-Pesa</option><option>Bank</option><option>Cheque</option><option>Cash</option>
              </select>
            </div>
            <div>
              <label className="field-label">Reference</label>
              <input className="input" value={form.ref} onChange={(e) => setForm((f) => ({ ...f, ref: e.target.value }))} />
            </div>
          </div>
          <label className="field-label" style={{ marginTop: 12 }}>Amount (KES)</label>
          <input type="number" className="input" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        </Modal>
      )}
    </div>
  );
}
