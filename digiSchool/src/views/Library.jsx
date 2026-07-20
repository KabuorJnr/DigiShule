import { useState, useMemo, useEffect } from 'react';
import { PageHeader, KpiCard, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { Icon } from '../components/icons';
import { fetchTable, upsertRow, deleteRow } from '../lib/api';

export default function Library({ store, user }) {
  const { notify } = store;
  const [tab, setTab] = useState('catalog');
  const [books, setBooks] = useState([]);
  const [loans, setLoans] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  const [issueOpen, setIssueOpen] = useState(false);
  const [form, setForm] = useState({ book: '', student_adm: '', due: '' });

  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [assetForm, setAssetForm] = useState({ title: '', author: '', isbn: '', category: 'Book', copies: 1, file_url: '' });

  useEffect(() => {
    Promise.all([fetchTable('libraryBooks'), fetchTable('libraryLoans')])
      .then(([bks, lns]) => {
        setBooks(bks.sort((a, b) => a.title.localeCompare(b.title)));
        setLoans(lns.sort((a, b) => String(b.borrowed).localeCompare(String(a.borrowed))));
      })
      .catch((e) => notify(`Failed to load library data: ${e.message}`, 'error'));
  }, [notify]);

  const totals = useMemo(() => {
    const copies = books.reduce((s, b) => s + b.copies, 0);
    const available = books.reduce((s, b) => s + b.available, 0);
    const overdue = loans.filter((l) => l.status === 'Overdue').length;
    return { titles: books.length, copies, onLoan: copies - available, overdue };
  }, [books, loans]);

  const regularBooks = books.filter(b => !b.is_digital && b.category !== 'Past Paper');
  const pastPapers = books.filter(b => b.is_digital || b.category === 'Past Paper');

  const filtered = regularBooks.filter((b) => {
    const matchesSearch = b.title.toLowerCase().includes(search.toLowerCase()) || (b.author && b.author.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = categoryFilter === 'All' || b.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredPapers = pastPapers.filter((b) => {
    return b.title.toLowerCase().includes(search.toLowerCase());
  });

  const categories = ['All', ...new Set(regularBooks.map(b => b.category))];

  const issueBook = async () => {
    if (!form.book || !form.student_adm) {
      notify('Book and Student Admission Number are required.', 'error');
      return;
    }
    const { fetchStudentByQuery } = await import('../lib/api');
    const student = await fetchStudentByQuery('adm', form.student_adm);
    if (!student) {
      notify(`Student with Adm No. ${form.student_adm} not found.`, 'error');
      return;
    }

    const bk = books.find((b) => b.id === form.book);
    if (!bk || bk.available <= 0) {
      notify('No available copies of this title.', 'error');
      return;
    }
    const updatedBook = { ...bk, available: bk.available - 1 };
    const loan = {
      id: `l${Date.now()}`,
      book: bk.title,
      student: student.name,
      adm: student.adm_no,
      student_id: student.id,
      borrowed: new Date().toISOString().slice(0, 10),
      due: form.due || '2026-06-30',
      status: 'Borrowed',
    };
    try {
      await upsertRow('libraryBooks', updatedBook);
      await upsertRow('libraryLoans', loan);
    } catch (e) {
      notify(`Could not issue item: ${e.message}`, 'error');
      return;
    }
    setBooks((bs) => bs.map((b) => (b.id === form.book ? updatedBook : b)));
    setLoans((ls) => [loan, ...ls]);
    setIssueOpen(false);
    setForm({ book: '', student_id: '', due: '' });
    notify(`"${bk.title}" issued to ${student.name}.`);
  };

  const addAsset = async () => {
    if (!assetForm.title) return notify('Title/Name is required', 'error');
    const newAsset = {
      id: `b${Date.now()}`,
      title: assetForm.title,
      author: assetForm.author || 'N/A',
      isbn: assetForm.isbn || 'N/A',
      category: assetForm.category,
      copies: assetForm.category === 'Past Paper' ? 0 : Number(assetForm.copies),
      available: assetForm.category === 'Past Paper' ? 0 : Number(assetForm.copies),
      is_digital: assetForm.category === 'Past Paper',
      file_url: assetForm.category === 'Past Paper' ? assetForm.file_url : null
    };
    try {
      await upsertRow('libraryBooks', newAsset);
      setBooks(prev => [...prev, newAsset].sort((a, b) => a.title.localeCompare(b.title)));
      setAddAssetOpen(false);
      setAssetForm({ title: '', author: '', isbn: '', category: 'Book', copies: 1 });
      notify(`${newAsset.title} added to catalog successfully.`);
    } catch (e) {
      notify(`Failed to add asset: ${e.message}`, 'error');
    }
  };

  const returnLoan = async (loan) => {
    const bk = books.find((b) => b.title === loan.book);
    const updatedBook = bk ? { ...bk, available: Math.min(bk.copies, bk.available + 1) } : null;
    try {
      await deleteRow('libraryLoans', loan.id);
      if (updatedBook) await upsertRow('libraryBooks', updatedBook);
    } catch (e) {
      notify(`Could not record return: ${e.message}`, 'error');
      return;
    }
    setLoans((ls) => ls.filter((l) => l.id !== loan.id));
    if (updatedBook) setBooks((bs) => bs.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
    notify(`"${loan.book}" returned by ${loan.student}.`, 'info', 'Returned');
  };

  return (
    <div>
      <PageHeader
        title="Library & Asset Management"
        subtitle="Catalog, IT assets, loans and overdue tracking"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setAddAssetOpen(true)}>+ Add Asset</button>
            <button className="btn btn-primary" onClick={() => setIssueOpen(true)}>+ Issue Item</button>
          </div>
        }
      />

      <div className="stat-tiles">
        <KpiCard iconComponent={<Icon name="book" size={24} />} label="Titles" value={totals.titles} sub="Catalogued" />
        <KpiCard iconComponent={<Icon name="folder" size={24} />} label="Total Copies" value={totals.copies} sub={`${totals.onLoan} on loan`} />
        <KpiCard iconComponent={<Icon name="activity" size={24} />} label="Active Loans" value={loans.length} accent="#0369A1" />
        <KpiCard iconComponent={<Icon name="clock" size={24} />} label="Overdue" value={totals.overdue} accent="#EF4444" sub="Needs follow-up" />
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab${tab === 'catalog' ? ' active' : ''}`} onClick={() => setTab('catalog')}>Catalog</button>
        <button className={`tab${tab === 'past_papers' ? ' active' : ''}`} onClick={() => setTab('past_papers')}>Past Papers</button>
        {user?.role !== 'student' && user?.role !== 'parent' && (
          <button className={`tab${tab === 'loans' ? ' active' : ''}`} onClick={() => setTab('loans')}>Loans &amp; Overdue</button>
        )}
      </div>

      {tab === 'catalog' && (
        <div className="card card-pad">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <input
              className="input"
              style={{ maxWidth: 320 }}
              placeholder="Search title or authorâ€¦"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="select" style={{ maxWidth: 200 }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th><th>Author</th><th>ISBN</th><th>Category</th>
                  <th>Copies</th><th>Available</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>{b.title}</td>
                    <td>{b.author}</td>
                    <td className="muted">{b.isbn}</td>
                    <td><Badge color="gray">{b.category}</Badge></td>
                    <td>{b.copies}</td>
                    <td>{b.available}</td>
                    <td>
                      {b.available === 0 ? <Badge color="red">Out</Badge>
                        : b.available < 10 ? <Badge color="amber">Low</Badge>
                        : <Badge color="green">In stock</Badge>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>No titles match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'past_papers' && (
        <div className="card card-pad">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <input
              className="input"
              style={{ maxWidth: 320 }}
              placeholder="Search past papersâ€¦"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-3">
            {filteredPapers.map((p) => (
              <div key={p.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 600 }}>{p.title}</h4>
                  {p.author && p.author !== 'N/A' && <p className="muted" style={{ margin: '4px 0 0 0', fontSize: 13 }}>{p.author}</p>}
                </div>
                <div style={{ marginTop: 'auto' }}>
                  {p.file_url ? (
                    <a href={p.file_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary" style={{ display: 'inline-block', width: '100%', textAlign: 'center' }}>
                      View / Download PDF
                    </a>
                  ) : (
                    <span className="muted" style={{ fontSize: 13 }}>No link provided</span>
                  )}
                </div>
              </div>
            ))}
            {filteredPapers.length === 0 && (
              <div className="muted" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 24 }}>No past papers available.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'loans' && (
        <div className="card card-pad">
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Book</th><th>Student</th><th>Adm. No.</th>
                  <th>Borrowed</th><th>Due</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id} style={l.status === 'Overdue' ? { background: '#fef2f2' } : undefined}>
                    <td style={{ fontWeight: 600 }}>{l.book}</td>
                    <td>{l.student}</td>
                    <td className="muted">{l.adm}</td>
                    <td>{l.borrowed}</td>
                    <td>{l.due}</td>
                    <td><Badge color={l.status === 'Overdue' ? 'red' : 'blue'}>{l.status}</Badge></td>
                    <td><button className="btn btn-sm" onClick={() => returnLoan(l)}>Return</button></td>
                  </tr>
                ))}
                {loans.length === 0 && (
                  <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>No active loans.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {issueOpen && (
        <Modal title="Issue Item" onClose={() => setIssueOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setIssueOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={issueBook}>Issue</button>
          </>
        }>
          <label className="field-label">Asset / Book</label>
          <select className="select" value={form.book} onChange={(e) => setForm((f) => ({ ...f, book: e.target.value }))}>
            <option value="">Select an itemâ€¦</option>
            {books.map((b) => (
              <option key={b.id} value={b.id} disabled={b.available <= 0}>
                {b.title} ({b.available} available)
              </option>
            ))}
          </select>
          
          <label className="field-label" style={{ marginTop: 12 }}>Student Admission No.</label>
          <input className="input" placeholder="e.g. 26/1234" value={form.student_adm} onChange={(e) => setForm((f) => ({ ...f, student_adm: e.target.value }))} />

          <label className="field-label" style={{ marginTop: 12 }}>Due Date</label>
          <input type="date" className="input" value={form.due} onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))} />
        </Modal>
      )}

      {addAssetOpen && (
        <Modal title="Add to Catalog" onClose={() => setAddAssetOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setAddAssetOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={addAsset}>Add Item</button>
          </>
        }>
          <div className="grid grid-2">
            <div>
              <label className="field-label">Title / Name *</label>
              <input className="input" placeholder="E.g. ThinkPad T14 or Physics Vol 2" value={assetForm.title} onChange={e => setAssetForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Category</label>
              <select className="select" value={assetForm.category} onChange={e => setAssetForm(f => ({ ...f, category: e.target.value }))}>
                <option>Book</option>
                <option>Laptop</option>
                <option>Tablet</option>
                <option>Equipment</option>
                <option>Past Paper</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          {assetForm.category === 'Past Paper' ? (
            <div style={{ marginTop: 12 }}>
              <label className="field-label">File URL / Link</label>
              <input className="input" placeholder="e.g. https://example.com/paper.pdf" value={assetForm.file_url || ''} onChange={e => setAssetForm(f => ({ ...f, file_url: e.target.value }))} />
            </div>
          ) : (
            <div className="grid grid-2" style={{ marginTop: 12 }}>
              <div>
                <label className="field-label">Author / Manufacturer</label>
                <input className="input" placeholder="E.g. Lenovo" value={assetForm.author} onChange={e => setAssetForm(f => ({ ...f, author: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Total Copies</label>
                <input type="number" min="1" className="input" value={assetForm.copies} onChange={e => setAssetForm(f => ({ ...f, copies: e.target.value }))} />
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}



