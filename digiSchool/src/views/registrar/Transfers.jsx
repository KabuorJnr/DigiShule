import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { fetchStudents, upsertStudent } from '../../lib/api';
import Modal from '../../components/Modal';
import { Badge } from '../../components/widgets';

export default function Transfers() {
  const { store } = useOutletContext();
  const { notify } = store;
  const queryClient = useQueryClient();

  const [transferModal, setTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ studentId: '', type: 'Transfer Out', reason: '', date: '' });
  
  // Note: we fetch page 0 up to 1000 items here just for the dropdown. 
  // In a real huge dataset, we'd need a searchable autocomplete instead of a raw select.
  const { data } = useQuery({
    queryKey: ['students-for-transfers'],
    queryFn: () => fetchStudents(0, 1000, {}),
  });
  
  const localStudents = data?.data || [];

  // Mocked state for transfers history for now (per original implementation)
  const [transfers, setTransfers] = useState([]);

  const transferMutation = useMutation({
    mutationFn: (updatedStudent) => upsertStudent(updatedStudent),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['students']);
      queryClient.invalidateQueries(['students-for-transfers']);
      
      const studentName = localStudents.find(s => s.id === variables.id)?.name || 'Unknown';
      const record = { ...transferForm, studentName, id: `tr${Date.now()}` };
      setTransfers(prev => [record, ...prev]);
      
      setTransferModal(false);
      setTransferForm({ studentId: '', type: 'Transfer Out', reason: '', date: '' });
      notify(`Transfer record saved and ${studentName} marked as ${variables.status}`, 'success', 'Registrar');
    },
    onError: (e) => notify(`Transfer failed: ${e.message}`, 'error')
  });

  const handleTransfer = () => {
    if (!transferForm.studentId || !transferForm.reason || !transferForm.date) {
      notify('All fields are required', 'warning'); return;
    }
    const student = localStudents.find(s => s.id === transferForm.studentId);
    if (!student) return;

    const newStatus = transferForm.type === 'Completed (Graduated)' ? 'Graduated' : 'Inactive';
    transferMutation.mutate({ ...student, status: newStatus });
  };

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <button className="btn btn-primary" style={{ gap: 6 }} onClick={() => setTransferModal(true)}>
          <FileText size={15} /> Record Transfer / Exit
        </button>
      </div>
      
      <div className="card card-pad">
        <h3 className="section-title">Transfer & Exit Records ({transfers.length})</h3>
        {transfers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <FileText size={32} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
            <div className="muted">No transfer records yet</div>
          </div>
        ) : (
          <table className="table">
            <thead><tr><th>Student</th><th>Type</th><th>Reason</th><th>Date</th></tr></thead>
            <tbody>
              {transfers.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.studentName}</td>
                  <td><Badge color={t.type === 'Transfer Out' ? 'amber' : 'red'}>{t.type}</Badge></td>
                  <td className="muted">{t.reason}</td>
                  <td className="muted">{t.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {transferModal && (
        <Modal title="Record Transfer / Exit" onClose={() => setTransferModal(false)} footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setTransferModal(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={transferMutation.isLoading} onClick={handleTransfer}>
              {transferMutation.isLoading ? 'Saving...' : 'Save Record'}
            </button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">Student</label>
              <select className="select" value={transferForm.studentId} onChange={e => setTransferForm(f => ({ ...f, studentId: e.target.value }))}>
                <option value="">Select studentâ€¦</option>
                {localStudents.filter(s => s.status !== 'Inactive' && s.status !== 'Graduated').map(s => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}
              </select>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Type</label>
                <select className="select" value={transferForm.type} onChange={e => setTransferForm(f => ({ ...f, type: e.target.value }))}>
                  <option>Transfer Out</option>
                  <option>Withdrawal</option>
                  <option>Expelled</option>
                  <option>Completed (Graduated)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Date</label>
                <input type="date" className="input" value={transferForm.date} onChange={e => setTransferForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="field-label">Reason</label>
              <textarea className="input" rows={3} value={transferForm.reason} onChange={e => setTransferForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}



