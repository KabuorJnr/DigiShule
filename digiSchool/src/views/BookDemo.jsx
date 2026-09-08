import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSEO } from '../lib/seo';
import './LandingPage.css';

const I = {
  check: 'M20 6L9 17l-5-5',
  arrowL: 'M19 12H5M11 18l-6-6 6-6',
  clock2: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  layers: ['M12 2l9 5-9 5-9-5 9-5z', 'M3 12l9 5 9-5', 'M3 17l9 5 9-5'],
  chat: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  tag: ['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', 'M7 7h.01'],
  big: 'M20 6L9 17l-5-5',
};

function Ico({ d, className }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

export default function BookDemo() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  useSEO({
    title: 'Book a Live Demo — EduOne',
    description: 'Book a personalised 30-minute walkthrough of EduOne and see how it automates fees, CBC grading and parent communication for your school.',
    path: '/book-demo',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // The form intentionally resolves client-side for now; wire to a backend
    // (Supabase table / email) when the demo-request pipeline is ready.
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="eo">
      {/* header */}
      <header className="eo-demohdr">
        <div className="eo-wrap eo-nav">
          <a href="/" className="eo-logo" aria-label="EduOne home" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
            <img src="/logo.png" alt="EduOne" className="eo-logo-img" />
          </a>
          <div className="eo-demohdr-right">
            <a href="/" className="eo-back" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
              <Ico d={I.arrowL} className="eo-i-xs" /> Back to home
            </a>
            <button className="eo-btn eo-btn-primary" onClick={() => navigate('/signup')}>Start free trial</button>
          </div>
        </div>
      </header>

      {/* hero + form */}
      <section className="eo-hero eo-demo-hero">
        <div className="eo-wrap eo-demo-grid">
          <div className="eo-hero-copy eo-demo-copy">
            <div className="eo-eyebrow"><span className="eo-dot" /> Book a demo</div>
            <h1>See EduOne <span className="eo-grad">in action.</span></h1>
            <p className="eo-lede">
              Get a personalised walkthrough tailored to your school. We&apos;ll show you exactly how EduOne automates fees, CBC grading and parent communication - and answer every question your team has.
            </p>
            <ul className="eo-demo-list">
              <li><Ico d={I.clock2} /><span><b>30-minute live walkthrough</b>At a time that suits your team.</span></li>
              <li><Ico d={I.layers} /><span><b>Tailored to your school</b>We focus on the modules that matter to you.</span></li>
              <li><Ico d={I.chat} /><span><b>Real answers, no pressure</b>Ask anything - onboarding, migration, security.</span></li>
              <li><Ico d={I.tag} /><span><b>Clear, honest pricing</b>A plan that fits your size and budget.</span></li>
            </ul>
          </div>

          <div className="eo-formcard">
            {submitted ? (
              <div className="eo-demo-success">
                <span className="eo-success-ico"><Ico d={I.big} /></span>
                <h2>Request received!</h2>
                <p>Thank you - our team will reach out within 24 hours to schedule your demo. Keep an eye on your inbox.</p>
                <button className="eo-btn eo-btn-primary eo-btn-lg" style={{ marginTop: 22 }} onClick={() => navigate('/')}>Back to home</button>
              </div>
            ) : (
              <>
                <h2>Request your demo</h2>
                <p className="eo-formcard-sub">Fill in your details and we&apos;ll be in touch shortly.</p>
                <form className="eo-form" onSubmit={handleSubmit}>
                  <div className="eo-field">
                    <label htmlFor="name">Full name</label>
                    <input id="name" name="name" type="text" required placeholder="Jane Otieno" />
                  </div>
                  <div className="eo-field">
                    <label htmlFor="role">Your role</label>
                    <select id="role" name="role" defaultValue="">
                      <option value="" disabled>Select role</option>
                      <option>Principal / Head Teacher</option>
                      <option>Director / Owner</option>
                      <option>Deputy Head</option>
                      <option>Bursar / Finance</option>
                      <option>ICT / Administrator</option>
                      <option>Teacher</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="eo-field full">
                    <label htmlFor="school">School name</label>
                    <input id="school" name="school" type="text" required placeholder="Greenhill Academy" />
                  </div>
                  <div className="eo-field">
                    <label htmlFor="email">Email</label>
                    <input id="email" name="email" type="email" required placeholder="you@school.co.ke" />
                  </div>
                  <div className="eo-field">
                    <label htmlFor="phone">Phone</label>
                    <input id="phone" name="phone" type="tel" required placeholder="+254 7xx xxx xxx" />
                  </div>
                  <div className="eo-field">
                    <label htmlFor="learners">Number of learners</label>
                    <select id="learners" name="learners" defaultValue="">
                      <option value="" disabled>Select size</option>
                      <option>Under 250</option>
                      <option>250 - 800</option>
                      <option>800 - 2,000</option>
                      <option>Over 2,000</option>
                    </select>
                  </div>
                  <div className="eo-field">
                    <label htmlFor="when">Preferred time</label>
                    <input id="when" name="when" type="text" placeholder="e.g. Weekday mornings" />
                  </div>
                  <div className="eo-field full">
                    <label htmlFor="message">Anything specific? (optional)</label>
                    <textarea id="message" name="message" placeholder="Tell us what you'd like to see..." />
                  </div>
                  <button type="submit" className="eo-btn eo-btn-primary eo-btn-lg">Request my demo</button>
                  <p className="eo-form-note">No commitment. We&apos;ll never share your details.</p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      {/* slim footer */}
      <footer className="eo-footer">
        <div className="eo-wrap">
          <div className="eo-foot-bottom" style={{ borderTop: 'none', paddingTop: 0 }}>
            <a href="/" className="eo-logo eo-logo-foot" aria-label="EduOne home" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
              <img src="/logo.png" alt="EduOne" className="eo-logo-img" />
            </a>
            <span>© 2026 EduOne · Offline-first · CBC compliant · Secure</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
