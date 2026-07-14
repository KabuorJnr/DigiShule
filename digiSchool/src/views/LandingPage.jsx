import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const [showAnnounce, setShowAnnounce] = useState(true);
  const [feeTab, setFeeTab] = useState('junior');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeCell, setActiveCell] = useState(-1);
  const [ttNow, setTtNow] = useState('—');
  const [ttLabel, setTtLabel] = useState('In session');

  const contactPhone = "+254 701 402265";
  const contactPhoneLink = "+254701402265";
  const contactEmail = "veribidapp@gmail.com";

  // Build the live timetable logic
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const periods = [
    { t: '08:00', subs: ['Math', 'English', 'Biology', 'History', 'Homeroom'] },
    { t: '09:15', subs: ['English', 'Math', 'Chemistry', 'Geography', 'Art'] },
    { t: '10:45', subs: ['Biology', 'Physics', 'Math', 'English', 'Music'] },
    { t: '11:30', subs: ['Study Hall', 'Study Hall', 'Study Hall', 'Study Hall', 'Study Hall'] },
    { t: '13:00', subs: ['History', 'Chemistry', 'English', 'Math', 'Elective'] },
    { t: '14:15', subs: ['Elective', 'Biology', 'Physics', 'Chemistry', 'Clubs'] }
  ];

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // highlight "now"
    const now = new Date();
    let dayIdx = now.getDay() - 1; // Mon=0
    if (dayIdx < 0 || dayIdx > 4) dayIdx = 0; // weekend demo defaults to Monday
    const hour = now.getHours() + now.getMinutes() / 60;
    const bounds = [8, 9.25, 10.75, 11.5, 13, 14.25, 15.5];
    let periodIdx = bounds.findIndex((b, i) => hour >= b && hour < bounds[i + 1]);
    if (periodIdx === -1) periodIdx = 0;

    const rowOffset = 6; // header row width
    const targetIndex = (periodIdx + 1) * rowOffset + (dayIdx + 1);
    
    setActiveCell(targetIndex);
    setTtNow(days[dayIdx] + ' · ' + periods[periodIdx].t);
    setTtLabel(periods[periodIdx].subs[dayIdx] + ' — in session');
  }, []); // Run once on mount

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
              Student &amp; Parent Portal
            </a>
          </div>
        </div>
      </div>

      {showAnnounce && (
        <div className="announce" id="announceBar">
          <div className="wrap announce-inner">
            <span className="badge">NEW</span>
            <span>Enrollment for Term 2, 2026 is open — limited live-class seats.</span>
            <a href="#enroll" className="link">Apply now →</a>
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
                <a href="#why">About <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg></a>
                <div className="dropdown">
                  <a href="#why">Our approach</a>
                  <a href="#stories">Accreditation</a>
                  <a href="#">Our teachers</a>
                  <a href="#">Governance</a>
                </div>
              </div>
              <div className="nav-item">
                <a href="#programs">Academics <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg></a>
                <div className="dropdown">
                  <a href="#programs">Programs</a>
                  <a href="#how">Weekly timetable</a>
                  <a href="#">CBC curriculum</a>
                  <a href="#">Clubs &amp; activities</a>
                </div>
              </div>
              <div className="nav-item">
                <a href="#enroll">Admissions <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg></a>
                <div className="dropdown">
                  <a href="#how">How it works</a>
                  <a href="#enroll">Start application</a>
                  <a href="#">Credit recovery</a>
                </div>
              </div>
              <a href="#fees">Fees</a>
              <a href="#stories">Life @ EduOne</a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="btn btn-ghost nav-cta" onClick={() => navigate('/login')}>Sign In</button>
              <button className="btn btn-primary nav-cta" onClick={() => navigate('/apply')}>Apply now</button>
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
              <div className="eyebrow">Grades 3–12 · Fully accredited</div>
              <h1>School that fits<br />your day, not the<br /><em>other way</em> around.</h1>
              <p className="lede">EduOne is a live, accredited virtual school. Real teachers, real classmates, a real diploma — attended from wherever the day takes you.</p>
              <div className="hero-actions">
                <button onClick={() => navigate('/apply')} className="btn btn-primary">Enroll for this term</button>
                <a href="#how" className="btn btn-ghost">See a sample day</a>
              </div>
              <div className="hero-note"><span className="live-dot"></span> 214 classes in session right now</div>
            </div>

            <div className="tt-card">
              <div className="tt-head">
                <span className="label">This week's timetable</span>
                <span className="status"><span className="live-dot"></span>Live</span>
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
              <div className="stat"><div className="num">1:8</div><div className="cap">Teacher-to-student ratio</div></div>
              <div className="stat"><div className="num">96%</div><div className="cap">Course completion rate</div></div>
              <div className="stat"><div className="num">3–12</div><div className="cap">Grade levels served</div></div>
              <div className="stat"><div className="num">0</div><div className="cap">Tuition, always</div></div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="sec" id="how">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">Enrollment</div>
              <h2>Four steps between here and your first class.</h2>
              <p>It's a real intake process, not a form that vanishes into an inbox. Most families finish it in under a week.</p>
            </div>
            <div className="steps">
              <div className="step"><span className="n">01</span><h3>Apply</h3><p>Tell us the grade, the goals, and any credits already earned. Ten minutes, no fee.</p></div>
              <div className="step"><span className="n">02</span><h3>Meet your coach</h3><p>A success coach reviews transcripts and calls within 48 hours to plan the term.</p></div>
              <div className="step"><span className="n">03</span><h3>Build the schedule</h3><p>Pick live sections around the hours that already work — sport, work, timezone, whatever.</p></div>
              <div className="step"><span className="n">04</span><h3>Start Monday</h3><p>Login, camera on, roll call. Same structure as any first day, minus the commute.</p></div>
            </div>
          </div>
        </section>

        {/* PROGRAMS */}
        <section className="sec" id="programs" style={{ background: 'var(--bg-2)' }}>
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">Programs</div>
              <h2>One school, three stages, built for each one.</h2>
              <p>Pacing and support look different at 9 than at 17 — the program structure reflects that.</p>
            </div>
            <div className="programs">
              <div className="prog-card">
                <div className="grade">GRADE 1–6</div>
                <h3>Primary</h3>
                <ul>
                  <li>Literacy, numeracy &amp; CBC core competencies</li>
                  <li>Guided live circle time, daily</li>
                  <li>Parent portal with weekly progress notes</li>
                </ul>
              </div>
              <div className="prog-card">
                <div className="grade">GRADE 7–9</div>
                <h3>Junior School</h3>
                <ul>
                  <li>Subject-specialist teachers per learning area</li>
                  <li>Clubs: robotics, debate, student council</li>
                  <li>Pathway exploration begins ahead of Grade 10</li>
                </ul>
              </div>
              <div className="prog-card">
                <div className="grade">GRADE 10–12</div>
                <h3>Senior School</h3>
                <ul>
                  <li>STEM, Social Sciences &amp; Arts pathways</li>
                  <li>Career &amp; college-prep certification tracks</li>
                  <li>Flexible pacing for athletes &amp; working students</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* WHY */}
        <section className="sec" id="why">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">Why virtual, why EduOne</div>
              <h2>Everything a school has — minus the building.</h2>
            </div>
            <div className="features">
              <div className="feat"><span className="mark">◆</span><h3>Certified teachers, live</h3><p>Every core course is taught on camera by a certified teacher, not a pre-recorded module.</p></div>
              <div className="feat"><span className="mark">◆</span><h3>A named success coach</h3><p>One person tracks your term, flags a slipping grade before report cards do, and answers the phone.</p></div>
              <div className="feat"><span className="mark">◆</span><h3>Clubs that meet in real time</h3><p>Robotics, debate, book club, student council — same clubs, same rivalries, on a screen.</p></div>
              <div className="feat"><span className="mark">◆</span><h3>Credit recovery, built in</h3><p>Behind on a course? Retake just the units you need, not the whole year over again.</p></div>
              <div className="feat"><span className="mark">◆</span><h3>Built around a training schedule</h3><p>Student-athletes and performers keep full course loads around competition and rehearsal hours.</p></div>
              <div className="feat"><span className="mark">◆</span><h3>A diploma that reads the same</h3><p>Fully accredited — transcripts and diplomas are recognized exactly like any campus school's.</p></div>
            </div>
          </div>
        </section>

        {/* FEES */}
        <section className="sec" id="fees">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">Fees, honestly</div>
              <h2>Tuition-free. Here's the full picture, not just the headline.</h2>
              <p>Select a level to see exactly what's covered and what's optional — no fine print later.</p>
            </div>

            <div className="fee-tabs">
              <button className={`fee-tab ${feeTab === 'junior' ? 'active' : ''}`} onClick={() => setFeeTab('junior')}>Junior School · Grade 7–9</button>
              <button className={`fee-tab ${feeTab === 'senior' ? 'active' : ''}`} onClick={() => setFeeTab('senior')}>Senior School · Grade 10–12</button>
              <button className={`fee-tab ${feeTab === 'primary' ? 'active' : ''}`} onClick={() => setFeeTab('primary')}>Primary · Grade 1–6</button>
            </div>

            <div className={`fee-panel ${feeTab === 'junior' ? 'active' : ''}`}>
              <div className="ledger">
                <div className="ledger-head"><h3>Junior School</h3><span>PER TERM</span></div>
                <div className="ledger-row"><span className="item">Tuition (all core subjects)</span><span className="val">KES 0</span></div>
                <div className="ledger-row"><span className="item">Loaned learning device</span><span className="val">KES 0</span></div>
                <div className="ledger-row"><span className="item">Data bundle stipend</span><span className="val">Included</span></div>
                <div className="ledger-row"><span className="item">CBC assessment materials</span><span className="val">KES 0</span></div>
                <div className="ledger-row"><span className="item">Optional: club kits &amp; trips</span><span className="val opt">From KES 1,200</span></div>
                <div className="ledger-total"><span>Required per term</span><span className="val">KES 0</span></div>
              </div>
              <p className="fee-note">Families cover any personal stationery. Everything needed to attend and complete the term is provided.</p>
            </div>

            <div className={`fee-panel ${feeTab === 'senior' ? 'active' : ''}`}>
              <div className="ledger">
                <div className="ledger-head"><h3>Senior School</h3><span>PER TERM</span></div>
                <div className="ledger-row"><span className="item">Tuition (pathway subjects)</span><span className="val">KES 0</span></div>
                <div className="ledger-row"><span className="item">Loaned learning device</span><span className="val">KES 0</span></div>
                <div className="ledger-row"><span className="item">Data bundle stipend</span><span className="val">Included</span></div>
                <div className="ledger-row"><span className="item">Career &amp; certification exam fees</span><span className="val opt">At cost</span></div>
                <div className="ledger-row"><span className="item">Optional: college-prep coaching</span><span className="val opt">From KES 2,500</span></div>
                <div className="ledger-total"><span>Required per term</span><span className="val">KES 0</span></div>
              </div>
              <p className="fee-note">National exam and external certification fees are passed through at cost — we don't mark them up.</p>
            </div>

            <div className={`fee-panel ${feeTab === 'primary' ? 'active' : ''}`}>
              <div className="ledger">
                <div className="ledger-head"><h3>Primary</h3><span>PER TERM</span></div>
                <div className="ledger-row"><span className="item">Tuition (all subjects)</span><span className="val">KES 0</span></div>
                <div className="ledger-row"><span className="item">Loaned learning device</span><span className="val">KES 0</span></div>
                <div className="ledger-row"><span className="item">Data bundle stipend</span><span className="val">Included</span></div>
                <div className="ledger-row"><span className="item">Guided live circle-time materials</span><span className="val">KES 0</span></div>
                <div className="ledger-row"><span className="item">Optional: printed workbook set</span><span className="val opt">From KES 900</span></div>
                <div className="ledger-total"><span>Required per term</span><span className="val">KES 0</span></div>
              </div>
              <p className="fee-note">A parent or guardian co-signs the term plan at this level to support daily login and pacing.</p>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="sec" id="stories" style={{ background: 'var(--bg-2)' }}>
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">From current families</div>
              <h2>What a term actually looks like.</h2>
            </div>
            <div className="quotes">
              <div className="quote">
                <p className="q">"My coach caught my slipping algebra grade in week three, not at the end of term. That call changed the whole semester."</p>
                <div className="who"><b>Amani K.</b>Grade 10, since 2024</div>
              </div>
              <div className="quote">
                <p className="q">"I train mornings and take live classes after. First term I've finished with a full course load and no burnout."</p>
                <div className="who"><b>Faith N.</b>Grade 11, swim program</div>
              </div>
              <div className="quote">
                <p className="q">"The weekly notes tell me more about my son's term than any report card I ever got from his old school."</p>
                <div className="who"><b>D. Owino</b>Parent, Grade 5 student</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta-band" id="enroll">
          <div className="wrap cta-inner">
            <div>
              <h2>Enrollment for Term 2 is open now.</h2>
              <p className="sub">Tuition-free, fully accredited, grades 3–12. Applications close two weeks before term start.</p>
            </div>
            <div className="cta-actions">
              <button onClick={() => navigate('/apply')} className="btn btn-primary">Start application</button>
              <button onClick={() => navigate('/login')} className="btn btn-ghost">Talk to a coach</button>
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
              <p>A fully accredited, tuition-free virtual school for grades 1–12. Class is always in session.</p>
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
              <a href="#why">About us</a>
              <a href="#programs">Academics</a>
              <a href="#enroll">Admissions</a>
              <a href="#fees">Fees</a>
            </div>
            <div className="foot-col">
              <h4>Academics</h4>
              <a href="#programs">Primary</a>
              <a href="#programs">Junior school</a>
              <a href="#programs">Senior school</a>
              <a href="#how">Weekly timetable</a>
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
            <span>© 2026 EduOne. All classes in session.</span>
            <span>Grades 1–12 · Tuition-free · Fully accredited</span>
          </div>
        </div>
      </footer>

      <button className={`scroll-top ${showScrollTop ? 'show' : ''}`} id="scrollTop" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      </button>
    </>
  );
}
