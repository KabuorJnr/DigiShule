import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, 
  PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, Cell, ComposedChart, Line
} from 'recharts';
import { Filter, Calendar, Users, Briefcase, TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { fmtKES } from '../../data/modules';
import ExportMenu from './dashboard/ExportMenu';
import { useRef } from 'react';

export default function FinanceDashboardTab() {
  const { invoices, payments, expenses, students } = useOutletContext();
  
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
  const filteredInvoices = useMemo(() => {
    return invoices.filter(i => {
      if (termFilter !== 'All' && i.term !== termFilter) return false;
      
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
        // Approximate term filter based on invoice if matched
        const inv = invoices.find(i => i.id === p.invoice_id);
        if (inv && inv.term !== termFilter) return false;
      }
      
      if (classFilter !== 'All') {
        const student = students.find(s => s.id === p.student_id);
        if (!student || student.class !== classFilter) return false;
      }
      return true;
    });
  }, [payments, invoices, students, termFilter, classFilter]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => e.status === 'Approved');
  }, [expenses]);

  // --- KPIs ---
  const totalInvoiced = filteredInvoices.reduce((acc, i) => acc + Number(i.amount), 0);
  const totalCollected = filteredPayments.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + Number(e.amount), 0);
  
  const totalOutstanding = Math.max(0, totalInvoiced - totalCollected);
  const cashFlow = totalCollected - totalExpenses;
  const collectionRate = totalInvoiced > 0 ? ((totalCollected / totalInvoiced) * 100).toFixed(1) : 0;

  // --- VISUALIZATION DATA ---

  // 1. Revenue vs Expenses Trend (Monthly)
  const trendData = useMemo(() => {
    const timeline = {};
    filteredPayments.forEach(p => {
      const month = p.date?.substring(0, 7) || new Date(p.created_at).toISOString().substring(0, 7);
      if (!timeline[month]) timeline[month] = { month, Income: 0, Expenses: 0, Target: 0 };
      timeline[month].Income += Number(p.amount);
    });
    filteredExpenses.forEach(e => {
      const month = e.date?.substring(0, 7) || new Date(e.created_at).toISOString().substring(0, 7);
      if (!timeline[month]) timeline[month] = { month, Income: 0, Expenses: 0, Target: 0 };
      timeline[month].Expenses += Number(e.amount);
    });
    filteredInvoices.forEach(i => {
      const month = i.issue_date?.substring(0, 7) || new Date(i.created_at).toISOString().substring(0, 7);
      if (!timeline[month]) timeline[month] = { month, Income: 0, Expenses: 0, Target: 0 };
      timeline[month].Target += Number(i.amount);
    });
    return Object.values(timeline).sort((a, b) => a.month.localeCompare(b.month)).slice(-6); // Last 6 months
  }, [filteredPayments, filteredExpenses, filteredInvoices]);

  // 2. Revenue by Class (Top 5)
  const revenueByClass = useMemo(() => {
    const classRev = {};
    filteredPayments.forEach(p => {
      const student = students.find(s => s.id === p.student_id);
      const className = student ? student.class : 'Unknown';
      classRev[className] = (classRev[className] || 0) + Number(p.amount);
    });
    return Object.entries(classRev)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredPayments, students]);

  // 3. Expense Breakdown
  const expenseBreakdown = useMemo(() => {
    const categories = {};
    filteredExpenses.forEach(e => {
      categories[e.category] = (categories[e.category] || 0) + Number(e.amount);
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  // 4. Payment Methods
  const methodData = useMemo(() => {
    const methods = {};
    filteredPayments.forEach(p => {
      const method = p.method || 'M-Pesa';
      methods[method] = (methods[method] || 0) + Number(p.amount);
    });
    return Object.entries(methods).map(([name, value]) => ({ name, value }));
  }, [filteredPayments]);

  const COLORS = ['#0D9488', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B'];
  const EXPENSE_COLORS = ['#EF4444', '#F97316', '#EAB308', '#84CC16', '#06B6D4', '#6366F1'];

  return (
    <div className="finance-dashboard" style={{ animation: 'fade-in 0.4s ease-out' }}>
      
      {/* --- TOP BAR: SLICERS & FILTERS --- */}
      <div className="card card-pad" style={{ marginBottom: 24, display: 'flex', gap: 20, alignItems: 'center', background: 'var(--surface-raised)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
          <Filter size={18} /> SLICERS
        </div>
        
        <div style={{ width: '1px', height: 24, background: 'var(--border)' }}></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={16} className="muted" />
          <select className="input" value={termFilter} onChange={e => setTermFilter(e.target.value)} style={{ padding: '6px 12px', minWidth: 140 }}>
            <option value="All">All Terms</option>
            <option value="Term 1">Term 1</option>
            <option value="Term 2">Term 2</option>
            <option value="Term 3">Term 3</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} className="muted" />
          <select className="input" value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ padding: '6px 12px', minWidth: 140 }}>
            {classOptions.map(c => (
              <option key={c} value={c}>{c === 'All' ? 'All Classes' : c}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }}></div>

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

      <div ref={dashboardRef} style={{ background: 'var(--bg)', padding: '4px' }}>
      {/* --- KPI ROW --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        <DashboardMetric title="Expected Revenue" value={totalInvoiced} icon={<Briefcase size={20} />} color="#3B82F6" />
        <DashboardMetric title="Total Collected" value={totalCollected} icon={<TrendingUp size={20} />} color="#10B981" />
        <DashboardMetric title="Deficit (Outstanding)" value={totalOutstanding} icon={<Activity size={20} />} color="#F59E0B" />
        <DashboardMetric title="Total Expenses" value={totalExpenses} icon={<TrendingDown size={20} />} color="#EF4444" />
        <DashboardMetric 
          title="Net Cash Flow" 
          value={cashFlow} 
          icon={<DollarSign size={20} />} 
          color={cashFlow >= 0 ? '#10B981' : '#EF4444'} 
          isCurrency={true}
        />
      </div>

      {/* --- CHARTS GRID --- */}
      <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
        
        {/* MAIN CHART: Income vs Target vs Expenses */}
        <div className="card card-pad" style={{ boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <div className="section-title" style={{ margin: 0 }}>Financial Performance Trend</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Last 6 Months</div>
          </div>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(val) => `${val / 1000}k`} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  formatter={(value) => [fmtKES(value), '']}
                  contentStyle={{ backgroundColor: 'var(--surface-raised)', borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar dataKey="Expenses" barSize={20} fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Area type="monotone" dataKey="Income" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                <Line type="stepAfter" dataKey="Target" stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DONUT CHARTS PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div className="card card-pad" style={{ flex: 1, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
             <div className="section-title">Revenue by Class (Top 6)</div>
             <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByClass} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" opacity={0.4} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} width={80} />
                  <Tooltip 
                    formatter={(value) => [fmtKES(value), 'Revenue']}
                    cursor={{fill: 'rgba(0,0,0,0.05)'}}
                    contentStyle={{ backgroundColor: 'var(--surface-raised)', borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="value" fill="#0D9488" radius={[0, 4, 4, 0]} barSize={16}>
                    {revenueByClass.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
             </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Expense Breakdown */}
            <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>EXPENSE ALLOCATION</div>
              <div style={{ width: '100%', height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2}>
                      {expenseBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => fmtKES(value)} contentStyle={{ fontSize: 12, borderRadius: 8, padding: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Collection Rate Gauge */}
            <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.0) 100%)` }}>
               <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>COLLECTION RATE</div>
               <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <svg width="120" height="120" viewBox="0 0 120 120">
                   <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="10" />
                   <circle cx="60" cy="60" r="50" fill="none" stroke="#10B981" strokeWidth="10" strokeDasharray="314" strokeDashoffset={314 - (314 * collectionRate) / 100} strokeLinecap="round" transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
                 </svg>
                 <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                   <span style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--text)' }}>{collectionRate}%</span>
                 </div>
               </div>
               <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Target vs Collected</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

// KPI Card Sub-component
function DashboardMetric({ title, value, icon, color, isCurrency = true }) {
  return (
    <div className="card" style={{ padding: '20px 16px', borderTop: `3px solid ${color}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
        <div style={{ color, background: `${color}15`, padding: 8, borderRadius: 8 }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 'bold', color: 'var(--text)', whiteSpace: 'nowrap' }}>
        {isCurrency ? fmtKES(value) : value}
      </div>
    </div>
  );
}
