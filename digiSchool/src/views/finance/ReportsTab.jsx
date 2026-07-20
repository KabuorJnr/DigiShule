import { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { KpiCard } from '../../components/widgets';
import { Badge } from '../../components/widgets';
import { Icon } from '../../components/icons';
import { fmtKES } from '../../data/modules';
import { useOutletContext } from 'react-router-dom';

export default function ReportsTab() {
  const { invoices, payments, expenses, students, store } = useOutletContext();
  const budgets = store?.budgets || [];
  const budgetItems = store?.budgetItems || [];

  const [agingDrilldown, setAgingDrilldown] = useState(null);
  
  const totalBilled = invoices.reduce((acc, i) => acc + Number(i.amount), 0);
  const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalExpenses = expenses.filter(e => e.status === 'Approved').reduce((acc, e) => acc + Number(e.amount), 0);
  
  const cashFlow = totalCollected - totalExpenses;

  const expenseBreakdown = useMemo(() => {
    const categories = {};
    expenses.filter(e => e.status === 'Approved').forEach(e => {
      categories[e.category] = (categories[e.category] || 0) + Number(e.amount);
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [expenses]);
  
  const COLORS = ['#047857', '#047857', '#F59E0B', '#EF4444', '#047857'];

  const trendData = useMemo(() => {
    const timeline = {};
    payments.forEach(p => {
      const month = p.date?.substring(0, 7) || new Date(p.created_at).toISOString().substring(0, 7);
      if (!timeline[month]) timeline[month] = { month, Income: 0, Expenses: 0 };
      timeline[month].Income += Number(p.amount);
    });
    expenses.filter(e => e.status === 'Approved').forEach(e => {
      const month = e.date?.substring(0, 7) || new Date(e.created_at).toISOString().substring(0, 7);
      if (!timeline[month]) timeline[month] = { month, Income: 0, Expenses: 0 };
      timeline[month].Expenses += Number(e.amount);
    });
    return Object.values(timeline).sort((a, b) => a.month.localeCompare(b.month));
  }, [payments, expenses]);

  // --- AGING REPORT ---
  const agingData = useMemo(() => {
    const today = new Date();
    const buckets = {
      'Current': { count: 0, amount: 0, students: [] },
      '1-30 days': { count: 0, amount: 0, students: [] },
      '31-60 days': { count: 0, amount: 0, students: [] },
      '61-90 days': { count: 0, amount: 0, students: [] },
      '90+ days': { count: 0, amount: 0, students: [] }
    };

    // Build student balances
    const studentBalances = {};
    invoices.forEach(i => {
      if (i.status === 'Paid') return;
      if (!studentBalances[i.student_id]) {
        studentBalances[i.student_id] = { amount: 0, oldestDue: null };
      }
      studentBalances[i.student_id].amount += Number(i.amount);
      const due = i.due_date || i.created_at?.slice(0, 10);
      if (due && (!studentBalances[i.student_id].oldestDue || due < studentBalances[i.student_id].oldestDue)) {
        studentBalances[i.student_id].oldestDue = due;
      }
    });

    // Subtract payments
    payments.forEach(p => {
      if (studentBalances[p.student_id]) {
        studentBalances[p.student_id].amount -= Number(p.amount);
      }
    });

    // Classify into buckets
    Object.entries(studentBalances).forEach(([studentId, data]) => {
      if (data.amount <= 0) return;
      const student = students.find(s => s.id === studentId);
      const daysOverdue = data.oldestDue
        ? Math.max(0, Math.floor((today - new Date(data.oldestDue)) / (1000 * 60 * 60 * 24)))
        : 0;

      let bucket;
      if (daysOverdue === 0) bucket = 'Current';
      else if (daysOverdue <= 30) bucket = '1-30 days';
      else if (daysOverdue <= 60) bucket = '31-60 days';
      else if (daysOverdue <= 90) bucket = '61-90 days';
      else bucket = '90+ days';

      buckets[bucket].count++;
      buckets[bucket].amount += data.amount;
      buckets[bucket].students.push({
        name: student?.name || studentId,
        adm_no: student?.adm_no || '-',
        class: student?.class || '-',
        balance: data.amount,
        daysOverdue
      });
    });

    return buckets;
  }, [invoices, payments, students]);

  const agingChartData = Object.entries(agingData).map(([name, data]) => ({
    name,
    Amount: data.amount,
    Count: data.count
  }));

  const AGING_COLORS = ['#047857', '#047857', '#F59E0B', '#F97316', '#EF4444'];

  // --- BUDGET VS EXPENSE REPORT ---
  const budgetVsExpenseData = useMemo(() => {
    // We will just aggregate the latest approved budget items
    if (!budgetItems.length) return [];
    
    // Group by category
    const categories = {};
    budgetItems.forEach(item => {
      if (!categories[item.category]) categories[item.category] = { category: item.category, Budgeted: 0, Spent: 0 };
      categories[item.category].Budgeted += Number(item.allocated_amount || 0);
      categories[item.category].Spent += Number(item.spent_amount || 0);
    });

    // Also include expenses that might not be formally tracked in budgetItems but match the category
    expenses.filter(e => e.status === 'Approved').forEach(e => {
      if (!categories[e.category]) categories[e.category] = { category: e.category, Budgeted: 0, Spent: 0 };
      // Note: we don't double count if spent_amount is already updated via triggers, 
      // but if triggers aren't running, we'll map them here as a fallback or override:
      // Actually, since we don't know if triggers are active, let's strictly use budgetItems for Budgeted
      // and sum up from actual expenses for Spent to ensure accuracy.
    });

    const finalCategories = {};
    budgetItems.forEach(item => {
      if (!finalCategories[item.category]) finalCategories[item.category] = { category: item.category, Budgeted: 0, Spent: 0 };
      finalCategories[item.category].Budgeted += Number(item.allocated_amount || 0);
    });
    expenses.filter(e => e.status === 'Approved').forEach(e => {
      if (finalCategories[e.category]) {
        finalCategories[e.category].Spent += Number(e.amount || 0);
      } else {
        finalCategories[e.category] = { category: e.category, Budgeted: 0, Spent: Number(e.amount || 0) };
      }
    });

    return Object.values(finalCategories);
  }, [budgetItems, expenses]);

  return (
    <div>
      <div className="stat-tiles" style={{ marginBottom: 24 }}>
        <KpiCard iconComponent={<Icon name="file" size={24} />} label="Total Billed" value={fmtKES(totalBilled)} accent="#0078D4" />
        <KpiCard iconComponent={<Icon name="finance" size={24} />} label="Total Collected" value={fmtKES(totalCollected)} accent="#047857" />
        <KpiCard iconComponent={<Icon name="payment" size={24} />} label="Approved Expenses" value={fmtKES(totalExpenses)} accent="#EF4444" />
        <KpiCard iconComponent={<Icon name="analytics" size={24} />} label="Net Cash Flow" value={fmtKES(cashFlow)} accent={cashFlow >= 0 ? '#047857' : '#EF4444'} />
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <div className="section-title">Expense Breakdown</div>
          {expenseBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={expenseBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {expenseBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => fmtKES(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }} className="muted">No approved expenses yet.</div>
          )}
        </div>
        <div className="card card-pad">
          <div className="section-title">Income vs Expenses Trend</div>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip formatter={(value) => fmtKES(value)} />
                <Legend />
                <Bar dataKey="Income" fill="#047857" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }} className="muted">No transactions recorded yet.</div>
          )}
        </div>
      </div>

      {/* --- AGING REPORT SECTION --- */}
      <div style={{ marginTop: 24 }}>
        <div className="grid grid-2" style={{ gap: 24 }}>
          {/* Aging Chart */}
          <div className="card card-pad">
            <div className="section-title">Outstanding Fees - Aging Analysis</div>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v => `${v / 1000}k`} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip formatter={v => fmtKES(v)} contentStyle={{ backgroundColor: 'var(--surface-raised)', borderRadius: 8, border: '1px solid var(--border)' }} />
                  <Bar dataKey="Amount" radius={[4, 4, 0, 0]} barSize={40} cursor="pointer"
                    onClick={(data) => setAgingDrilldown(agingDrilldown === data.name ? null : data.name)}>
                    {agingChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={AGING_COLORS[index]} opacity={agingDrilldown && agingDrilldown !== entry.name ? 0.3 : 1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Aging Summary Table */}
          <div className="card card-pad">
            <div className="section-title">Aging Summary</div>
            <table className="table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th style={{ textAlign: 'center' }}>Students</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(agingData).map(([bucket, data], i) => (
                  <tr key={bucket} style={{ cursor: data.count > 0 ? 'pointer' : 'default', background: agingDrilldown === bucket ? 'var(--surface)' : 'transparent' }}
                    onClick={() => data.count > 0 && setAgingDrilldown(agingDrilldown === bucket ? null : bucket)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: AGING_COLORS[i] }} />
                        <span style={{ fontWeight: 500 }}>{bucket}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Badge color={data.count === 0 ? 'gray' : i >= 3 ? 'red' : i >= 2 ? 'amber' : 'green'}>{data.count}</Badge>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: data.amount > 0 ? AGING_COLORS[i] : 'var(--text-muted)' }}>
                      {fmtKES(data.amount)}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                      {data.count > 0 ? '→' : ''}
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                  <td>TOTAL</td>
                  <td style={{ textAlign: 'center' }}>{Object.values(agingData).reduce((s, d) => s + d.count, 0)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtKES(Object.values(agingData).reduce((s, d) => s + d.amount, 0))}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Drilldown Table */}
        {agingDrilldown && agingData[agingDrilldown]?.students.length > 0 && (
          <div className="card card-pad" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="section-title" style={{ margin: 0 }}>
                Students in "{agingDrilldown}" bucket
              </div>
              <button className="btn btn-sm" onClick={() => setAgingDrilldown(null)}>Close</button>
            </div>
            <div className="scroll-x">
              <table className="table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Adm No</th>
                    <th>Class</th>
                    <th style={{ textAlign: 'center' }}>Days Overdue</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {agingData[agingDrilldown].students
                    .sort((a, b) => b.balance - a.balance)
                    .map((s, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td className="muted">{s.adm_no}</td>
                        <td>{s.class}</td>
                        <td style={{ textAlign: 'center' }}>
                          <Badge color={s.daysOverdue >= 90 ? 'red' : s.daysOverdue >= 30 ? 'amber' : 'green'}>{s.daysOverdue}d</Badge>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#EF4444' }}>{fmtKES(s.balance)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* --- BUDGET VS EXPENSES SECTION --- */}
      <div className="card card-pad" style={{ marginTop: 24 }}>
        <div className="section-title">Budget vs Actual Expenses</div>
        {budgetVsExpenseData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={budgetVsExpenseData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="category" />
              <YAxis tickFormatter={(value) => `${value / 1000}k`} />
              <Tooltip formatter={(value) => fmtKES(value)} />
              <Legend />
              <Bar dataKey="Budgeted" fill="#047857" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Spent" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }} className="muted">No budget items found.</div>
        )}
      </div>
    </div>
  );
}



