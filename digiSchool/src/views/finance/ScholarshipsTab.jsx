import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { upsertRow } from '../../lib/api';
import { Award, Plus, Search, Trash2, Users, DollarSign } from 'lucide-react';

const PAGE_SIZE = 25;

export default function ScholarshipsTab() {
  const { students, store } = useOutletContext();
  const notify = store?.notify || (() => {});
  const scholarships = store?.scholarships || [];
  const setScholarships = store?.setScholarships || (() => {});

  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [form, setForm] = useState({
    student_id: '',
    sponsor: '',
    amount: '',
    type: 'Partial',
    term: '',
    year: new Date().getFullYear().toString(),
    notes: ''
  });

  // Enrich with student data
  const enriched = useMemo(() => {
    return scholarships.map(s => ({
      ...s,
      student: students.find(st => st.id === s.student_id)
    }));
  }, [scholarships, students]);

  // Filter
  const filtered = useMemo(() => {
    let list = [...enriched];
    if (typeFilter !== 'All') list = list.filter(s => s.type === typeFilter);
    if (statusFilter !== 'All') list = list.filter(s => s.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.student?.name?.toLowerCase().includes(q) ||
        s.sponsor?.toLowerCase().includes(q) ||
        s.student?.adm_no?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }, [enriched, typeFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Stats
  const totalDisbursed = scholarships.filter(s => s.status === 'Active').reduce((sum, s) => sum + Number(s.amount), 0);
  const studentsSupported = new Set(scholarships.filter(s => s.status === 'Active').map(s => s.student_id)).size;
  const sponsorCount = new Set(scholarships.filter(s => s.status === 'Active').map(s => s.sponsor)).size;
  const activeCount = scholarships.filter(s => s.status === 'Active').length;

  const handleCreate = async () => {
    if (!form.student_id || !form.amount || !form.sponsor) {
      notify('Student, sponsor, and amount are required.', 'error');
      return;
    }

    const scholarship = {
      id: `sch_${Date.now()}`,
      student_id: form.student_id,
      sponsor: form.sponsor,
      amount: Number(form.amount),
      type: form.type,
      term: form.term,
      year: form.year,
      notes: form.notes,
      status: 'Active',
      created_at: new Date().toISOString()
    };

    const updated = [scholarship, ...scholarships];
    setScholarships(updated);
    setModalOpen(false);
    setForm({ student_id: '', sponsor: '', amount: '', type: 'Partial', term: '', year: new Date().getFullYear().toString(), notes: '' });
    notify('Scholarship record added.', 'success');

    try {
      await upsertRow('scholarships', scholarship);
    } catch (e) {
      console.warn('Could not persist scholarship:', e.message);
    }
  };

  const handleToggleStatus = async (id) => {
    const updated = scholarships.map(s => {
      if (s.id === id) {
        return { ...s, status: s.status === 'Active' ? 'Expired' : 'Active' };
      }
      return s;
    });
    setScholarships(updated);
    notify('Status updated.', 'info');
  };

  const handleDelete = (id) => {
    if (!confirm('Remove this scholarship record?')) return;
    setScholarships(scholarships.filter(s => s.id !== id));
    notify('Scholarship record removed.', 'info');
  };

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #8B5CF6' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Aid Disbursed</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 8, color: '#8B5CF6' }}>{fmtKES(totalDisbursed)}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #3B82F6' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Students Supported</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>{studentsSupported}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #10B981' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sponsors</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>{sponsorCount}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #F59E0B' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Scholarships</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>{activeCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="field-label">Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="input" placeholder="Search by student, sponsor..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} style={{ paddingLeft: 36 }} />
            </div>
          </div>
          <div>
            <label className="field-label">Type</label>
            <select className="select" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }}>
              <option value="All">All Types</option>
              <option value="Full">Full Scholarship</option>
              <option value="Partial">Partial Scholarship</option>
              <option value="Bursary">Bursary</option>
            </select>
          </div>
          <div>
            <label className="field-label">Status</label>
            <select className="select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}>
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Add Scholarship
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={20} /> Scholarship Records
          </div>
          <div className="muted" style={{ fontSize: 13 }}>{filtered.length} records</div>
        </div>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Sponsor</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Year / Term</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                  No scholarship records found. Click "Add Scholarship" to create one.
                </td></tr>
              )}
              {pageData.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.student?.name || s.student_id}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{s.student?.adm_no} · {s.student?.class}</div>
                  </td>
                  <td style={{ fontWeight: 500 }}>{s.sponsor}</td>
                  <td>
                    <Badge color={s.type === 'Full' ? 'green' : s.type === 'Bursary' ? 'blue' : 'amber'}>{s.type}</Badge>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtKES(s.amount)}</td>
                  <td className="muted">{s.year}{s.term ? ` / ${s.term}` : ''}</td>
                  <td>
                    <Badge color={s.status === 'Active' ? 'green' : 'gray'}>{s.status}</Badge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => handleToggleStatus(s.id)}>
                        {s.status === 'Active' ? 'Expire' : 'Activate'}
                      </button>
                      <button className="btn btn-sm" onClick={() => handleDelete(s.id)} style={{ color: '#EF4444', borderColor: '#fca5a5', padding: '4px 8px' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Previous</button>
            <span className="muted" style={{ fontSize: 13 }}>Page {page + 1} of {totalPages}</span>
            <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {modalOpen && (
        <Modal title="Add Scholarship / Bursary" onClose={() => setModalOpen(false)} footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate}>Save Scholarship</button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="field-label">Student *</label>
              <select className="select" value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
                <option value="">-- Select Student --</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.adm_no})</option>)}
              </select>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Sponsor *</label>
                <input className="input" placeholder="e.g. CDF, Equity Wings to Fly" value={form.sponsor} onChange={e => setForm(f => ({ ...f, sponsor: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Amount (KES) *</label>
                <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Type</label>
                <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option>Full</option>
                  <option>Partial</option>
                  <option>Bursary</option>
                </select>
              </div>
              <div>
                <label className="field-label">Year</label>
                <input className="input" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="field-label">Term (optional)</label>
              <select className="select" value={form.term} onChange={e => setForm(f => ({ ...f, term: e.target.value }))}>
                <option value="">All Terms</option>
                <option>Term 1</option>
                <option>Term 2</option>
                <option>Term 3</option>
              </select>
            </div>
            <div>
              <label className="field-label">Notes</label>
              <input className="input" placeholder="Additional notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
