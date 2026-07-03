import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { KpiCard } from '../../components/widgets';
import { Icon } from '../../components/icons';
import { fmtKES } from '../../data/modules';
import { useOutletContext } from 'react-router-dom';

export default function ReportsTab() {
  const { invoices, payments, expenses } = useOutletContext();
  
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
  
  const COLORS = ['#0D9488', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

  const trendData = useMemo(() => {
    const timeline = {};
    payments.forEach(p => {
      const month = p.date.substring(0, 7);
      if (!timeline[month]) timeline[month] = { month, Income: 0, Expenses: 0 };
      timeline[month].Income += Number(p.amount);
    });
    expenses.filter(e => e.status === 'Approved').forEach(e => {
      const month = e.date.substring(0, 7);
      if (!timeline[month]) timeline[month] = { month, Income: 0, Expenses: 0 };
      timeline[month].Expenses += Number(e.amount);
    });
    return Object.values(timeline).sort((a, b) => a.month.localeCompare(b.month));
  }, [payments, expenses]);

  return (
    <div>
      <div className="stat-tiles" style={{ marginBottom: 24 }}>
        <KpiCard iconComponent={<Icon name="file" size={24} />} label="Total Billed" value={fmtKES(totalBilled)} accent="#0078D4" />
        <KpiCard iconComponent={<Icon name="finance" size={24} />} label="Total Collected" value={fmtKES(totalCollected)} accent="#10B981" />
        <KpiCard iconComponent={<Icon name="payment" size={24} />} label="Approved Expenses" value={fmtKES(totalExpenses)} accent="#EF4444" />
        <KpiCard iconComponent={<Icon name="analytics" size={24} />} label="Net Cash Flow" value={fmtKES(cashFlow)} accent={cashFlow >= 0 ? '#10B981' : '#EF4444'} />
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
                <Bar dataKey="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }} className="muted">No transactions recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
