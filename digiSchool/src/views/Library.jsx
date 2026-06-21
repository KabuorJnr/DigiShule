import { useState, useMemo, useEffect } from 'react';
import { PageHeader, KpiCard, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { Icon } from '../components/icons';
import { fetchTable, upsertRow, deleteRow } from '../lib/api';

export default function Library({ store }) {
  const { notify } = store;
  const [tab, setTab] = useState('catalog');
  const [books, setBooks] = useState([]);
  const [loans, setLoans] = useState([]);
  const [search, setSearch] = useState('');
  const [issueOpen, setIssueOpen] = useState(false);
  const [Grade, setForm] = useState({ book: '', student: '', adm: '', due: '' });

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

  const filtered = books.filter(
    (b) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase())
  );

  const issueBook = async () => {
    if (!Grade.book || !Grade.student || !Grade.adm) {
      notify('Book, student and admission no. are required.', 'error');
      return;
    }
    const bk = books.find((b) => b.id === Grade.book);
    if (!bk || bk.available <= 0) {
      notify('No available copies of this title.', 'error');
      return;
    }
    const updatedBook = { ...bk, available: bk.available - 1 };
    const loan = {
      id: `l${Date.now()}`,
      book: bk.title,
      student: Grade.student,
      adm: Grade.adm,
      borrowed: new Date().toISOString().slice(0, 10),
      due: Grade.due || '2026-06-30',
      status: 'Borrowed',
    };
    try {
      await upsertRow('libraryBooks', updatedBook);
      await upsertRow('libraryLoans', loan);
    } catch (e) {
      notify(`Could not issue book: ${e.message}`, 'error');
      return;
    }
    setBooks((bs) => bs.map((b) => (b.id === Grade.book ? updatedBook : b)));
    setLoans((ls) => [loan, ...ls]);
    setIssueOpen(false);
    setForm({ book: '', student: '', adm: '', due: '' });
    notify(`"${bk.title}" issued to ${Grade.student}.`);
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
        title="Library"
        subtitle="Catalog, loans and overdue tracking"
        actions={<button className="btn btn-primary" onClick={() => setIssueOpen(true)}>+ Issue Book</button>}
      />

      <div className="stat-tiles">
        <KpiCard iconComponent={<Icon name="book" size={24} />} label="Titles" value={totals.titles} sub="Catalogued" />
        <KpiCard iconComponent={<Icon name="folder" size={24} />} label="Total Copies" value={totals.copies} sub={`${totals.onLoan} on loan`} />
        <KpiCard iconComponent={<Icon name="activity" size={24} />} label="Active Loans" value={loans.length} accent="#0369A1" />
        <KpiCard iconComponent={<Icon name="clock" size={24} />} label="Overdue" value={totals.overdue} accent="#EF4444" sub="Needs follow-up" />
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab${tab === 'catalog' ? ' active' : ''}`} onClick={() => setTab('catalog')}>Catalog</button>
        <button className={`tab${tab === 'loans' ? ' active' : ''}`} onClick={() => setTab('loans')}>Loans &amp; Overdue</button>
      </div>

      {tab === 'catalog' && (
        <div className="card card-pad">
          <input
            className="input"
            style={{ maxWidth: 320, marginBottom: 14 }}
            placeholder="Search title or author…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
        <Modal title="Issue Book" onClose={() => setIssueOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setIssueOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={issueBook}>Issue</button>
          </>
        }>
          <label className="field-label">Book</label>
          <select className="select" value={Grade.book} onChange={(e) => setForm((f) => ({ ...f, book: e.target.value }))}>
            <option value="">Select a title…</option>
            {books.map((b) => (
              <option key={b.id} value={b.id} disabled={b.available <= 0}>
                {b.title} ({b.available} available)
              </option>
            ))}
          </select>
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="field-label">Student Name</label>
              <input className="input" value={Grade.student} onChange={(e) => setForm((f) => ({ ...f, student: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Admission No.</label>
              <input className="input" value={Grade.adm} onChange={(e) => setForm((f) => ({ ...f, adm: e.target.value }))} />
            </div>
          </div>
          <label className="field-label" style={{ marginTop: 12 }}>Due Date</label>
          <input type="date" className="input" value={Grade.due} onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))} />
        </Modal>
      )}
    </div>
  );
}
