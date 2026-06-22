import React from 'react';
import { BookOpen, Layout, GraduationCap, Users, Heart, ArrowRight } from 'lucide-react';
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

      {/* Hero Section */}
      <header className="landing-hero">
        <div className="hero-content">
          <div className="hero-badge">Trusted by 500+ Schools</div>
          <h1 className="hero-title">
            Empower Your School with <span className="highlight-text">Smart Education.</span>
          </h1>
          <p className="hero-subtitle">
            Manage academics, admissions, finance, and student health seamlessly. EduOne brings your entire school community together on one beautiful, easy-to-use platform.
          </p>
          <div className="hero-cta">
            <button className="landing-btn primary" onClick={() => {
              document.getElementById('demo-section').scrollIntoView({ behavior: 'smooth' });
            }}>
              Try the Interactive Demo <ArrowRight size={18} style={{ marginLeft: 8 }} />
            </button>
          </div>
        </div>
        
        {/* Dashboard visual decoration */}
        <div className="hero-visual">
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
      </header>

      {/* Features Grid */}
      <section className="landing-features">
        <h2 className="section-title">Everything you need to <span className="highlight-text">run your school</span></h2>
        <div className="feature-grid">
          <div className="feature-card glass-panel">
            <div className="feature-icon"><BookOpen size={24} /></div>
            <h3>Smart Academics</h3>
            <p>Streamline grading, attendance, and curriculum tracking to ensure every student reaches their full potential.</p>
          </div>
          <div className="feature-card glass-panel">
            <div className="feature-icon"><Layout size={24} /></div>
            <h3>School Operations</h3>
            <p>Effortlessly schedule classes, manage staff, and coordinate school resources from one centralized dashboard.</p>
          </div>
          <div className="feature-card glass-panel">
            <div className="feature-icon"><Heart size={24} /></div>
            <h3>Student Wellbeing</h3>
            <p>Keep track of clinic visits, health records, and student behavior in a secure, confidential system.</p>
          </div>
          <div className="feature-card glass-panel">
            <div className="feature-icon"><Users size={24} /></div>
            <h3>Connected Community</h3>
            <p>Dedicated, easy-to-use portals for principals, teachers, students, and parents to stay engaged and informed.</p>
          </div>
        </div>
      </section>

      {/* Demo Quick Access */}
      <section id="demo-section" className="landing-demo">
        <h2 className="section-title">Experience <span className="highlight-text">EduOne</span></h2>
        <p className="section-subtitle">No configuration required. Select a role below to explore the platform instantly.</p>
        
        <div className="demo-roles">
          {primaryRoles.map(role => {
            const user = getRoleUser(role);
            if (!user) return null;
            return (
              <button key={role} className="role-card glass-panel" onClick={() => onDemoLogin(user)}>
                <div className="role-header">
                  <h3>{user.name}</h3>
                  <span className="role-badge">{role}</span>
                </div>
                <div className="role-details">
                  <span className="role-dept">{user.dept}</span>
                  <span className="role-action">Log in &rarr;</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

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
