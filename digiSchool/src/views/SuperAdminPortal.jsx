import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, Users, Wallet, Clock, TrendingUp, CheckCircle2, XCircle, LogOut, Building2 } from 'lucide-react';
import { supabase, signOutAll } from '../lib/supabaseClient';
import { getMetrics, approveSchool, rejectSchool, PLANS, planName, planPrice, collectedFor } from '../lib/superadmin';

const kes = (n) => 'KES ' + Math.round(n).toLocaleString('en-KE');
const kesShort = (n) => (n >= 1e6 ? 'KES ' + (n / 1e6).toFixed(2) + 'M' : kes(n));
const timeAgo = (iso) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  return `${Math.round(d / 30)}mo ago`;
};

function Donut({ data }) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  const r = 52, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" width="150" height="150" aria-hidden="true">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#eef2f7" strokeWidth="18" />
      {data.map((seg, i) => {
        const len = (seg.value / total) * c;
        const el = (
          <circle key={i} cx="70" cy="70" r={r} fill="none" stroke={seg.color} strokeWidth="18"
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
            transform="rotate(-90 70 70)" strokeLinecap="butt" />
        );
        offset += len;
        return el;
      })}
      <text x="70" y="66" textAnchor="middle" fontSize="26" fontWeight="800" fill="#0b1220">{total}</text>
      <text x="70" y="86" textAnchor="middle" fontSize="11" fill="#64748b">schools</text>
    </svg>
  );
}

export default function SuperAdminPortal() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('no session');
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        if (prof?.role !== 'super_admin') throw new Error('not a super admin');
        if (active) { setData(getMetrics()); setChecking(false); }
      } catch {
        navigate('/login');
      }
    })();
    return () => { active = false; };
  }, [navigate]);

  const refresh = () => setData(getMetrics());
  const onApprove = (id) => { approveSchool(id); refresh(); };
  const onReject = (id) => { rejectSchool(id); refresh(); };
  const logout = async () => { await signOutAll(); navigate('/login'); };

  if (checking || !data) return null;

  const maxPlanMrr = Math.max(...Object.values(data.byPlan).map((p) => p.mrr), 1);
  const donutData = Object.keys(PLANS).map((k) => ({ label: PLANS[k].name, value: data.byPlan[k].count, color: PLANS[k].color }));

  return (
    <div className="sa">
      <header className="sa-top">
        <div className="sa-wrap sa-top-inner">
          <div className="sa-brand">
            <img src="/logo.png" alt="EduOne" className="sa-logo" />
            <span className="sa-chip">Super Admin</span>
          </div>
          <button className="sa-logout" onClick={logout}><LogOut size={16} /> Sign out</button>
        </div>
      </header>

      <main className="sa-wrap sa-main">
        <div className="sa-head">
          <h1>Platform overview</h1>
          <p>Every school on EduOne, their plan, activity and the revenue they generate.</p>
        </div>

        {/* KPIs */}
        <div className="sa-kpis">
          <div className="sa-kpi">
            <span className="sa-kpi-ico blue"><School size={20} /></span>
            <div><div className="sa-kpi-num">{data.totalActive}</div><div className="sa-kpi-cap">Active schools</div></div>
          </div>
          <div className="sa-kpi">
            <span className="sa-kpi-ico green"><Wallet size={20} /></span>
            <div><div className="sa-kpi-num">{kesShort(data.mrr)}</div><div className="sa-kpi-cap">Monthly recurring revenue</div></div>
          </div>
          <div className="sa-kpi">
            <span className="sa-kpi-ico violet"><TrendingUp size={20} /></span>
            <div><div className="sa-kpi-num">{kesShort(data.collected)}</div><div className="sa-kpi-cap">Total collected to date</div></div>
          </div>
          <div className="sa-kpi">
            <span className="sa-kpi-ico amber"><Users size={20} /></span>
            <div><div className="sa-kpi-num">{data.totalStudents.toLocaleString()}</div><div className="sa-kpi-cap">Learners served</div></div>
          </div>
          <div className="sa-kpi">
            <span className="sa-kpi-ico rose"><Clock size={20} /></span>
            <div><div className="sa-kpi-num">{data.pendingCount}</div><div className="sa-kpi-cap">Pending onboarding</div></div>
          </div>
        </div>

        {/* Onboarding queue */}
        <section className="sa-card sa-queue">
          <div className="sa-card-head">
            <h2><Building2 size={18} /> Onboarding requests</h2>
            <span className="sa-badge">{data.pending.length} pending</span>
          </div>
          {data.pending.length === 0 ? (
            <p className="sa-empty">No pending requests. New school sign-ups will appear here for you to onboard or reject.</p>
          ) : (
            <div className="sa-req-list">
              {data.pending.map((s) => (
                <div key={s.id} className="sa-req">
                  <div className="sa-req-info">
                    <div className="sa-req-name">{s.name}</div>
                    <div className="sa-req-meta">{s.principal} · {s.county} · {s.students} learners · applied {timeAgo(s.joinedAt)}</div>
                  </div>
                  <div className="sa-req-plan" style={{ '--pc': PLANS[s.plan]?.color }}>
                    {planName(s.plan)} · {kes(planPrice(s.plan))}/mo
                  </div>
                  <div className="sa-req-actions">
                    <button className="sa-btn sa-approve" onClick={() => onApprove(s.id)}><CheckCircle2 size={16} /> Onboard</button>
                    <button className="sa-btn sa-reject" onClick={() => onReject(s.id)}><XCircle size={16} /> Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="sa-grid2">
          {/* Revenue by package */}
          <section className="sa-card">
            <div className="sa-card-head"><h2>Revenue by package</h2><span className="sa-sub">monthly</span></div>
            <div className="sa-bars">
              {Object.keys(PLANS).map((k) => (
                <div key={k} className="sa-bar-row">
                  <div className="sa-bar-label"><span className="sa-dot" style={{ background: PLANS[k].color }} />{PLANS[k].name}<span className="sa-bar-count">{data.byPlan[k].count} schools</span></div>
                  <div className="sa-bar-track"><div className="sa-bar-fill" style={{ width: `${(data.byPlan[k].mrr / maxPlanMrr) * 100}%`, background: PLANS[k].color }} /></div>
                  <div className="sa-bar-val">{kes(data.byPlan[k].mrr)}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Plan distribution */}
          <section className="sa-card sa-dist">
            <div className="sa-card-head"><h2>Plan distribution</h2></div>
            <div className="sa-dist-body">
              <Donut data={donutData} />
              <ul className="sa-legend">
                {Object.keys(PLANS).map((k) => (
                  <li key={k}><span className="sa-dot" style={{ background: PLANS[k].color }} />{PLANS[k].name}<b>{data.byPlan[k].count}</b></li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        {/* Schools table */}
        <section className="sa-card">
          <div className="sa-card-head"><h2>All schools</h2><span className="sa-sub">{data.schools.length} total</span></div>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr><th>School</th><th>County</th><th>Plan</th><th className="num">Learners</th><th>Status</th><th className="num">Monthly</th><th className="num">Collected</th><th>Last active</th></tr>
              </thead>
              <tbody>
                {data.schools.map((s) => (
                  <tr key={s.id}>
                    <td><div className="sa-td-name">{s.name}</div><div className="sa-td-sub">{s.principal}</div></td>
                    <td>{s.county}</td>
                    <td><span className="sa-plan-tag" style={{ color: PLANS[s.plan]?.color, background: (PLANS[s.plan]?.color || '#000') + '18' }}>{planName(s.plan)}</span></td>
                    <td className="num">{s.students.toLocaleString()}</td>
                    <td><span className={`sa-status ${s.status}`}>{s.status}</span></td>
                    <td className="num">{s.status === 'active' ? kes(planPrice(s.plan)) : '—'}</td>
                    <td className="num">{s.status === 'active' ? kes(collectedFor(s)) : '—'}</td>
                    <td>{timeAgo(s.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan="5">Totals (active)</td><td className="num">{kes(data.mrr)}</td><td className="num">{kes(data.collected)}</td><td /></tr>
              </tfoot>
            </table>
          </div>
        </section>

        <p className="sa-note">Prototype data is stored locally in this browser. Onboarding a school from the signup flow adds it to the queue above.</p>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        .sa { --blue:#2563eb; --ink:#0b1220; --slate:#475569; --muted:#64748b; --border:#e6eaf1; --soft:#f6f8fc;
          min-height:100vh; background:var(--soft); font-family:'Inter',system-ui,sans-serif; color:var(--ink); -webkit-font-smoothing:antialiased; }
        .sa * { box-sizing:border-box; }
        .sa-wrap { max-width:1180px; margin:0 auto; padding:0 24px; }
        .sa-top { background:#fff; border-bottom:1px solid var(--border); position:sticky; top:0; z-index:10; }
        .sa-top-inner { display:flex; align-items:center; justify-content:space-between; height:64px; }
        .sa-brand { display:flex; align-items:center; gap:12px; }
        .sa-logo { height:30px; }
        .sa-chip { font-size:.72rem; font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:var(--blue); background:#eff4ff; border:1px solid #dbe6ff; padding:5px 10px; border-radius:100px; }
        .sa-logout { display:inline-flex; align-items:center; gap:7px; font-family:inherit; font-weight:600; font-size:.88rem; color:var(--slate); background:#fff; border:1px solid var(--border); border-radius:10px; padding:8px 14px; cursor:pointer; }
        .sa-logout:hover { color:var(--blue); border-color:var(--blue); }

        .sa-main { padding:32px 24px 60px; }
        .sa-head h1 { font-family:'Outfit',sans-serif; font-size:1.9rem; font-weight:800; letter-spacing:-0.02em; margin:0 0 6px; }
        .sa-head p { color:var(--muted); margin:0 0 26px; }

        .sa-kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:16px; margin-bottom:22px; }
        @media (max-width:1000px){ .sa-kpis{ grid-template-columns:repeat(2,1fr); } }
        @media (max-width:520px){ .sa-kpis{ grid-template-columns:1fr; } }
        .sa-kpi { display:flex; align-items:center; gap:14px; background:#fff; border:1px solid var(--border); border-radius:16px; padding:18px; box-shadow:0 1px 2px rgba(16,24,40,.04); }
        .sa-kpi-ico { display:grid; place-items:center; width:44px; height:44px; border-radius:12px; flex-shrink:0; }
        .sa-kpi-ico.blue{ background:#eef4ff; color:#2563eb; } .sa-kpi-ico.green{ background:#eafaef; color:#16a34a; }
        .sa-kpi-ico.violet{ background:#f2ecfe; color:#7c3aed; } .sa-kpi-ico.amber{ background:#fef4e2; color:#d97706; } .sa-kpi-ico.rose{ background:#fdeaef; color:#e11d63; }
        .sa-kpi-num { font-family:'Outfit',sans-serif; font-size:1.5rem; font-weight:800; letter-spacing:-0.02em; line-height:1.1; }
        .sa-kpi-cap { font-size:.8rem; color:var(--muted); font-weight:500; margin-top:2px; }

        .sa-card { background:#fff; border:1px solid var(--border); border-radius:18px; padding:22px 24px; box-shadow:0 1px 2px rgba(16,24,40,.04); margin-bottom:20px; }
        .sa-card-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
        .sa-card-head h2 { display:flex; align-items:center; gap:8px; font-family:'Outfit',sans-serif; font-size:1.12rem; font-weight:700; margin:0; }
        .sa-sub { font-size:.78rem; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
        .sa-badge { font-size:.74rem; font-weight:800; color:#e11d63; background:#fdeaef; border:1px solid #f8c9d7; padding:4px 10px; border-radius:100px; }

        .sa-empty { color:var(--muted); font-size:.92rem; margin:0; }
        .sa-req-list { display:flex; flex-direction:column; gap:12px; }
        .sa-req { display:flex; align-items:center; gap:16px; flex-wrap:wrap; border:1px solid var(--border); border-radius:14px; padding:14px 16px; background:#fcfdff; }
        .sa-req-info { flex:1; min-width:200px; }
        .sa-req-name { font-weight:700; }
        .sa-req-meta { font-size:.82rem; color:var(--muted); margin-top:2px; }
        .sa-req-plan { font-size:.82rem; font-weight:700; color:var(--pc,#2563eb); background:color-mix(in srgb, var(--pc,#2563eb) 12%, #fff); border:1px solid color-mix(in srgb, var(--pc,#2563eb) 25%, #fff); padding:7px 12px; border-radius:10px; white-space:nowrap; }
        .sa-req-actions { display:flex; gap:8px; }
        .sa-btn { display:inline-flex; align-items:center; gap:6px; font-family:inherit; font-weight:700; font-size:.85rem; border:1px solid transparent; border-radius:10px; padding:9px 14px; cursor:pointer; }
        .sa-approve { background:#16a34a; color:#fff; } .sa-approve:hover { background:#15803d; }
        .sa-reject { background:#fff; color:#b91c1c; border-color:#fecaca; } .sa-reject:hover { background:#fef2f2; }

        .sa-grid2 { display:grid; grid-template-columns:1.4fr 1fr; gap:20px; }
        @media (max-width:820px){ .sa-grid2{ grid-template-columns:1fr; } }
        .sa-bars { display:flex; flex-direction:column; gap:18px; }
        .sa-bar-row { display:grid; grid-template-columns:160px 1fr auto; align-items:center; gap:14px; }
        @media (max-width:520px){ .sa-bar-row{ grid-template-columns:1fr; gap:6px; } }
        .sa-bar-label { display:flex; align-items:center; gap:8px; font-weight:600; font-size:.9rem; }
        .sa-bar-count { color:var(--muted); font-weight:500; font-size:.78rem; }
        .sa-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
        .sa-bar-track { height:12px; background:#eef2f7; border-radius:100px; overflow:hidden; }
        .sa-bar-fill { height:100%; border-radius:100px; transition:width .5s cubic-bezier(.16,1,.3,1); }
        .sa-bar-val { font-family:'Outfit',sans-serif; font-weight:700; font-size:.92rem; text-align:right; min-width:96px; }

        .sa-dist-body { display:flex; align-items:center; gap:22px; }
        .sa-legend { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:12px; flex:1; }
        .sa-legend li { display:flex; align-items:center; gap:9px; font-weight:600; font-size:.92rem; }
        .sa-legend b { margin-left:auto; font-family:'Outfit',sans-serif; }

        .sa-table-wrap { overflow-x:auto; }
        .sa-table { width:100%; border-collapse:collapse; font-size:.88rem; min-width:760px; }
        .sa-table th { text-align:left; color:var(--muted); font-weight:700; font-size:.74rem; text-transform:uppercase; letter-spacing:.04em; padding:0 14px 12px; border-bottom:1px solid var(--border); }
        .sa-table td { padding:13px 14px; border-bottom:1px solid #f1f4f9; vertical-align:middle; }
        .sa-table th.num, .sa-table td.num { text-align:right; }
        .sa-td-name { font-weight:600; }
        .sa-td-sub { font-size:.78rem; color:var(--muted); }
        .sa-plan-tag { font-size:.74rem; font-weight:700; padding:3px 9px; border-radius:100px; }
        .sa-status { font-size:.72rem; font-weight:800; text-transform:capitalize; padding:4px 10px; border-radius:100px; }
        .sa-status.active { color:#16a34a; background:#eafaef; }
        .sa-status.pending { color:#d97706; background:#fef4e2; }
        .sa-status.rejected { color:#b91c1c; background:#fef2f2; }
        .sa-table tfoot td { font-weight:800; font-family:'Outfit',sans-serif; border-bottom:none; padding-top:14px; }

        .sa-note { font-size:.8rem; color:var(--muted); margin-top:6px; }
        @media (prefers-reduced-motion: reduce){ .sa-bar-fill{ transition:none; } }
      `}</style>
    </div>
  );
}
