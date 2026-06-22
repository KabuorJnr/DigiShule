import React from 'react';
import { BookOpen, Layout, GraduationCap, Users, Heart, ArrowRight, CheckCircle2, DollarSign, Activity, FileText } from 'lucide-react';
import { USERS } from '../data/users';

const LandingPage = ({ onGetStarted, onDemoLogin }) => {
  const primaryRoles = ['principal', 'teacher', 'student', 'parent'];
  
  const getRoleUser = (role) => USERS.find(u => u.role === role);

  return (
    <div className="landing-container">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-brand">
          <GraduationCap size={28} className="accent-icon" />
          <span>EduOne</span>
        </div>
        <div className="landing-actions">
          <button className="landing-btn outline" onClick={onGetStarted}>Standard Login</button>
        </div>
      </nav>

      {/* 1. Hero Section */}
      <header className="landing-hero-banner">
        <div className="hero-content">
          <h1 className="hero-title">
            Empower Your School with <span className="highlight-text">Smart Education</span>
          </h1>
          <p className="hero-subtitle">
            Manage academics, admissions, finance, and student health seamlessly. EduOne brings your entire school community together on one beautiful, easy-to-use platform.
          </p>
          <button className="landing-btn primary hero-cta" onClick={() => {
            document.getElementById('demo-section').scrollIntoView({ behavior: 'smooth' });
          }}>
            Try the Interactive Demo
          </button>
        </div>
      </header>

      {/* 2. Quick Links (Features) Section */}
      <section className="landing-quick-links">
        <div className="quick-links-grid">
          <div className="quick-link-item">
            <div className="ql-icon orange"><BookOpen size={32} /></div>
            <h2>Smart Academics</h2>
            <div className="ql-actions">
              <a href="#demo-section" className="ql-btn">Timetables & Gradebook &rarr;</a>
              <a href="#demo-section" className="ql-btn">Assignments & Resources &rarr;</a>
            </div>
          </div>
          <div className="quick-link-item">
            <div className="ql-icon gray"><Layout size={32} /></div>
            <h2>School Operations</h2>
            <div className="ql-actions">
              <a href="#demo-section" className="ql-btn">Staff Management &rarr;</a>
              <a href="#demo-section" className="ql-btn">Facilities & Calendars &rarr;</a>
            </div>
          </div>
          <div className="quick-link-item">
            <div className="ql-icon light-blue"><DollarSign size={32} /></div>
            <h2>Finance Management</h2>
            <div className="ql-actions">
              <a href="#demo-section" className="ql-btn">Automated Invoicing &rarr;</a>
              <a href="#demo-section" className="ql-btn">Online Fee Collections &rarr;</a>
            </div>
          </div>
          <div className="quick-link-item">
            <div className="ql-icon blue"><Activity size={32} /></div>
            <h2>Student Wellbeing</h2>
            <div className="ql-actions">
              <a href="#demo-section" className="ql-btn">Clinic Records &rarr;</a>
              <a href="#demo-section" className="ql-btn">Secure Notifications &rarr;</a>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Stats Section */}
      <section className="landing-stats-section">
        <div className="stats-container">
          <div className="stats-visual">
            <div className="dashboard-preview glass-panel">
              <div className="preview-header">
                <div className="preview-nav">
                  <span className="active">Overview</span>
                  <span>Academics</span>
                  <span>Finance</span>
                </div>
                <div className="preview-avatar"></div>
              </div>
              <div className="preview-body">
                <div className="preview-top-cards">
                  <div className="preview-card glass-panel" style={{ flex: 1 }}>
                    <div className="preview-card-title">Total Students</div>
                    <div className="preview-card-value">1,248</div>
                    <div className="preview-card-trend positive">+12 this term</div>
                  </div>
                  <div className="preview-card glass-panel" style={{ flex: 1 }}>
                    <div className="preview-card-title">Fee Collection</div>
                    <div className="preview-card-value">85%</div>
                    <div className="preview-card-trend">On track</div>
                  </div>
                </div>
                <div className="preview-chart glass-panel">
                  <div className="preview-chart-bars">
                    <div className="bar" style={{ height: '60%' }}></div>
                    <div className="bar" style={{ height: '80%' }}></div>
                    <div className="bar" style={{ height: '40%' }}></div>
                    <div className="bar" style={{ height: '90%' }}></div>
                    <div className="bar" style={{ height: '70%' }}></div>
                    <div className="bar" style={{ height: '100%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="stats-content">
            <h2>Run your school efficiently with EduOne</h2>
            <hr className="stats-divider" />
            <ul className="stats-list">
              <li>
                <span>more than</span>
                <strong><span>99</span>%</strong>
                <p>System uptime and reliability for uninterrupted learning</p>
              </li>
              <li>
                <span>trusted by</span>
                <strong><span>500</span>+</strong>
                <p>Schools across the country using our platform daily</p>
              </li>
              <li>
                <span>over</span>
                <strong><span>100</span>k</strong>
                <p>Active daily users including parents, teachers and students</p>
              </li>
            </ul>
            <div className="stats-cta">
              <button className="landing-btn outline" onClick={() => document.getElementById('demo-section').scrollIntoView({ behavior: 'smooth' })}>
                What makes EduOne unique?
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Select Your Path (Text Block) */}
      <section className="landing-path-text">
        <div className="path-text-container">
          <h2>Experience EduOne by Role</h2>
          <p>At EduOne, we are driven by a strong commitment to empower everyone involved in the education ecosystem. As a unified platform, we embrace accessibility and flexibility, delivering exceptional tools for administrators, teachers, parents, and students. Choose the portal that fits your role to explore the demo!</p>
        </div>
      </section>

      {/* 5. Offerings / Role Cards Grid */}
      <section id="demo-section" className="landing-offerings">
        <div className="offerings-grid">
          {primaryRoles.map(role => {
            const user = getRoleUser(role);
            if (!user) return null;
            
            const roleDetails = {
              principal: { title: 'Principal Portal', desc: 'Oversee school operations, view global statistics, and manage staff efficiently.', icon: <Layout size={32} /> },
              teacher: { title: 'Teacher Portal', desc: 'Streamline your gradebook, assignments, and communicate with students.', icon: <BookOpen size={32} /> },
              student: { title: 'Student Portal', desc: 'Access your timetable, download resources, and track your performance.', icon: <GraduationCap size={32} /> },
              parent: { title: 'Parent Portal', desc: 'Stay updated on your child\'s progress, notices, and securely pay fees online.', icon: <Users size={32} /> }
            };
            const details = roleDetails[role];

            return (
              <div key={role} className={`offering-card ${role}`} onClick={() => onDemoLogin(user)}>
                <div className="offering-icon">
                  {details.icon}
                </div>
                <h3>{details.title}</h3>
                <div className="offering-accent"></div>
                <p>{details.desc}</p>
                <span className="offering-btn">Log in as {user.name} &rarr;</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Testimonial Section */}
      <section className="landing-testimonial">
        <div className="testimonial-container">
          <div className="testimonial-photo">
            {/* A placeholder for the photo, matching the AU style */}
            <div className="photo-placeholder"></div>
          </div>
          <div className="testimonial-quote">
            <blockquote>
              <p><span>&ldquo;</span> I chose EduOne for the flexibility and the ability to seamlessly connect our entire school. During a busy term, our teachers can easily manage grades, and parents love the online fee payment. It has truly transformed our administrative processes. <span>&rdquo;</span></p>
            </blockquote>
            <span className="attribution">
              <strong>Dr. Jane Kamau</strong>
              <em>School Principal</em>
            </span>
          </div>
        </div>
      </section>

      {/* 7. Accent Banner Section */}
      <section className="landing-accent-banner">
        <div className="banner-content">
          <h2>Ready to transform your school?</h2>
          <p>EduOne provides all the tools you need to build a smarter, more connected educational community. Start your journey with us today and experience the difference.</p>
          <button className="landing-btn primary" onClick={() => document.getElementById('demo-section').scrollIntoView({ behavior: 'smooth' })}>
            Schedule a Live Demo
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <GraduationCap size={18} className="accent-icon" /> EduOne
          </div>
          <div className="footer-links">
            <span>Built by <strong>GovTech Builders KE</strong></span>
            <span>© 2026 EduOne Technologies</span>
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
