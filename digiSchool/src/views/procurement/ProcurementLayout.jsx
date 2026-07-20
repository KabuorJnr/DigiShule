import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/widgets';
import { fetchTable } from '../../lib/api';
import { FileText, ShoppingCart, Truck } from 'lucide-react';

const TABS = [
  { id: 'procurement_dashboard', label: 'Dashboard', icon: ShoppingCart },
  { id: 'tenders_manager', label: 'Tenders & Bids', icon: FileText },
  { id: 'purchase_orders', label: 'Purchase Orders', icon: Truck },
];

export default function ProcurementLayout() {
  const { store, user, params } = useOutletContext();
  const location = useLocation();
  const navigate = useNavigate();

  const [auditLogs, setAuditLogs] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [tenders, setTenders] = useState([]);

  useEffect(() => {
    if (params?.tab) {
      const targetPath = params.tab === 'procurement_dashboard' ? '/portal/procurement' : `/portal/procurement/${params.tab}`;
      if (location.pathname !== targetPath && location.pathname !== targetPath + '/') {
        navigate(targetPath, { replace: true });
      }
    }
  }, [params?.tab, location.pathname, navigate]);

  useEffect(() => {
    Promise.all([
      fetchTable('finance_audit_log').catch(() => []),
      fetchTable('purchase_orders').catch(() => []),
      fetchTable('tenders').catch(() => [])
    ]).then(([logs, pos, tnds]) => {
      setAuditLogs(logs || []);
      setPurchaseOrders(pos || []);
      setTenders(tnds || []);
    });
  }, []);

  const addAuditLog = useCallback((action, details, amount) => {
    const log = {
      id: `audit_proc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action,
      details,
      amount: amount ? Number(amount) : null,
      user_name: user?.name || 'System',
      timestamp: new Date().toISOString()
    };
    setAuditLogs(prev => [log, ...prev]);

    import('../../lib/api').then(({ upsertRow }) => {
      upsertRow('finance_audit_log', log).catch(() => {});
    });
  }, [user?.name]);

  const isDashboard = !params?.tab;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {!isDashboard && (
        <>
          <PageHeader
            title="Procurement & Tenders"
            subtitle="Manage purchase orders, active tenders, and external contractors."
          />
        </>
      )}

      <Outlet context={{ 
        store: { ...store, addAuditLog, auditLogs, setAuditLogs, purchaseOrders, setPurchaseOrders, tenders, setTenders },
        user, params, 
        auditLogs, setAuditLogs,
        purchaseOrders, setPurchaseOrders,
        tenders, setTenders,
        addAuditLog
      }} />
    </div>
  );
}
