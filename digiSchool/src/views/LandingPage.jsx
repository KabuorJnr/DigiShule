import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const [showAnnounce, setShowAnnounce] = useState(true);
  const [feeTab, setFeeTab] = useState('pro');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeCell, setActiveCell] = useState(-1);
  const [ttNow, setTtNow] = useState('—');
  const [ttLabel, setTtLabel] = useState('System active');

  const contactPhone = "+254 701 402265";
  const contactPhoneLink = "+254701402265";
  const contactEmail = "veribidapp@gmail.com";

  // Build the live system module activity logic
  const days = ['FINANCE', 'ACADEMIC', 'REGISTRAR', 'STAFF', 'PORTAL'];
  const periods = [
    { t: 'Module 1', subs: ['Invoicing', 'Gradebook', 'Admissions', 'Attendance', 'Parent App'] },
    { t: 'Module 2', subs: ['Payments', 'Assessments', 'Transfers', 'Leave Mgmt', 'Student App'] },
    { t: 'Module 3', subs: ['Expenses', 'Timetables', 'Profiles', 'Payroll', 'Notices'] },
    { t: 'Module 4', subs: ['Receipts', 'CBC Reports', 'Clearance', 'Recruitment', 'Resources'] },
    { t: 'Module 5', subs: ['Fee Arrears', 'Exams', 'Enrollment', 'Contracts', 'Messaging'] },
    { t: 'Module 6', subs: ['Analytics', 'Syllabus', 'Demographics', 'Performance', 'Settings'] }
  ];

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // highlight "now" randomly to simulate live system activity
    const interval = setInterval(() => {
      const randomPeriod = Math.floor(Math.random() * periods.length);
      const randomDay = Math.floor(Math.random() * days.length);
      
      const rowOffset = 6; // header row width
      const targetIndex = (randomPeriod + 1) * rowOffset + (randomDay + 1);
      
      setActiveCell(targetIndex);
      setTtNow(days[randomDay] + ' · ' + periods[randomPeriod].t);
      setTtLabel(periods[randomPeriod].subs[randomDay] + ' — syncing live');
    }, 3000);
    
    // Initial set
    setActiveCell(13);
    setTtNow('ACADEMIC · Module 2');
    setTtLabel('Assessments — syncing live');

    return () => clearInterval(interval);
  }, []);

  const handleSub = (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    if(input) {
      input.value = 'Subscribed ✓';
      input.disabled = true;
    }
  };

  return (
    <>
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <div className="utility-bar">
        <div className="wrap utility-inner">
          <div className="utility-left">
            <a href={`tel:${contactPhoneLink}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              {contactPhone}
            </a>
            <span><a href={`mailto:${contactEmail}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z" opacity="0" /><path d="M22 6l-10 7L2 6" /><path d="M2 6h20v12H2z" /></svg>
              {contactEmail}
            </a></span>
          </div>
          <div className="utility-right">
            <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
              School Staff &amp; Parent Portal
            </a>
          </div>
        </div>
      </div>

      {showAnnounce && (
        <div className="announce" id="announceBar">
          <div className="wrap announce-inner">
            <span className="badge">SPECIAL</span>
            <span>Transform your school administration today — get a 14-day zero-risk trial.</span>
            <a href="#enroll" className="link">Claim your trial →</a>
            <button className="close" onClick={() => setShowAnnounce(false)} aria-label="Dismiss">✕</button>
          </div>
        </div>
      )}

      <header>
        <div className="wrap">
          <nav>
            <a href="#top" className="logo">
              <img src="/eduone-logo.png" alt="EduOne Logo" />
              EduOne
            </a>
            <div className="nav-links">
              <div className="nav-item">
                <a href="#why">Features <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg></a>
                <div className="dropdown">
                  <a href="#why">Why EduOne</a>
                  <a href="#why">Offline-First Engine</a>
                  <a href="#why">Security &amp; Roles</a>
                  <a href="#why">MPESA Integrations</a>
                </div>
              </div>
              <div className="nav-item">
                <a href="#programs">Portals <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg></a>
                <div className="dropdown">
                  <a href="#programs">Principal Dashboard</a>
                  <a href="#programs">Finance &amp; Registrar</a>
                  <a href="#programs">Teacher Gradebook</a>
                  <a href="#programs">Student &amp; Parent Apps</a>
                </div>
              </div>
              <div className="nav-item">
                <a href="#enroll">Onboarding <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg></a>
                <div className="dropdown">
                  <a href="#how">How it works</a>
                  <a href="#enroll">Create account</a>
                  <a href="#enroll">Book a demo</a>
                </div>
              </div>
              <a href="#fees">Pricing</a>
              <a href="#stories">Success Stories</a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="btn btn-ghost nav-cta" onClick={() => navigate('/login')}>Login</button>
              <button className="btn btn-primary nav-cta" onClick={() => navigate('/signup')}>Start Trial</button>
              <button className="burger">Menu</button>
            </div>
          </nav>
        </div>
      </header>

      <main id="top">

        {/* HERO */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <div className="eyebrow">B2B SaaS · Offline-First · CBC Compliant</div>
              <h1>Run your entire school<br />like a <em>masterpiece.</em></h1>
              <p className="lede">Ditch the spreadsheets and paper trails. EduOne is the all-in-one system that automates fee collection, simplifies CBC grading, and keeps parents engaged—even when your internet is down.</p>
              <div className="hero-actions">
                <button onClick={() => navigate('/signup')} className="btn btn-primary">Start your 14-Day Free Trial</button>
                <a href="#why" className="btn btn-ghost">Explore Features</a>
              </div>
              <div className="hero-note"><span className="live-dot"></span> Trusted by 200+ forward-thinking schools</div>
            </div>

            <div className="tt-card">
              <div className="tt-head">
                <span className="label">Live System Modules</span>
                <span className="status"><span className="live-dot"></span>Secure Sync</span>
              </div>
              
              {/* Dynamic Timetable */}
              <div className="tt-grid" id="ttGrid">
                <div className="tt-cell head" style={{ animationDelay: '0ms' }}></div>
                {days.map((d, i) => (
                  <div key={d} className="tt-cell head" style={{ animationDelay: `${(i + 1) * 12}ms` }}>{d}</div>
                ))}
                
                {periods.map((p, pIdx) => (
                  <React.Fragment key={p.t}>
                    <div className="tt-cell time" style={{ animationDelay: `${((pIdx + 1) * 6) * 12}ms` }}>{p.t}</div>
                    {p.subs.map((sub, sIdx) => {
                      const cellIndex = (pIdx + 1) * 6 + (sIdx + 1);
                      return (
                        <div 
                          key={`${p.t}-${sIdx}`} 
                          className={`tt-cell ${cellIndex === activeCell ? 'active' : ''}`}
                          style={{ animationDelay: `${cellIndex * 12}ms` }}
                        >
                          {sub}
                        </div>
                      )
                    })}
                  </React.Fragment>
                ))}
              </div>

              <div className="tt-foot">
                <span>{ttNow}</span>
                <span>{ttLabel}</span>
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="stats">
          <div className="wrap">
            <div className="stats-grid">
              <div className="stat"><div className="num">100%</div><div className="cap">Automated CBC Reports</div></div>
              <div className="stat"><div className="num">40%</div><div className="cap">Avg. Increase in Fee Collection</div></div>
              <div className="stat"><div className="num">0</div><div className="cap">Data Loss with Offline-First</div></div>
              <div className="stat"><div className="num">24/7</div><div className="cap">Real-time Parent Access</div></div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="sec" id="how">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">Zero Friction Onboarding</div>
              <h2>Four steps to digitalize your entire school.</h2>
              <p>We handle the heavy lifting of data migration and setup so you can focus entirely on delivering quality education. You can be fully operational by Monday.</p>
            </div>
            <div className="steps">
              <div className="step"><span className="n">01</span><h3>Sign Up</h3><p>Create an account for your school and instantly access your dedicated, secure cloud instance.</p></div>
              <div className="step"><span className="n">02</span><h3>System Config</h3><p>Set up your unique fee structures, grade boundaries, and timetables using our intuitive setup wizard.</p></div>
              <div className="step"><span className="n">03</span><h3>Import Data</h3><p>Bulk import your teachers and students via CSV, and we'll instantly generate their secure portal accounts.</p></div>
              <div className="step"><span className="n">04</span><h3>Go Live</h3><p>Your staff and parents log in immediately. Automated billing and SMS notifications begin instantly.</p></div>
            </div>
          </div>
        </section>

        {/* PROGRAMS -> PORTALS */}
        <section className="sec" id="programs" style={{ background: 'var(--bg-2)' }}>
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">The Platform</div>
              <h2>One platform, six dedicated portals.</h2>
              <p>Custom-built experiences for every stakeholder in your institution. No more juggling five different apps to run one school.</p>
            </div>
            <div className="programs">
              <div className="prog-card">
                <div className="grade">ADMINISTRATION</div>
                <h3>Principal Portal</h3>
                <ul>
                  <li>Spot fee defaulters instantly on the dashboard</li>
                  <li>Generate whole-school reports in one click</li>
                  <li>Maintain absolute control over staff permissions</li>
                </ul>
              </div>
              <div className="prog-card">
                <div className="grade">ACADEMICS</div>
                <h3>Teacher Portal</h3>
                <ul>
                  <li>Grade anywhere, anytime with offline support</li>
                  <li>Never lose work to a bad internet connection</li>
                  <li>Auto-generate CBC rubric scores instantly</li>
                </ul>
              </div>
              <div className="prog-card">
                <div className="grade">OPERATIONS</div>
                <h3>Finance &amp; Registrar</h3>
                <ul>
                  <li>Stop chasing payments with SMS reminders</li>
                  <li>MPESA integration means the money finds you</li>
                  <li>Digital receipts issued and logged instantly</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="sec" id="why">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">Core Advantages</div>
              <h2>Why top-tier schools run on EduOne.</h2>
            </div>
            <div className="features">
              <div className="feat"><span className="mark">◆</span><h3>Offline-First Engine</h3><p>Teachers can log attendance and grades even when the school's internet goes down. Everything syncs perfectly the moment they reconnect.</p></div>
              <div className="feat"><span className="mark">◆</span><h3>Real-Time SMS</h3><p>Parents receive instant text messages for fee balances, exam results, absences, and general school announcements. Keep them in the loop automatically.</p></div>
              <div className="feat"><span className="mark">◆</span><h3>Automated CBC Reporting</h3><p>Say goodbye to weekend grading. Generate fully compliant CBC assessment reports and standard academic transcripts with a single click.</p></div>
              <div className="feat"><span className="mark">◆</span><h3>Automated Billing</h3><p>Generate bulk invoices, track mobile money payments, and auto-issue digital receipts without touching a single spreadsheet.</p></div>
              <div className="feat"><span className="mark">◆</span><h3>Bank-Grade Security</h3><p>Strict role-level security ensures teachers only see their classes, parents only see their specific children, and your data is locked down tight.</p></div>
              <div className="feat"><span className="mark">◆</span><h3>Dedicated Parent App</h3><p>Parents have their own secure portal to track academic progress, view financial statements, and download resources directly to their phones.</p></div>
            </div>
          </div>
        </section>

        {/* FEES -> PRICING */}
        <section className="sec" id="fees">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">SaaS Pricing</div>
              <h2>Transparent pricing. Infinite value.</h2>
              <p>Select a plan that fits your school's size. All plans include automated backups, bank-grade encryption, and world-class support.</p>
            </div>

            <div className="fee-tabs">
              <button className={`fee-tab ${feeTab === 'basic' ? 'active' : ''}`} onClick={() => setFeeTab('basic')}>Basic Plan</button>
              <button className={`fee-tab ${feeTab === 'pro' ? 'active' : ''}`} onClick={() => setFeeTab('pro')}>Pro Plan (Best Value)</button>
              <button className={`fee-tab ${feeTab === 'enterprise' ? 'active' : ''}`} onClick={() => setFeeTab('enterprise')}>Enterprise</button>
            </div>

            <div className={`fee-panel ${feeTab === 'basic' ? 'active' : ''}`}>
              <div className="ledger">
                <div className="ledger-head"><h3>Basic Plan</h3><span>MONTHLY</span></div>
                <div className="ledger-row"><span className="item">Student Limit</span><span className="val">Up to 300</span></div>
                <div className="ledger-row"><span className="item">Core Modules (Admin, Teacher, Registrar)</span><span className="val">Included</span></div>
                <div className="ledger-row"><span className="item">Automated Billing &amp; Invoicing</span><span className="val">Included</span></div>
                <div className="ledger-row"><span className="item">Offline-First Capability</span><span className="val">Included</span></div>
                <div className="ledger-row"><span className="item">SMS Notifications</span><span className="val opt">Not Included</span></div>
                <div className="ledger-total"><span>Subscription</span><span className="val">KES 5,000 / mo</span></div>
              </div>
              <p className="fee-note">Perfect for small growing schools looking to ditch paper records and digitize operations efficiently.</p>
            </div>

            <div className={`fee-panel ${feeTab === 'pro' ? 'active' : ''}`}>
              <div className="ledger">
                <div className="ledger-head"><h3>Pro Plan</h3><span>MONTHLY</span></div>
                <div className="ledger-row"><span className="item">Student Limit</span><span className="val">Unlimited</span></div>
                <div className="ledger-row"><span className="item">All Basic Plan Features</span><span className="val">Included</span></div>
                <div className="ledger-row"><span className="item">Integrated SMS Gateway</span><span className="val">Included</span></div>
                <div className="ledger-row"><span className="item">Parent &amp; Student Portals</span><span className="val">Included</span></div>
                <div className="ledger-row"><span className="item">Priority 24/7 Support</span><span className="val">Included</span></div>
                <div className="ledger-total"><span>Subscription</span><span className="val">KES 10,000 / mo</span></div>
              </div>
              <p className="fee-note">Our most popular tier. Everything you need to fully automate communication and management for a thriving school.</p>
            </div>

            <div className={`fee-panel ${feeTab === 'enterprise' ? 'active' : ''}`}>
              <div className="ledger">
                <div className="ledger-head"><h3>Enterprise Plan</h3><span>ANNUAL</span></div>
                <div className="ledger-row"><span className="item">Student Limit</span><span className="val">Unlimited</span></div>
                <div className="ledger-row"><span className="item">Custom Domain Name (e.g., portal.yourschool.com)</span><span className="val">Included</span></div>
                <div className="ledger-row"><span className="item">On-Site Staff Training</span><span className="val">Included</span></div>
                <div className="ledger-row"><span className="item">Custom API Integrations (e.g., Accounting software)</span><span className="val">Available</span></div>
                <div className="ledger-row"><span className="item">Dedicated Account Manager</span><span className="val">Included</span></div>
                <div className="ledger-total"><span>Subscription</span><span className="val">Custom Quote</span></div>
              </div>
              <p className="fee-note">For large groups of schools or institutions requiring bespoke integrations and high-touch dedicated onboarding.</p>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="sec" id="stories" style={{ background: 'var(--bg-2)' }}>
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">Trusted by Educators</div>
              <h2>Real results from real schools.</h2>
            </div>
            <div className="quotes">
              <div className="quote">
                <p className="q">"We used to spend three weeks generating end-of-term reports. With EduOne, it takes 30 minutes. Our teachers finally have their weekends back."</p>
                <div className="who"><b>Mrs. Omondi</b>School Principal, Nairobi</div>
              </div>
              <div className="quote">
                <p className="q">"I can finally grade offline on the bus home. The system syncs the moment I get WiFi. A total game changer for my workflow."</p>
                <div className="who"><b>Mr. Kamau</b>Senior Teacher</div>
              </div>
              <div className="quote">
                <p className="q">"I love seeing my daughter's real-time progress and downloading her report cards directly from my phone without visiting the office. Very transparent."</p>
                <div className="who"><b>D. Owino</b>Parent</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta-band" id="enroll">
          <div className="wrap cta-inner">
            <div>
              <h2>Start your 14-day free trial today.</h2>
              <p className="sub">Join the hundreds of forward-thinking schools upgrading their operations to EduOne.</p>
            </div>
            <div className="cta-actions">
              <button onClick={() => navigate('/signup')} className="btn btn-primary">Create Free Account</button>
              <button onClick={() => window.scrollTo(0, 0)} className="btn btn-ghost">Talk to Sales</button>
            </div>
          </div>
        </section>

      </main>

      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-brand">
              <a href="#top" className="logo">
                <img src="/eduone-logo.png" alt="EduOne Logo" /> EduOne
              </a>
              <p>The next-generation School Management System (SaaS) empowering educators, parents, and students across Africa.</p>
              <div className="foot-social">
                <a href="#" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z" /></svg></a>
                <a href="#" aria-label="X / Twitter"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 3H22l-7.6 8.7L23.3 21h-6.9l-5.4-6.6L4.7 21H1.6l8.1-9.3L1 3h7.1l4.9 6.1L18.9 3z" /></svg></a>
                <a href="#" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg></a>
                <a href="#" aria-label="YouTube"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12s0-3.2-.4-4.7a3 3 0 0 0-2.1-2.1C17.9 5 12 5 12 5s-5.9 0-7.5.2a3 3 0 0 0-2.1 2.1C2 8.8 2 12 2 12s0 3.2.4 4.7a3 3 0 0 0 2.1 2.1C6.1 19 12 19 12 19s5.9 0 7.5-.2a3 3 0 0 0 2.1-2.1c.4-1.5.4-4.7.4-4.7zM10 15V9l5.2 3-5.2 3z" /></svg></a>
              </div>
            </div>
            <div className="foot-col">
              <h4>Quick links</h4>
              <a href="#top">Home</a>
              <a href="#why">Features</a>
              <a href="#programs">Portals</a>
              <a href="#enroll">Onboarding</a>
              <a href="#fees">Pricing</a>
            </div>
            <div className="foot-col">
              <h4>Platform</h4>
              <a href="#programs">Principal Admin</a>
              <a href="#programs">Teacher Gradebook</a>
              <a href="#programs">Finance Module</a>
              <a href="#programs">Parent App</a>
            </div>
            <div className="foot-col">
              <h4>Contact info</h4>
              <div className="foot-contact">
                <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>P.O. Box 4021-00100<br />Nairobi, Kenya</div>
                <a href={`tel:${contactPhoneLink}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>{contactPhone}</a>
                <a href={`mailto:${contactEmail}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 6l-10 7L2 6" /><path d="M2 6h20v12H2z" /></svg>{contactEmail}</a>
              </div>
              <form className="newsletter" onSubmit={handleSub}>
                <input type="email" placeholder="Your email address" required />
                <button type="submit">Join</button>
              </form>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 EduOne SaaS. All rights reserved.</span>
            <span>Offline-First · CBC Compliant · Secure</span>
          </div>
        </div>
      </footer>

      <button className={`scroll-top ${showScrollTop ? 'show' : ''}`} id="scrollTop" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      </button>
    </>
  );
}
