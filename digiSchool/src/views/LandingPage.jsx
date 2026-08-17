import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

/* ------------------------------------------------------------------ */
/* Inline icon set (lucide-style, stroke, 24x24)                      */
/* ------------------------------------------------------------------ */
const ICONS = {
  offline: ['M1 1l22 22', 'M8.5 16.5a5 5 0 0 1 7 0', 'M2 8.82a15 15 0 0 1 4.17-2.65', 'M10.66 5A15 15 0 0 1 22 8.82', 'M16.85 11.25a10 10 0 0 1 2.22 1.68', 'M5 13a10 10 0 0 1 5.24-2.76', 'M12 20h.01'],
  message: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  report: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M9 15l2 2 4-4'],
  phone2: ['M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'M11 18h2'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  wallet: ['M3 6a2 2 0 0 1 2-2h14v4', 'M3 6v12a2 2 0 0 0 2 2h15V8H5a2 2 0 0 1-2-2z', 'M16 13h.01'],
  dashboard: ['M3 3h7v9H3z', 'M14 3h7v5h-7z', 'M14 12h7v9h-7z', 'M3 16h7v5H3z'],
  cap: ['M22 10L12 5 2 10l10 5 10-5z', 'M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5'],
  users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  card: ['M2 5h20v14H2z', 'M2 10h20'],
  book: ['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z', 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'],
  check: ['M20 6L9 17l-5-5'],
  chevron: ['M6 9l6 6 6-6'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  phone: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z'],
  mail: ['M22 6l-10 7L2 6', 'M2 6h20v12H2z'],
  pin: ['M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  zap: ['M13 2L3 14h7l-1 8 10-12h-7z'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  sync: ['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10', 'M1 14l4.64 4.36A9 9 0 0 0 20.49 15'],
};

function Icon({ name, className }) {
  const paths = ICONS[name] || [];
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [billing, setBilling] = useState('annual');
  const [openFaq, setOpenFaq] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeQuote, setActiveQuote] = useState(0);
  const [quotePaused, setQuotePaused] = useState(false);

  const contactPhone = '+254 701 402265';
  const contactPhoneLink = '+254701402265';
  const contactEmail = 'sales@edu1app.tech';

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 16);
      setShowTop(window.scrollY > 700);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll-reveal: fade/slide elements in as they enter the viewport,
  // staggered within each group. Applied in JS so markup stays clean.
  useEffect(() => {
    const sel = '.eo-sec-head, .eo-tile, .eo-portal, .eo-step, .eo-pkg, .eo-quote, .eo-faq-item, .eo-stat, .eo-hero-copy, .eo-hero-visual, .eo-trustline, .eo-cta-inner > *, .eo-billing, .eo-pkg-foot';
    const els = Array.from(document.querySelectorAll(sel));
    els.forEach((el) => el.classList.add('eo-reveal'));
    els.forEach((el) => {
      const sibs = Array.from(el.parentElement.children).filter((c) => c.classList.contains('eo-reveal'));
      el.style.setProperty('--i', Math.max(0, sibs.indexOf(el)));
    });
    const reveal = (el) => el.classList.add('in');
    // Animate whatever is already in view on the very next frame.
    const raf = requestAnimationFrame(() => {
      els.forEach((el) => { if (el.getBoundingClientRect().top < window.innerHeight * 0.92) reveal(el); });
    });
    let io;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } }),
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
      );
      els.forEach((el) => io.observe(el));
    }
    // Safety net: never leave anything hidden, even if the observer never fires.
    const failsafe = setTimeout(() => els.forEach(reveal), 1600);
    return () => { cancelAnimationFrame(raf); clearTimeout(failsafe); if (io) io.disconnect(); };
  }, []);

  // Testimonials autoplay: advance every 5.5s, pause on hover/focus, and
  // stay put entirely for visitors who prefer reduced motion.
  useEffect(() => {
    if (quotePaused) return undefined;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    const id = setInterval(() => setActiveQuote((i) => (i + 1) % 3), 5500);
    return () => clearInterval(id);
  }, [quotePaused]);

  const go = (path) => { setMenuOpen(false); navigate(path); };

  /* -------- data -------- */
  const stats = [
    { num: '200+', cap: 'Schools onboarded' },
    { num: '40%', cap: 'Faster fee collection' },
    { num: '100%', cap: 'CBC-compliant reports' },
    { num: '0', cap: 'Data loss, even offline' },
  ];

  const features = [
    { icon: 'offline', wide: true, title: 'Works offline, syncs later', body: 'Mark attendance, enter grades and issue receipts even when the school internet is down. Everything syncs automatically the moment you reconnect - nothing is ever lost.' },
    { icon: 'report', title: 'Automated CBC reports', body: 'Generate compliant CBC assessment reports and transcripts in one click. No more weekend grading marathons.' },
    { icon: 'wallet', title: 'M-PESA fee collection', body: 'Parents pay to your paybill; payments reconcile and receipt automatically. Chase fewer balances.' },
    { icon: 'message', title: 'Instant SMS to parents', body: 'Auto-send fee balances, results, and absence alerts. Keep every parent in the loop without lifting a finger.' },
    { icon: 'shield', title: 'Role-based security', body: 'Teachers see only their classes, parents only their children. Bank-grade encryption and automated backups.' },
    { icon: 'phone2', wide: true, title: 'A dedicated app for every parent', body: 'Parents track academic progress, view fee statements, download report cards and receive announcements - straight from their phone, in real time.' },
  ];

  const portals = [
    { icon: 'dashboard', name: 'Principal', desc: 'Whole-school reports, fee defaulters, and staff permissions at a glance.' },
    { icon: 'cap', name: 'Teacher', desc: 'Offline gradebook, CBC rubrics, lesson plans and class attendance.' },
    { icon: 'card', name: 'Finance', desc: 'Invoicing, M-PESA reconciliation, receipts, payroll and expenses.' },
    { icon: 'users', name: 'Registrar', desc: 'Admissions, enrolment, transfers, clearance and student records.' },
    { icon: 'phone2', name: 'Parent', desc: 'Progress, statements, receipts and announcements on any phone.' },
    { icon: 'book', name: 'Student', desc: 'Timetable, resources, e-learning materials and results.' },
  ];

  // NOTE: placeholder testimonials - replace with real, attributable quotes
  // (or soften the "Real results from real schools" heading) before launch.
  const testimonials = [
    { quote: 'End-of-term reports used to take us three weeks. With EduOne it’s 30 minutes. Our teachers have their weekends back.', initials: 'SO', name: 'Mrs. Omondi', role: 'Principal · Nairobi' },
    { quote: 'I grade offline on the bus home and it syncs when I get WiFi. A total game changer for my workflow.', initials: 'JK', name: 'Mr. Kamau', role: 'Senior Teacher · Nakuru' },
    { quote: 'I see my daughter’s progress and download her report card from my phone. No more queuing at the office.', initials: 'DO', name: 'D. Owino', role: 'Parent · Kisumu' },
  ];
  const quoteCount = testimonials.length;
  const prevQuote = () => setActiveQuote((i) => (i - 1 + quoteCount) % quoteCount);
  const nextQuote = () => setActiveQuote((i) => (i + 1) % quoteCount);

  const steps = [
    { n: '01', title: 'Create your school', body: 'Sign up and get a secure, dedicated cloud space for your institution in minutes.' },
    { n: '02', title: 'Set it up', body: 'Configure fee structures, grade boundaries and timetables with a guided wizard.' },
    { n: '03', title: 'Import your data', body: 'Bulk-upload students and staff by CSV; portal accounts are generated instantly.' },
    { n: '04', title: 'Go live', body: 'Staff and parents log in the same day. Billing and SMS start automatically.' },
  ];

  const faqs = [
    { q: 'Does it really work without internet?', a: 'Yes. EduOne is offline-first: teachers and staff can keep working during outages, and all changes sync safely once a connection returns. This is built for Kenyan school realities, not an afterthought.' },
    { q: 'How is EduOne different from Zeraki?', a: 'EduOne is one flat fee for your whole school - not per-student, per-product billing. You get finance, academics, registrar, HR, timetables, portals and e-learning together, at a price built to stay affordable as you grow.' },
    { q: 'Can parents pay school fees through the system?', a: 'Yes. Parents pay to your M-PESA paybill and payments reconcile and receipt automatically, so your finance office spends far less time chasing and recording balances.' },
    { q: 'How long does setup take?', a: 'Most schools are live within a day. We help migrate your existing student and fee data, and every plan includes free onboarding.' },
    { q: 'Is our data safe?', a: 'Absolutely. Data is encrypted, backed up automatically, and protected by strict role-based access so each user only sees what they should.' },
  ];

  // Subscription packages - flat per-school pricing (KES). Annual = 10x monthly.
  const packages = [
    {
      id: 'starter', name: 'Starter', tagline: 'For small schools going digital for the first time.',
      monthly: 3000, annual: 30000, limit: 'Up to 250 learners', cta: 'Start free trial',
      features: [
        { t: 'Principal & admin dashboard', on: true },
        { t: 'Gradebook & automated CBC reports', on: true },
        { t: 'Fee invoicing, receipts & statements', on: true },
        { t: 'Timetable generator', on: true },
        { t: 'Offline-first - works without internet', on: true },
        { t: 'Email support', on: true },
        { t: 'SMS notifications', on: false },
        { t: 'Parent & student portals', on: false },
      ],
    },
    {
      id: 'standard', name: 'Standard', tagline: 'Everything a busy school needs day-to-day.',
      monthly: 6500, annual: 65000, limit: 'Up to 800 learners', cta: 'Start free trial', popular: true,
      features: [
        { t: 'Everything in Starter', on: true, strong: true },
        { t: 'Bulk SMS - fees, results & absences', on: true },
        { t: 'Parent & student mobile portals', on: true },
        { t: 'M-PESA / mobile-money reconciliation', on: true },
        { t: 'Staff HR, attendance & payroll', on: true },
        { t: 'Admissions & registrar workflows', on: true },
        { t: 'Priority support', on: true },
      ],
    },
    {
      id: 'premium', name: 'Premium', tagline: 'The full suite for large & multi-stream schools.',
      monthly: 12000, annual: 120000, limit: 'Unlimited learners', cta: 'Talk to sales',
      features: [
        { t: 'Everything in Standard', on: true, strong: true },
        { t: 'E-learning & CBC resource library', on: true },
        { t: 'Performance analytics & insights', on: true },
        { t: 'Clinic & library modules', on: true },
        { t: 'Custom domain (portal.yourschool.com)', on: true },
        { t: 'On-site staff training', on: true },
        { t: 'Dedicated account manager', on: true },
      ],
    },
  ];

  const fmtKES = (n) => 'KES ' + n.toLocaleString('en-KE');

  return (
    <div className="eo">
      {/* ---------- NAV ---------- */}
      <header className={`eo-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="eo-wrap eo-nav">
          <a href="#top" className="eo-logo" aria-label="EduOne home" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/logo.png" alt="EduOne" className="eo-logo-img" />
          </a>
          <nav className={`eo-nav-links ${menuOpen ? 'is-open' : ''}`}>
            <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#portals" onClick={() => setMenuOpen(false)}>Portals</a>
            <a href="#how" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
            <div className="eo-nav-mobile-cta">
              <button className="eo-btn eo-btn-ghost" onClick={() => go('/login')}>Login</button>
              <button className="eo-btn eo-btn-primary" onClick={() => go('/signup')}>Start free trial</button>
            </div>
          </nav>
          <div className="eo-nav-cta">
            <button className="eo-btn eo-btn-ghost" onClick={() => go('/login')}>Login</button>
            <button className="eo-btn eo-btn-primary" onClick={() => go('/signup')}>Start free trial</button>
          </div>
          <button className={`eo-burger ${menuOpen ? 'is-open' : ''}`} onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu" aria-expanded={menuOpen}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      <main id="top">
        {/* ---------- HERO ---------- */}
        <section className="eo-hero">
          <div className="eo-wrap eo-hero-grid">
            <div className="eo-hero-copy">
              <div className="eo-eyebrow"><span className="eo-dot" /> Built for African schools</div>
              <h1>Run your whole school from <span className="eo-grad">one simple dashboard.</span></h1>
              <p className="eo-lede">
                EduOne automates fee collection, CBC grading and parent communication - and keeps working even when the internet doesn&apos;t. Replace the spreadsheets, paper registers and five different apps with one.
              </p>
              <div className="eo-hero-actions">
                <button className="eo-btn eo-btn-primary eo-btn-lg" onClick={() => go('/signup')}>
                  Start 14-day free trial <Icon name="arrow" className="eo-i-sm" />
                </button>
                <button className="eo-btn eo-btn-ghost eo-btn-lg" onClick={() => go('/book-demo')}>Book a live demo</button>
              </div>
              <ul className="eo-hero-chips">
                <li><Icon name="check" className="eo-i-xs" /> No credit card</li>
                <li><Icon name="check" className="eo-i-xs" /> Setup in a day</li>
                <li><Icon name="check" className="eo-i-xs" /> Offline-first</li>
              </ul>
            </div>

            {/* Product mockup */}
            <div className="eo-hero-visual">
              <div className="eo-window">
                <div className="eo-window-bar">
                  <span className="eo-dots"><i /><i /><i /></span>
                  <span className="eo-url">app.eduone.co.ke</span>
                </div>
                <div className="eo-app">
                  <div className="eo-app-top">
                    <div>
                      <div className="eo-app-title">Greenhill Academy</div>
                      <div className="eo-app-sub">Term 2 · 2026</div>
                    </div>
                    <div className="eo-app-live"><span className="eo-dot" /> Synced</div>
                  </div>
                  <div className="eo-app-stats">
                    <div className="eo-mini"><span className="eo-mini-cap">Fees collected</span><span className="eo-mini-num">KES 4.2M</span><span className="eo-mini-up">▲ 40%</span></div>
                    <div className="eo-mini"><span className="eo-mini-cap">Attendance</span><span className="eo-mini-num">96%</span><span className="eo-mini-up">▲ 3%</span></div>
                    <div className="eo-mini"><span className="eo-mini-cap">Learners</span><span className="eo-mini-num">812</span><span className="eo-mini-flat">Active</span></div>
                  </div>
                  <div className="eo-app-chart">
                    <div className="eo-chart-head">Fee collection · this term</div>
                    <div className="eo-bars">
                      {[42, 58, 50, 71, 63, 88, 79].map((h, i) => (
                        <span key={i} className="eo-bar" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                  <div className="eo-app-rows">
                    <div className="eo-row"><span className="eo-avatar">AO</span><span className="eo-row-main"><b>A. Otieno</b> · Form 3 West</span><span className="eo-row-tag ok">Paid</span></div>
                    <div className="eo-row"><span className="eo-avatar">MW</span><span className="eo-row-main"><b>M. Wanjiru</b> · Grade 6</span><span className="eo-row-tag due">Balance</span></div>
                  </div>
                </div>
              </div>

              <div className="eo-float eo-float-1"><Icon name="wallet" className="eo-i-sm" /> M-PESA +KES 45,000</div>
              <div className="eo-float eo-float-2"><Icon name="report" className="eo-i-sm" /> 214 report cards ready</div>
              <div className="eo-float eo-float-3"><Icon name="sync" className="eo-i-sm" /> Offline · synced</div>
            </div>
          </div>

          <div className="eo-trustline">
            <span>Trusted by schools across</span>
            <span className="eo-county">Nairobi</span>
            <span className="eo-county">Kisumu</span>
            <span className="eo-county">Mombasa</span>
            <span className="eo-county">Eldoret</span>
            <span className="eo-county">Nakuru</span>
            <span className="eo-county">Kakamega</span>
          </div>
        </section>

        {/* ---------- STATS ---------- */}
        <section className="eo-stats">
          <div className="eo-wrap eo-stats-grid">
            {stats.map((s) => (
              <div key={s.cap} className="eo-stat">
                <div className="eo-stat-num">{s.num}</div>
                <div className="eo-stat-cap">{s.cap}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- FEATURES (bento) ---------- */}
        <section className="eo-sec" id="features">
          <div className="eo-wrap">
            <div className="eo-sec-head">
              <div className="eo-eyebrow eo-center"><span className="eo-dot" /> Everything in one place</div>
              <h2>One platform to run the entire school.</h2>
              <p>Stop juggling five apps and a stack of spreadsheets. EduOne brings finance, academics and communication together - and keeps it running whatever your connection.</p>
            </div>
            <div className="eo-bento">
              {features.map((f) => (
                <div key={f.title} className={`eo-tile ${f.wide ? 'eo-tile-wide' : ''}`}>
                  <span className="eo-tile-icon"><Icon name={f.icon} className="eo-i" /></span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- PORTALS ---------- */}
        <section className="eo-sec eo-sec-soft" id="portals">
          <div className="eo-wrap">
            <div className="eo-sec-head">
              <div className="eo-eyebrow eo-center"><span className="eo-dot" /> Made for everyone</div>
              <h2>Six portals, one system.</h2>
              <p>A purpose-built experience for every person in your institution - no more one-size-fits-all software.</p>
            </div>
            <div className="eo-portals">
              {portals.map((p) => (
                <div key={p.name} className="eo-portal">
                  <span className="eo-portal-icon"><Icon name={p.icon} className="eo-i" /></span>
                  <h3>{p.name} portal</h3>
                  <p>{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- HOW IT WORKS ---------- */}
        <section className="eo-sec" id="how">
          <div className="eo-wrap">
            <div className="eo-sec-head">
              <div className="eo-eyebrow eo-center"><span className="eo-dot" /> Zero-friction onboarding</div>
              <h2>Live by Monday.</h2>
              <p>We handle the heavy lifting of migration and setup so you can focus on teaching.</p>
            </div>
            <div className="eo-steps">
              {steps.map((s) => (
                <div key={s.n} className="eo-step">
                  <span className="eo-step-n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- PRICING ---------- */}
        <section className="eo-sec eo-sec-soft" id="pricing">
          <div className="eo-wrap">
            <div className="eo-sec-head">
              <div className="eo-eyebrow eo-center"><span className="eo-dot" /> Simple pricing</div>
              <h2>One flat fee for your whole school.</h2>
              <p>No per-student charges, no hidden add-ons. Pick a package for your size and get every module for one predictable price - a fraction of what per-student platforms cost.</p>
            </div>

            <div className="eo-billing" role="tablist" aria-label="Billing cycle">
              <button role="tab" aria-selected={billing === 'monthly'} className={`eo-bill-opt ${billing === 'monthly' ? 'active' : ''}`} onClick={() => setBilling('monthly')}>Monthly</button>
              <button role="tab" aria-selected={billing === 'annual'} className={`eo-bill-opt ${billing === 'annual' ? 'active' : ''}`} onClick={() => setBilling('annual')}>
                Annual <span className="eo-save">2 months free</span>
              </button>
            </div>

            <div className="eo-pkgs">
              {packages.map((pkg) => {
                const price = billing === 'annual' ? pkg.annual : pkg.monthly;
                const suffix = billing === 'annual' ? '/ year' : '/ month';
                return (
                  <div key={pkg.id} className={`eo-pkg ${pkg.popular ? 'popular' : ''}`}>
                    {pkg.popular && <div className="eo-pkg-ribbon">Most popular</div>}
                    <div className="eo-pkg-name">{pkg.name}</div>
                    <p className="eo-pkg-tag">{pkg.tagline}</p>
                    <div className="eo-pkg-price">
                      <span className="eo-pkg-amt">{fmtKES(price)}</span>
                      <span className="eo-pkg-suffix">{suffix}</span>
                    </div>
                    <div className="eo-pkg-sub">
                      {billing === 'annual'
                        ? `Just ${fmtKES(Math.round(pkg.annual / 12))}/mo, billed yearly`
                        : `Save ${fmtKES(pkg.monthly * 12 - pkg.annual)} paying annually`}
                    </div>
                    <div className="eo-pkg-limit">{pkg.limit}</div>
                    <button className={`eo-btn ${pkg.popular ? 'eo-btn-primary' : 'eo-btn-ghost'} eo-pkg-cta`} onClick={() => go('/signup')}>{pkg.cta}</button>
                    <ul className="eo-pkg-feats">
                      {pkg.features.map((f, i) => (
                        <li key={i} className={`${f.on ? 'yes' : 'no'} ${f.strong ? 'strong' : ''}`}>
                          <Icon name={f.on ? 'check' : 'chevron'} className="eo-i-xs eo-feat-ico" />
                          <span>{f.t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="eo-pkg-foot">All packages include automated backups, encryption, free onboarding &amp; data migration, and a 14-day free trial - no card required. Running a group of schools? <a href="/book-demo" onClick={(e) => { e.preventDefault(); go('/book-demo'); }}>Talk to us</a> about a multi-school plan.</p>
          </div>
        </section>

        {/* ---------- TESTIMONIALS ---------- */}
        <section className="eo-sec" id="stories">
          <div className="eo-wrap">
            <div className="eo-sec-head">
              <div className="eo-eyebrow eo-center"><span className="eo-dot" /> Loved by educators</div>
              <h2>Real results from real schools.</h2>
            </div>
            <div
              className="eo-carousel"
              role="region"
              aria-roledescription="carousel"
              aria-label="What schools say about EduOne"
              onMouseEnter={() => setQuotePaused(true)}
              onMouseLeave={() => setQuotePaused(false)}
              onFocusCapture={() => setQuotePaused(true)}
              onBlurCapture={() => setQuotePaused(false)}
              onKeyDown={(e) => { if (e.key === 'ArrowLeft') prevQuote(); else if (e.key === 'ArrowRight') nextQuote(); }}
            >
              <button type="button" className="eo-car-arrow prev" onClick={prevQuote} aria-label="Previous testimonial">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <div className="eo-car-viewport">
                <div className="eo-car-track" style={{ transform: `translateX(-${activeQuote * 100}%)` }} aria-live="polite">
                  {testimonials.map((t, i) => (
                    <div key={i} className="eo-slide" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${quoteCount}`} aria-hidden={i !== activeQuote}>
                      <div className="eo-quote">
                        <p>&ldquo;{t.quote}&rdquo;</p>
                        <div className="eo-who"><span className="eo-avatar lg">{t.initials}</span><div><b>{t.name}</b><span>{t.role}</span></div></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button type="button" className="eo-car-arrow next" onClick={nextQuote} aria-label="Next testimonial">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </button>
              <div className="eo-car-dots" role="tablist" aria-label="Choose testimonial">
                {testimonials.map((_, i) => (
                  <button key={i} type="button" role="tab" aria-selected={i === activeQuote} aria-label={`Go to testimonial ${i + 1}`} className={`eo-car-dot ${i === activeQuote ? 'active' : ''}`} onClick={() => setActiveQuote(i)} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="eo-sec eo-sec-soft" id="faq">
          <div className="eo-wrap eo-faq-wrap">
            <div className="eo-sec-head eo-left">
              <div className="eo-eyebrow"><span className="eo-dot" /> Questions</div>
              <h2>Frequently asked.</h2>
              <p>Everything you need to know before you start. Still curious? <a href="/book-demo" onClick={(e) => { e.preventDefault(); go('/book-demo'); }}>Talk to our team</a>.</p>
            </div>
            <div className="eo-faq">
              {faqs.map((f, i) => (
                <div key={i} className={`eo-faq-item ${openFaq === i ? 'open' : ''}`}>
                  <button className="eo-faq-q" onClick={() => setOpenFaq(openFaq === i ? -1 : i)} aria-expanded={openFaq === i}>
                    <span>{f.q}</span>
                    <Icon name="chevron" className="eo-faq-chev" />
                  </button>
                  <div className="eo-faq-a"><p>{f.a}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="eo-cta" id="demo">
          <div className="eo-wrap eo-cta-inner">
            <div>
              <h2>Ready to run your school the modern way?</h2>
              <p>Start your 14-day free trial today - no card, no commitment. Or book a live demo and we&apos;ll walk you through it.</p>
            </div>
            <div className="eo-cta-actions">
              <button className="eo-btn eo-btn-white eo-btn-lg" onClick={() => go('/signup')}>Create free account</button>
              <button className="eo-btn eo-btn-outline eo-btn-lg" onClick={() => go('/book-demo')}>Book a demo</button>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- FOOTER ---------- */}
      <footer className="eo-footer">
        <div className="eo-wrap">
          <div className="eo-foot-grid">
            <div className="eo-foot-brand">
              <a href="#top" className="eo-logo eo-logo-foot" aria-label="EduOne home" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <img src="/logo.png" alt="EduOne" className="eo-logo-img" />
              </a>
              <p>The next-generation school management platform empowering educators, parents and students across Africa.</p>
            </div>
            <div className="eo-foot-col">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#portals">Portals</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="eo-foot-col">
              <h4>Company</h4>
              <a href="#how">How it works</a>
              <a href="#stories">Success stories</a>
              <a href="/book-demo" onClick={(e) => { e.preventDefault(); go('/book-demo'); }}>Book a demo</a>
              <a href="#" onClick={(e) => { e.preventDefault(); go('/login'); }}>Login</a>
            </div>
            <div className="eo-foot-col">
              <h4>Contact</h4>
              <a href={`tel:${contactPhoneLink}`}><Icon name="phone" className="eo-i-xs" /> {contactPhone}</a>
              <a href={`mailto:${contactEmail}`}><Icon name="mail" className="eo-i-xs" /> {contactEmail}</a>
              <span className="eo-foot-addr"><Icon name="pin" className="eo-i-xs" /> P.O. Box 4021-00100, Nairobi</span>
            </div>
          </div>
          <div className="eo-foot-bottom">
            <span>© 2026 EduOne. All rights reserved.</span>
            <span>Offline-first · CBC compliant · Secure</span>
          </div>
        </div>
      </footer>

      <button className={`eo-top ${showTop ? 'show' : ''}`} aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      </button>
    </div>
  );
}
