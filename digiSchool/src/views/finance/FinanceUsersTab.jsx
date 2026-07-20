import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { Shield, ShieldAlert, Key } from 'lucide-react';

export default function FinanceUsersTab() {
  const { store } = useOutletContext();
  const notify = store?.notify || (() => {});

  const [users, setUsers] = useState([
    { id: 'usr_1', name: 'John Doe', role: 'Bursar', status: 'Active', limits: 'Unlimited', last_login: '2026-07-19 08:30 AM' },
    { id: 'usr_2', name: 'Jane Smith', role: 'Accountant', status: 'Active', limits: 'Up to KES 100,000', last_login: '2026-07-19 09:15 AM' },
    { id: 'usr_3', name: 'Michael Brown', role: 'Accounts Clerk', status: 'Suspended', limits: 'Up to KES 10,000', last_login: '2026-06-15 14:20 PM' },
  ]);

  const [modalOpen, setModalOpen] = useState(false);

  const handleToggleStatus = (id) => {
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const newStatus = u.status === 'Active' ? 'Suspended' : 'Active';
        notify(`User ${u.name} is now ${newStatus}`, newStatus === 'Active' ? 'success' : 'warning');
        return { ...u, status: newStatus };
      }
      return u;
    }));
  };

  return (
    <div>
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={20} color="#047857" />
            Finance Team Permissions
          </div>
          <button className="btn btn-primary" onClick={() => notify('Add user modal would open here')}>Add Finance User</button>
        </div>
        
        <div style={{ background: '#EFF6FF', color: '#1E40AF', padding: 12, borderRadius: 6, fontSize: 13, display: 'flex', gap: 8, marginBottom: 24 }}>
          <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Security Notice:</strong> Users with the "Bursar" role have unrestricted access to approve payrolls, budgets, and large payments. Ensure dual-approval logic is configured for high-value transactions.
          </div>
        </div>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Approval Limits</th>
                <th>Last Login</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>
                    <Badge color={u.role === 'Bursar' ? 'blue' : 'gray'}>{u.role}</Badge>
                  </td>
                  <td className="muted">{u.limits}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{u.last_login}</td>
                  <td>
                    <Badge color={u.status === 'Active' ? 'green' : 'red'}>{u.status}</Badge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => notify('Edit limits functionality')}>Edit Limits</button>
                      <button 
                        className="btn btn-sm" 
                        style={{ color: u.status === 'Active' ? '#EF4444' : '#047857' }} 
                        onClick={() => handleToggleStatus(u.id)}
                      >
                        {u.status === 'Active' ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



