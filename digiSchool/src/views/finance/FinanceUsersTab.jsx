import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { Shield, ShieldAlert, Key } from 'lucide-react';

export default function FinanceUsersTab() {
  const { store } = useOutletContext();
  const notify = store?.notify || (() => {});
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'Accountant' });

  useEffect(() => {
    // Fetch finance staff from DB
    import('../../lib/api').then(({ fetchTable }) => {
      fetchTable('staff').then(data => {
        if (data) {
          setUsers(data.filter(u => u.dept === 'Finance' || u.role === 'Bursar' || u.role === 'Accountant' || u.role === 'finance'));
        }
      }).catch(err => {
        console.warn('Failed to fetch finance staff', err);
      });
    });
  }, []);

  const handleToggleStatus = (id) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    const newStatus = user.status === 'Active' ? 'Suspended' : 'Active';
    import('../../lib/api').then(({ updateRow }) => {
      updateRow('staff', id, { status: newStatus }).then(() => {
        setUsers(prev => prev.map(u => (u.id === id ? { ...u, status: newStatus } : u)));
        notify(`User ${user.name} is now ${newStatus}`, newStatus === 'Active' ? 'success' : 'warning');
      }).catch(err => notify(`Failed to update status: ${err.message}`, 'error'));
    });
  };

  const handleAddUser = async () => {
    if (!form.name || !form.email) return notify('Name and Email are required', 'warning');
    setSaving(true);
    try {
      const { upsertRow } = await import('../../lib/api');
      const newUser = {
        id: `fin_${Date.now()}`,
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role,
        dept: 'Finance',
        status: 'Pending',
        pin: Math.floor(100000 + Math.random() * 900000).toString(),
        created_at: new Date().toISOString()
      };
      await upsertRow('staff', newUser);
      setUsers(prev => [...prev, newUser]);
      notify(`Added ${form.name} as ${form.role}. Activation PIN: ${newUser.pin}`, 'success');
      setModalOpen(false);
      setForm({ name: '', email: '', phone: '', role: 'Accountant' });
    } catch (e) {
      notify(`Failed to add user: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={20} color="#047857" />
            Finance Team Permissions
          </div>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>Add Finance User</button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Finance User">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Jane Smith" />
          </div>
          <div>
            <label className="label">Email Address</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="jane@example.com" />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="e.g. 0712345678" />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="select" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              <option value="Accountant">Accountant</option>
              <option value="Bursar">Bursar</option>
              <option value="Accounts Clerk">Accounts Clerk</option>
            </select>
          </div>
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, fontSize: 13, color: '#475569' }}>
            When added, the user will need to sign up using the Staff Signup Wizard with the PIN provided.
          </div>
          <button className="btn btn-primary" onClick={handleAddUser} disabled={saving} style={{ marginTop: 8 }}>
            {saving ? 'Adding...' : 'Add User'}
          </button>
        </div>
      </Modal>
    </div>
  );
}



