/**
 * Finance dashboard — Sneat design system.
 *
 * THE METRIC THIS DASHBOARD IS ACCOUNTABLE TO: fee collection rate.
 * Everything else on the page exists to explain that number — what was billed,
 * what came in, what is still owed, which classes are lagging, and where money
 * is going out. The <Spotlight> states it against the school's target; the
 * tiles and charts decompose it.
 *
 * All computation below is unchanged from the previous version; only the
 * presentation layer was rebuilt.
 */

import { useState, useMemo, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Filter, Calendar, Users, Briefcase, TrendingUp, TrendingDown,
  Plus, AlertTriangle, ArrowUpRight, Wallet, Receipt,
} from 'lucide-react';
import { fmtKES } from '../../data/modules';
import ExportMenu from './dashboard/ExportMenu';
import { getTargets } from '../../lib/targets';
import {
  SneatPage, Grid, Card, CardHead, CardBody, MetricCard, Spotlight,
  ChartCard, SnBar, SnArea, SnDonut, TableCard, RankList,
  SnBadge, SnButton, SnEmpty, SNEAT,
} from '../../components/sneat';

export default function FinanceDashboardTab() {
  const { invoices = [], payments = [], expenses = [], students = [], store } = useOutletContext();
  const navigate = useNavigate();

  const [termFilter, setTermFilter] = useState('All');
  const [classFilter, setClassFilter] = useState('All');
  const dashboardRef = useRef(null);

  const classOptions = useMemo(() => {
    const classes = new Set(students.map((s) => s.class));
    return ['All', ...Array.from(classes).filter(Boolean).sort()];
  }, [students]);

  // ── filtering ────────────────────────────────────────────────────────────
  const getTermFromDate = (dateString) => {
    if (!dateString) return 'Term 1';
    const month = new Date(dateString).getMonth() + 1;
    if (month <= 4) return 'Term 1';
    if (month <= 8) return 'Term 2';
    return 'Term 3';
  };

  const filteredInvoices = useMemo(() => invoices.filter((i) => {
    if (termFilter !== 'All' && getTermFromDate(i.issue_date || i.created_at) !== termFilter) return false;
    if (classFilter !== 'All') {
      const student = students.find((s) => s.id === i.student_id);
      if (!student || student.class !== classFilter) return false;
    }
    return true;
  }), [invoices, students, termFilter, classFilter]);

  const filteredPayments = useMemo(() => payments.filter((p) => {
    if (termFilter !== 'All' && getTermFromDate(p.date || p.created_at) !== termFilter) return false;
    if (classFilter !== 'All') {
      const student = students.find((s) => s.id === p.student_id);
      if (!student || student.class !== classFilter) return false;
    }
    return true;
  }), [payments, students, termFilter, classFilter]);

  const filteredExpenses = useMemo(() => expenses.filter((e) => {
    if (e.status !== 'Approved') return false;
    if (termFilter !== 'All' && getTermFromDate(e.date || e.created_at) !== termFilter) return false;
    return true;
  }), [expenses, termFilter]);

  // ── the headline metric and its parts ────────────────────────────────────
  const totalInvoiced = filteredInvoices.reduce((a, i) => a + Number(i.amount || 0), 0);
  const totalCollected = filteredPayments.reduce((a, p) => a + Number(p.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((a, e) => a + Number(e.amount || 0), 0);

  const expectedRevenue = useMemo(() => {
    if (totalInvoiced > 0) return totalInvoiced;
    const termFee = Number(store?.settings?.termFee || store?.settings?.term_fee || 25000);
    return Math.max(totalCollected, (students.length || 0) * termFee);
  }, [totalInvoiced, store?.settings, students.length, totalCollected]);

  const totalOutstanding = Math.max(0, expectedRevenue - totalCollected);
  const cashFlow = totalCollected - totalExpenses;
  const collectionRate = expectedRevenue > 0
    ? Math.min(100, (totalCollected / expectedRevenue) * 100)
    : 0;

  // The target the rate is judged against — set in Settings → Targets.
  const targetRate = getTargets(store?.settings).feeCollectionRate;

  const defaulterCount = useMemo(() => {
    const paidBy = new Set(filteredPayments.map((p) => p.student_id));
    const pool = classFilter === 'All' ? students : students.filter((s) => s.class === classFilter);
    return pool.filter((s) => !paidBy.has(s.id)).length;
  }, [filteredPayments, students, classFilter]);

  // ── chart data ───────────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const timeline = {};
    const bucket = (m) => (timeline[m] ||= { month: m, Income: 0, Expenses: 0, Target: 0 });
    filteredPayments.forEach((p) => {
      const m = p.date?.substring(0, 7) || new Date(p.created_at || Date.now()).toISOString().substring(0, 7);
      bucket(m).Income += Number(p.amount || 0);
    });
    filteredExpenses.forEach((e) => {
      const m = e.date?.substring(0, 7) || new Date(e.created_at || Date.now()).toISOString().substring(0, 7);
      bucket(m).Expenses += Number(e.amount || 0);
    });
    filteredInvoices.forEach((i) => {
      const m = i.issue_date?.substring(0, 7) || new Date(i.created_at || Date.now()).toISOString().substring(0, 7);
      bucket(m).Target += Number(i.amount || 0);
    });
    const cur = new Date().toISOString().substring(0, 7);
    if (!timeline[cur]) timeline[cur] = { month: cur, Income: totalCollected, Expenses: totalExpenses, Target: expectedRevenue };
    return Object.values(timeline).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [filteredPayments, filteredExpenses, filteredInvoices, totalCollected, totalExpenses, expectedRevenue]);

  /** Per-class collection against what that class was billed. */
  const classCollection = useMemo(() => {
    const rows = {};
    const termFee = Number(store?.settings?.termFee || store?.settings?.term_fee || 25000);
    students.forEach((s) => {
      if (classFilter !== 'All' && s.class !== classFilter) return;
      const k = s.class || 'Unassigned';
      rows[k] ||= { name: k, collected: 0, billed: 0, students: 0 };
      rows[k].students += 1;
      const billed = filteredInvoices
        .filter((i) => i.student_id === s.id)
        .reduce((a, i) => a + Number(i.amount || 0), 0);
      rows[k].billed += billed > 0 ? billed : termFee;
    });
    filteredPayments.forEach((p) => {
      const s = students.find((x) => x.id === p.student_id);
      const k = s?.class || 'Unassigned';
      rows[k] ||= { name: k, collected: 0, billed: 0, students: 0 };
      rows[k].collected += Number(p.amount || 0);
    });
    return Object.values(rows)
      .map((r) => ({ ...r, pct: r.billed > 0 ? Math.min(100, (r.collected / r.billed) * 100) : 0 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);
  }, [students, filteredPayments, filteredInvoices, classFilter, store?.settings]);

  const expenseBreakdown = useMemo(() => {
    const cats = {};
    filteredExpenses.forEach((e) => {
      const c = e.category || 'General Operations';
      cats[c] = (cats[c] || 0) + Number(e.amount || 0);
    });
    return Object.entries(cats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const recentPayments = useMemo(() => [...filteredPayments]
    .sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0))
    .slice(0, 6), [filteredPayments]);

  const scopeLabel = [
    termFilter === 'All' ? 'All terms' : termFilter,
    classFilter === 'All' ? 'all classes' : classFilter,
  ].join(' · ');

  return (
    <SneatPage
      flush
      title="Finance"
      subtitle={`Fee collection performance — ${scopeLabel}`}
      actions={
        <>
          <SnButton variant="primary" onClick={() => navigate('/portal/finance/payments')}>
            <Plus size={15} /> Record payment
          </SnButton>
          <SnButton variant="outline" onClick={() => navigate('/portal/finance/expenses')}>
            <TrendingDown size={15} /> Log expense
          </SnButton>
          <SnButton variant="ghost" onClick={() => navigate('/portal/finance/defaulters')}>
            <AlertTriangle size={15} /> Defaulters
          </SnButton>
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
        </>
      }
    >
      {/* Slicers */}
      <Card>
        <CardBody style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="sn-strong" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Filter size={15} /> Filters
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={15} color={SNEAT.primary} />
            <select className="select" value={termFilter} onChange={(e) => setTermFilter(e.target.value)}
              style={{ padding: '6px 12px', fontSize: 13, minWidth: 130 }}>
              <option value="All">All Terms</option>
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={15} color={SNEAT.primary} />
            <select className="select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
              style={{ padding: '6px 12px', fontSize: 13, minWidth: 140 }}>
              {classOptions.map((c) => (
                <option key={c} value={c}>{c === 'All' ? 'All Classes' : c}</option>
              ))}
            </select>
          </label>
        </CardBody>
      </Card>

      <div ref={dashboardRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* THE metric */}
        <Spotlight
          eyebrow={`Fee collection rate — ${scopeLabel}`}
          value={`${collectionRate.toFixed(1)}%`}
          caption={
            `${fmtKES(totalCollected)} collected of ${fmtKES(expectedRevenue)} billed. ` +
            `${fmtKES(totalOutstanding)} still outstanding` +
            (defaulterCount ? ` across ${defaulterCount} student${defaulterCount === 1 ? '' : 's'}.` : '.')
          }
          progress={targetRate > 0 ? (collectionRate / targetRate) * 100 : 0}
          target={{ label: 'Target', value: `${targetRate}%` }}
          stats={[
            { label: 'Collected', value: fmtKES(totalCollected) },
            { label: 'Outstanding', value: fmtKES(totalOutstanding) },
            { label: 'Net cash flow', value: fmtKES(cashFlow) },
          ]}
        />

        {/* Its components */}
        <Grid cols={4}>
          <MetricCard
            label="Expected revenue" value={fmtKES(expectedRevenue)}
            icon={<Briefcase />} tone="primary"
            foot={`${filteredInvoices.length || students.length} billed`}
          />
          <MetricCard
            label="Total collected" value={fmtKES(totalCollected)}
            icon={<TrendingUp />} tone="success"
            foot={`${filteredPayments.length} transaction${filteredPayments.length === 1 ? '' : 's'}`}
          />
          <MetricCard
            label="Outstanding" value={fmtKES(totalOutstanding)}
            icon={<AlertTriangle />} tone="warning"
            foot={defaulterCount ? `${defaulterCount} yet to pay` : 'All settled'}
          />
          <MetricCard
            label="Net cash flow" value={fmtKES(cashFlow)}
            icon={<Wallet />} tone={cashFlow >= 0 ? 'success' : 'danger'}
            foot={`${fmtKES(totalExpenses)} expenses`}
          />
        </Grid>

        {/* Explain the number over time and by composition */}
        <Grid cols="8-4">
          <ChartCard
            title="Collections vs expenses"
            subtitle="Monthly, against billed target"
            height={320}
          >
            <SnArea
              data={trendData}
              xKey="month"
              series={[
                { key: 'Target', name: 'Billed', color: SNEAT.secondary },
                { key: 'Income', name: 'Collected', color: SNEAT.primary },
                { key: 'Expenses', name: 'Expenses', color: SNEAT.danger },
              ]}
            />
          </ChartCard>

          <ChartCard title="Collected vs outstanding" subtitle={scopeLabel} height={320} raw>
            <SnDonut
              data={[
                { name: 'Collected', value: totalCollected, color: SNEAT.primary },
                { name: 'Outstanding', value: totalOutstanding, color: SNEAT.warning },
              ]}
              centerValue={`${collectionRate.toFixed(0)}%`}
              centerLabel="collected"
            />
          </ChartCard>
        </Grid>

        {/* Where the number is weakest, and where money leaves */}
        <Grid cols="4-8">
          <Card>
            <CardHead title="Collection by class" subtitle="Percent of billed amount" />
            <CardBody>
              <RankList
                empty={<SnEmpty icon={<Users />} title="No class data"
                  message="Collection by class appears once payments are recorded." />}
                items={classCollection.map((c) => ({
                  id: c.name,
                  title: c.name,
                  sub: `${c.students} student${c.students === 1 ? '' : 's'} · ${fmtKES(c.collected)}`,
                  value: `${c.pct.toFixed(0)}%`,
                  progress: c.pct,
                  tone: c.pct >= 80 ? 'success' : c.pct >= 55 ? 'primary' : c.pct >= 35 ? 'warning' : 'danger',
                }))}
              />
            </CardBody>
          </Card>

          <ChartCard
            title="Expense allocation"
            subtitle="Approved payouts by category"
            height={300}
          >
            {expenseBreakdown.length > 0 ? (
              <SnBar
                data={expenseBreakdown}
                xKey="name"
                series={[{ key: 'value', name: 'Amount', color: SNEAT.danger }]}
              />
            ) : (
              <SnBar data={[{ name: 'No expenses', value: 0 }]} xKey="name" series={[{ key: 'value', name: 'Amount' }]} />
            )}
          </ChartCard>
        </Grid>

        {/* The transactions behind the number */}
        <TableCard
          title="Recent payments"
          subtitle="Latest receipts recorded"
          action={
            <SnButton variant="ghost" onClick={() => navigate('/portal/finance/payments')}>
              View all <ArrowUpRight size={14} />
            </SnButton>
          }
          empty={<SnEmpty icon={<Receipt />} title="No payments yet"
            message="Recorded payments for this term will appear here." />}
          rows={recentPayments}
          rowKey={(p, i) => p.id || i}
          columns={[
            {
              key: 'student', header: 'Student / payer',
              render: (p) => {
                const stu = students.find((s) => s.id === p.student_id);
                return (
                  <span className="sn-td-strong">
                    {stu ? `${stu.name}${stu.class ? ` (${stu.class})` : ''}`
                         : (p.payer_name || p.student_name || 'Student payment')}
                  </span>
                );
              },
            },
            {
              key: 'ref', header: 'Receipt',
              render: (p, i) => (
                <span className="sn-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {p.receipt_no || p.reference || `REC-${1000 + i}`}
                </span>
              ),
            },
            { key: 'date', header: 'Date', render: (p) => p.date || new Date().toLocaleDateString('en-GB') },
            { key: 'method', header: 'Method', render: (p) => <SnBadge tone="secondary">{p.method || 'M-Pesa'}</SnBadge> },
            { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="sn-td-strong">{fmtKES(p.amount)}</span> },
            { key: 'status', header: 'Status', render: () => <SnBadge tone="success">Completed</SnBadge> },
          ]}
        />
      </div>
    </SneatPage>
  );
}
