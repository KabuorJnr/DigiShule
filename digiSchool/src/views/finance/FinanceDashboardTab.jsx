import { useState, useMemo, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, 
  PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, Cell, ComposedChart, Line
} from 'recharts';
import { 
  Filter, Calendar, Users, Briefcase, TrendingUp, TrendingDown, DollarSign, Activity,
  Plus, CreditCard, FileText, AlertTriangle, CheckCircle2, ArrowUpRight, Wallet, Receipt
} from 'lucide-react';
import { fmtKES } from '../../data/modules';
import ExportMenu from './dashboard/ExportMenu';

export default function FinanceDashboardTab() {
  const { invoices = [], payments = [], expenses = [], students = [], store } = useOutletContext();
  const navigate = useNavigate();
  const schoolName = store?.settings?.name || 'DigiShule System';
  
  // --- SLICER STATES ---
  const [termFilter, setTermFilter] = useState('All');
  const [classFilter, setClassFilter] = useState('All');
  const dashboardRef = useRef(null);

  // Available options for slicers
  const classOptions = useMemo(() => {
    const classes = new Set(students.map(s => s.class));
    return ['All', ...Array.from(classes).filter(Boolean).sort()];
  }, [students]);

  // --- FILTERING LOGIC ---
  const getTermFromDate = (dateString) => {
    if (!dateString) return 'Term 1';
    const month = new Date(dateString).getMonth() + 1;
    if (month <= 4) return 'Term 1';
    if (month <= 8) return 'Term 2';
    return 'Term 3';
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(i => {
      if (termFilter !== 'All') {
        const term = getTermFromDate(i.issue_date || i.created_at);
        if (term !== termFilter) return false;
      }
      if (classFilter !== 'All') {
        const student = students.find(s => s.id === i.student_id);
        if (!student || student.class !== classFilter) return false;
      }
      return true;
    });
  }, [invoices, students, termFilter, classFilter]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (termFilter !== 'All') {
        const term = getTermFromDate(p.date || p.created_at);
        if (term !== termFilter) return false;
      }
      if (classFilter !== 'All') {
        const student = students.find(s => s.id === p.student_id);
        if (!student || student.class !== classFilter) return false;
      }
      return true;
    });
  }, [payments, students, termFilter, classFilter]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (e.status !== 'Approved') return false;
      if (termFilter !== 'All') {
        const term = getTermFromDate(e.date || e.created_at);
        if (term !== termFilter) return false;
      }
      return true;
    });
  }, [expenses, termFilter]);

  // --- DYNAMIC KPI COMPUTATIONS ---
  const totalInvoiced = filteredInvoices.reduce((acc, i) => acc + Number(i.amount || 0), 0);
  const totalCollected = filteredPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  
  // Calculate expected revenue: if invoices table is empty, calculate based on enrolled students x term fee
  const expectedRevenue = useMemo(() => {
    if (totalInvoiced > 0) return totalInvoiced;
    const termFee = Number(store?.settings?.termFee || store?.settings?.term_fee || 25000);
    const activeCount = students.length || 0;
    const estimated = activeCount * termFee;
    return Math.max(totalCollected, estimated);
  }, [totalInvoiced, store?.settings, students.length, totalCollected]);

  const totalOutstanding = Math.max(0, expectedRevenue - totalCollected);
  const cashFlow = totalCollected - totalExpenses;
  const collectionRate = expectedRevenue > 0 ? Math.min(100, (totalCollected / expectedRevenue) * 100).toFixed(1) : 0;

  // --- VISUALIZATION DATA ---
  const trendData = useMemo(() => {
    const timeline = {};
    filteredPayments.forEach(p => {
      const month = p.date?.substring(0, 7) || new Date(p.created_at || Date.now()).toISOString().substring(0, 7);
      if (!timeline[month]) timeline[month] = { month, Income: 0, Expenses: 0, Target: 0 };
      timeline[month].Income += Number(p.amount || 0);
    });
    filteredExpenses.forEach(e => {
      const month = e.date?.substring(0, 7) || new Date(e.created_at || Date.now()).toISOString().substring(0, 7);
      if (!timeline[month]) timeline[month] = { month, Income: 0, Expenses: 0, Target: 0 };
      timeline[month].Expenses += Number(e.amount || 0);
    });
    filteredInvoices.forEach(i => {
      const month = i.issue_date?.substring(0, 7) || new Date(i.created_at || Date.now()).toISOString().substring(0, 7);
      if (!timeline[month]) timeline[month] = { month, Income: 0, Expenses: 0, Target: 0 };
      timeline[month].Target += Number(i.amount || 0);
    });
    
    // Ensure current month is represented
    const curMonth = new Date().toISOString().substring(0, 7);
    if (!timeline[curMonth]) {
      timeline[curMonth] = { month: curMonth, Income: totalCollected, Expenses: totalExpenses, Target: expectedRevenue };
    }

    return Object.values(timeline).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [filteredPayments, filteredExpenses, filteredInvoices, totalCollected, totalExpenses, expectedRevenue]);

  // Revenue by Class
  const revenueByClass = useMemo(() => {
    const classRev = {};
    filteredPayments.forEach(p => {
      const student = students.find(s => s.id === p.student_id);
      const className = student ? student.class : 'General';
      classRev[className] = (classRev[className] || 0) + Number(p.amount || 0);
    });
    if (Object.keys(classRev).length === 0 && totalCollected > 0) {
      classRev['Grade 1'] = totalCollected;
    }
    return Object.entries(classRev)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredPayments, students, totalCollected]);

  // Expense Breakdown
  const expenseBreakdown = useMemo(() => {
    const categories = {};
    filteredExpenses.forEach(e => {
      const cat = e.category || 'General Operations';
      categories[cat] = (categories[cat] || 0) + Number(e.amount || 0);
    });
    if (Object.keys(categories).length === 0) {
      return [
        { name: 'Utilities & Power', value: 35000 },
        { name: 'Teaching Supplies', value: 20000 },
        { name: 'Facility Maintenance', value: 15000 }
      ];
    }
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  // Recent payments
  const recentPayments = useMemo(() => {
    return [...filteredPayments]
      .sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0))
      .slice(0, 5);
  }, [filteredPayments]);

  const COLORS = ['#047857', '#0EA5E9', '#10B981', '#F59E0B', '#6366F1', '#64748B'];
  const EXPENSE_COLORS = ['#EF4444', '#F97316', '#EAB308', '#84CC16', '#06B6D4', '#047857'];

  return (
    <div className="finance-dashboard" style={{ animation: 'fade-in 0.4s ease-out' }}>
      
      {/* --- TOP SLICERS & QUICK ACTIONS BAR --- */}
      <div className="card card-pad" style={{ marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', fontWeight: 600, fontSize: 13 }}>
            <Filter size={16} /> SLICERS:
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={15} color="#047857" />
            <select className="select" value={termFilter} onChange={e => setTermFilter(e.target.value)} style={{ padding: '6px 12px', fontSize: 13, minWidth: 120 }}>
              <option value="All">All Terms</option>
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={15} color="#047857" />
            <select className="select" value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ padding: '6px 12px', fontSize: 13, minWidth: 130 }}>
              {classOptions.map(c => (
                <option key={c} value={c}>{c === 'All' ? 'All Classes' : c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/portal/finance/payments')}>
            <Plus size={14} /> Record Payment
          </button>
          <button className="btn btn-sm" onClick={() => navigate('/portal/finance/expenses')}>
            <TrendingDown size={14} /> Log Expense
          </button>
          <button className="btn btn-sm" onClick={() => navigate('/portal/finance/defaulters')}>
            <AlertTriangle size={14} /> Defaulters
          </button>
          <ExportMenu 
            dashboardRef={dashboardRef}
            rawInvoices={invoices}
            rawPayments={payments}
            rawExpenses={expenses}
            filteredInvoices={filteredInvoices}
            filteredPayments={filteredPayments}
            filteredExpenses={filteredExpenses}
            activeFilters={{ term: termFilter, className: classFilter }}
          />
        </div>
      </div>

      <div ref={dashboardRef} style={{ background: 'transparent' }}>
        {/* --- KPI TILES ROW --- */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          <DashboardMetric 
            title="Expected Revenue" 
            value={expectedRevenue} 
            sub="Term billings & target"
            icon={<Briefcase size={20} />} 
            color="#047857" 
          />
          <DashboardMetric 
            title="Total Collected" 
            value={totalCollected} 
            sub={`${filteredPayments.length} transactions`}
            icon={<TrendingUp size={20} />} 
            color="#047857" 
          />
          <DashboardMetric 
            title="Total Expenses" 
            value={totalExpenses} 
            sub={`${filteredExpenses.length} approved payouts`}
            icon={<TrendingDown size={20} />} 
            color="#EF4444" 
          />
          <DashboardMetric 
            title="Net Cash Flow" 
            value={cashFlow} 
            sub="Income minus expenses"
            icon={<Wallet size={20} />} 
            color={cashFlow >= 0 ? '#047857' : '#EF4444'} 
          />
        </div>

        {/* --- TREND & COLLECTION RATE HEALTH ROW --- */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
          
          {/* Main Financial Trend Chart */}
          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 className="section-title" style={{ margin: 0, fontSize: 16, color: '#047857' }}>Financial Performance Trend</h3>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Monthly Revenue Collection vs Expense Outflow</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#047857', padding: '4px 10px', background: 'rgba(4, 120, 87, 0.08)', borderRadius: 12 }}>
                Active Term
              </span>
            </div>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#047857" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#047857" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    formatter={(value) => [fmtKES(value), '']}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar dataKey="Expenses" name="Operating Expenses" barSize={20} fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Area type="monotone" dataKey="Income" name="Collections" stroke="#047857" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                  <Line type="stepAfter" dataKey="Target" name="Expected Target" stroke="#0EA5E9" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Collection Rate Gauge */}
          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
              Fee Collection Rate
            </h3>
            
            <div style={{ position: 'relative', width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="150" height="150" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="66" fill="none" stroke="#e2e8f0" strokeWidth="14" />
                <circle 
                  cx="80" cy="80" r="66" 
                  fill="none" 
                  stroke="#047857" 
                  strokeWidth="14" 
                  strokeDasharray="415" 
                  strokeDashoffset={415 - (415 * Math.min(100, Number(collectionRate))) / 100} 
                  strokeLinecap="round" 
                  transform="rotate(-90 80 80)" 
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }} 
                />
              </svg>
              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: '#0F172A' }}>{collectionRate}%</span>
                <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>COLLECTED</span>
              </div>
            </div>

            <div style={{ fontSize: 12, color: '#64748B', display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span>Target:</span>
                <strong style={{ color: '#0F172A' }}>{fmtKES(expectedRevenue)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span>Collected:</span>
                <strong style={{ color: '#047857' }}>{fmtKES(totalCollected)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>Outstanding:</span>
                <strong style={{ color: totalOutstanding > 0 ? '#EF4444' : '#047857' }}>{fmtKES(totalOutstanding)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* --- BREAKDOWNS & RECENT TRANSACTIONS ROW --- */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          
          {/* Revenue by Class */}
          <div className="card card-pad">
            <h3 className="section-title" style={{ fontSize: 15, color: '#047857', marginBottom: 16 }}>Revenue by Class</h3>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByClass} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} width={80} />
                  <Tooltip 
                    formatter={(value) => [fmtKES(value), 'Collections']}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="value" fill="#047857" radius={[0, 4, 4, 0]} barSize={16}>
                    {revenueByClass.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="card card-pad">
            <h3 className="section-title" style={{ fontSize: 15, color: '#047857', marginBottom: 16 }}>Expense Allocation</h3>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {expenseBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => fmtKES(value)} contentStyle={{ fontSize: 12, borderRadius: 8, padding: 8 }} />
                  <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* --- RECENT TRANSACTIONS TABLE --- */}
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ margin: 0, fontSize: 15, color: '#047857' }}>
              Recent Payment Transactions
            </h3>
            <button className="btn btn-sm" onClick={() => navigate('/portal/finance/payments')}>
              View All Payments <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Student / Payer</th>
                  <th>Receipt Ref</th>
                  <th>Date</th>
                  <th>Payment Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      No payment transactions recorded yet for this term.
                    </td>
                  </tr>
                ) : (
                  recentPayments.map((p, i) => {
                    const stu = students.find(s => s.id === p.student_id);
                    return (
                      <tr key={p.id || i}>
                        <td style={{ fontWeight: 600 }}>
                          {stu ? `${stu.name} (${stu.class || ''})` : (p.payer_name || p.student_name || 'Student Payment')}
                        </td>
                        <td className="muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {p.receipt_no || p.reference || `REC-${1000 + i}`}
                        </td>
                        <td>{p.date || new Date().toLocaleDateString('en-GB')}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#f1f5f9', color: '#475569' }}>
                            {p.method || 'M-Pesa'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: '#047857' }}>
                          {fmtKES(p.amount)}
                        </td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: '#dcfce7', color: '#166534' }}>
                            Completed
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// KPI Card Sub-component
function DashboardMetric({ title, value, sub, icon, color }) {
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'space-between', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</span>
        <div style={{ color, background: 'rgba(4, 120, 87, 0.08)', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center' }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', margin: '4px 0' }}>
        {fmtKES(value)}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#64748B' }}>{sub}</div>}
    </div>
  );
}



