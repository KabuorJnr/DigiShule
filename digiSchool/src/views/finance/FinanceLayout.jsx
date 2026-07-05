import { useState, useEffect } from 'react';
import { Outlet, NavLink, useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/widgets';
import { fetchTable } from '../../lib/api';

const TABS = [
  { id: '', label: 'Invoices & Billing', path: '.' },
  { id: 'payments', label: 'Payments', path: 'payments' },
  { id: 'statements', label: 'Student Statements', path: 'statements' },
  { id: 'fee_structure', label: 'School Fee Structure', path: 'fee_structure' },
  { id: 'expenses', label: 'Expense Management', path: 'expenses' },
  { id: 'reports', label: 'Reports & Analysis', path: 'reports' }
];

export default function FinanceLayout() {
  const { store, user, params } = useOutletContext();
  const location = useLocation();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    if (params?.tab) {
      const targetPath = params.tab === 'invoices' ? '/portal/finance' : `/portal/finance/${params.tab}`;
      if (location.pathname !== targetPath && location.pathname !== targetPath + '/') {
        navigate(targetPath, { replace: true });
      }
    }
  }, [params?.tab, location.pathname, navigate]);

  useEffect(() => {
    Promise.all([
      fetchTable('invoices').catch(() => []),
      fetchTable('financePayments').catch(() => []),
      fetchTable('expenses').catch(() => []),
      import('../../lib/api').then(({ fetchStudents }) => fetchStudents(0, 1000).then(r => r.data || [])).catch(() => [])
    ]).then(([invs, pays, exps, stus]) => {
      setInvoices(invs);
      setPayments(pays);
      setExpenses(exps);
      setStudents(stus || []);
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Finance & Accounting"
        subtitle="Manage billing, payments, expenses, and fee structures."
      />

      <div className="tabs" style={{ marginBottom: 24, borderBottom: '1px solid var(--border)', display: 'flex', gap: 24 }}>
        {TABS.map(t => {
          const isActive = t.id === '' 
            ? location.pathname.endsWith('/finance') || location.pathname.endsWith('/finance/')
            : location.pathname.includes(`/finance/${t.id}`);
            
          return (
            <NavLink
              key={t.id}
              to={t.path}
              end={t.id === ''}
              className="tab"
              style={{
                background: 'none', border: 'none', padding: '0 0 12px', cursor: 'pointer',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text)' : 'var(--text-muted)',
                borderBottom: isActive ? '2px solid var(--text)' : '2px solid transparent',
                textDecoration: 'none'
              }}
            >
              {t.label}
            </NavLink>
          );
        })}
      </div>

      <Outlet context={{ 
        store, user, params, 
        invoices, setInvoices, 
        payments, setPayments, 
        expenses, setExpenses, 
        students, setStudents 
      }} />
    </div>
  );
}
