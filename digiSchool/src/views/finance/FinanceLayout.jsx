import { useState, useEffect, useCallback } from 'react';
import { Outlet, useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/widgets';
import { fetchTable } from '../../lib/api';


export default function FinanceLayout() {
  const { store, user, params } = useOutletContext();
  const location = useLocation();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [students, setStudents] = useState([]);
  const [paymentPlans, setPaymentPlans] = useState([]);
  const [scholarships, setScholarships] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [payrollEntries, setPayrollEntries] = useState([]);
  const [staff, setStaff] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [tenders, setTenders] = useState([]);
  const [assets, setAssets] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [budgetItems, setBudgetItems] = useState([]);

  useEffect(() => {
    Promise.all([
      fetchTable('invoices').catch(() => []),
      fetchTable('financePayments').catch(() => []),
      fetchTable('expenses').catch(() => []),
      import('../../lib/api').then(({ fetchStudents }) => fetchStudents(0, 1000).then(r => r.data || [])).catch(() => []),
      fetchTable('payment_plans').catch(() => []),
      fetchTable('scholarships').catch(() => []),
      fetchTable('finance_audit_log').catch(() => []),
      fetchTable('payrolls').catch(() => []),
      fetchTable('payroll_entries').catch(() => []),
      fetchTable('staff').catch(() => []),
      fetchTable('purchase_orders').catch(() => []),
      fetchTable('tenders').catch(() => []),
      fetchTable('fixed_assets').catch(() => []),
      fetchTable('budgets').catch(() => []),
      fetchTable('budget_items').catch(() => [])
    ]).then(([invs, pays, exps, stus, plans, schs, logs, prs, prents, stf, pos, tnds, asts, bdgs, bitems]) => {
      setInvoices(invs);
      setPayments(pays);
      setExpenses(exps);
      setStudents(stus || []);
      setPaymentPlans(plans || []);
      setScholarships(schs || []);
      setAuditLogs(logs || []);
      setPayrolls(prs || []);
      setPayrollEntries(prents || []);
      setStaff(stf || []);
      setPurchaseOrders(pos || []);
      setTenders(tnds || []);
      setAssets(asts || []);
      setBudgets(bdgs || []);
      setBudgetItems(bitems || []);
    });
  }, []);

  // Audit log helper — passed to child tabs via context
  const addAuditLog = useCallback((action, details, amount) => {
    const log = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action,
      details,
      amount: amount ? Number(amount) : null,
      user: user?.name || 'System',
      timestamp: new Date().toISOString()
    };
    setAuditLogs(prev => [log, ...prev]);

    // Persist to DB (fire and forget)
    import('../../lib/api').then(({ upsertRow }) => {
      upsertRow('finance_audit_log', log).catch(() => {});
    });
  }, [user?.name]);

  // Use params.tab for an instant synchronous check, avoiding React Router's async location.pathname flicker
  const isDashboard = !params?.tab;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {!isDashboard && (
        <>
          <PageHeader
            title="Finance & Accounting"
            subtitle="Manage billing, payments, expenses, and fee structures."
          />
        </>
      )}

      <Outlet context={{ 
        store: { ...store, addAuditLog, paymentPlans, setPaymentPlans, scholarships, setScholarships, auditLogs, setAuditLogs, payrolls, setPayrolls, payrollEntries, setPayrollEntries, staff, purchaseOrders, setPurchaseOrders, tenders, setTenders, assets, setAssets, budgets, setBudgets, budgetItems, setBudgetItems },
        user, params, 
        invoices, setInvoices, 
        payments, setPayments, 
        expenses, setExpenses, 
        students, setStudents,
        paymentPlans, setPaymentPlans,
        scholarships, setScholarships,
        auditLogs, setAuditLogs,
        payrolls, setPayrolls,
        payrollEntries, setPayrollEntries,
        staff,
        purchaseOrders, setPurchaseOrders,
        tenders, setTenders,
        assets, setAssets,
        budgets, setBudgets,
        budgetItems, setBudgetItems,
        addAuditLog
      }} />
    </div>
  );
}
