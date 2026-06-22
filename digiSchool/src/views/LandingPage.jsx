import React from 'react';
import { BookOpen, Layout, GraduationCap, Users, Heart, ArrowRight, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { USERS } from '../data/users';

const LandingPage = ({ onGetStarted, onDemoLogin }) => {
  const primaryRoles = ['principal', 'teacher', 'student', 'parent'];
  
  const getRoleUser = (role) => USERS.find(u => u.role === role);

  return (
    <div className="landing-container gusto-theme">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-brand">
          <GraduationCap size={28} className="accent-icon" />
          <span>EduOne</span>
        </div>
        <div className="landing-actions">
          <button className="landing-btn ghost" onClick={onGetStarted}>Sign in</button>
          <button className="landing-btn primary" onClick={() => document.getElementById('demo-section').scrollIntoView({ behavior: 'smooth' })}>See Demo</button>
        </div>
      </nav>

      {/* 1. Hero Section */}
      <header className="gusto-hero">
        <div className="hero-text-content">
          <h1 className="hero-title">
            Manage your entire school community all in one place.
          </h1>
          <p className="hero-subtitle">
            Put the joy back in school administration. Work faster and reduce errors with automated academics, operations, and finance.
          </p>
          <div className="hero-cta-group">
            <button className="landing-btn primary hero-btn" onClick={() => document.getElementById('demo-section').scrollIntoView({ behavior: 'smooth' })}>
              Try the Interactive Demo
            </button>
            <span className="hero-note">No credit card required.</span>
          </div>
        </div>
        
        {/* Dashboard Visual Illustration */}
        <div className="hero-visual-illustration">
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
              </div>
            </div>
        </div>
      </header>

      {/* 2. Trust Badges */}
      <section className="gusto-trust-badges">
        <div className="trust-grid">
          <div className="trust-item">
            <strong>#1</strong>
            <span>Best Software for Schools 2026</span>
          </div>
          <div className="trust-item">
            <strong>99.9%</strong>
            <span>System Uptime & Reliability</span>
          </div>
          <div className="trust-item">
            <strong>500+</strong>
            <span>Active Schools Nationwide</span>
          </div>
        </div>
      </section>

      {/* 3. Alternating Feature Blocks */}
      <section className="gusto-features-alternating">
        
        {/* Feature Block 1 */}
        <div className="feature-block">
          <div className="fb-text">
            <h2>Run your school in minutes with smart technology.</h2>
            <p>Academics takes just a few clicks. We automatically compile grades, help with curriculum tracking, and generate report cards to help save you hours of manual work.</p>
            <a href="#demo-section" className="text-link">Learn more about Smart Academics &rarr;</a>
          </div>
          <div className="fb-visual bg-orange">
             <BookOpen size={80} className="floating-icon" />
          </div>
        </div>

        {/* Feature Block 2 (Reversed) */}
        <div className="feature-block reversed">
          <div className="fb-text">
            <h2>Make a real difference with automated operations.</h2>
            <p>Supporting your staff is more important than ever. Automate facility scheduling, manage staff attendance, and streamline fee collections seamlessly.</p>
            <a href="#demo-section" className="text-link">Learn more about Operations &rarr;</a>
          </div>
          <div className="fb-visual bg-blue">
             <Layout size={80} className="floating-icon" />
          </div>
        </div>

        {/* Feature Block 3 */}
        <div className="feature-block">
          <div className="fb-text">
            <h2>Keep students healthy and engaged.</h2>
            <p>Find and support great students from day 1. Use EduOne for clinic records, secure parent communications, and custom behavior tracking.</p>
            <a href="#demo-section" className="text-link">Learn more about Student Wellbeing &rarr;</a>
          </div>
          <div className="fb-visual bg-teal">
             <Heart size={80} className="floating-icon" />
          </div>
        </div>

      </section>

      {/* 4. "But wait, there's more" - Demo Roles */}
      <section id="demo-section" className="gusto-more-features">
        <div className="more-features-header">
          <h2>But wait, there's more.</h2>
          <p>Choose from a variety of dedicated portals. Experience EduOne through the eyes of every stakeholder.</p>
        </div>

        <div className="role-grid-gusto">
          {primaryRoles.map(role => {
            const user = getRoleUser(role);
            if (!user) return null;
            
            const roleDetails = {
              principal: { title: 'Principal', desc: 'Oversee operations & stats', icon: <Layout size={24} />, color: 'orange' },
              teacher: { title: 'Teacher', desc: 'Gradebook & assignments', icon: <BookOpen size={24} />, color: 'blue' },
              student: { title: 'Student', desc: 'Timetables & resources', icon: <GraduationCap size={24} />, color: 'teal' },
              parent: { title: 'Parent', desc: 'Progress & fee payments', icon: <Users size={24} />, color: 'gray' }
            };
            const details = roleDetails[role];

            return (
              <div key={role} className="gusto-role-card" onClick={() => onDemoLogin(user)}>
                 <div className={`role-icon-box bg-${details.color}`}>
                   {details.icon}
                 </div>
                 <div className="role-card-text">
                   <h3>{details.title} Portal</h3>
                   <p>{details.desc}</p>
                 </div>
                 <ArrowRight className="role-arrow" size={20} />
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Social Proof / Testimonial */}
      <section className="gusto-social-proof">
        <div className="proof-container">
          <div className="proof-stat">
            <h2>Save 10 hours</h2>
            <p>on administrative tasks each week, on average compared to manual systems.¹</p>
          </div>
          <div className="proof-stat">
            <h2>"It gives me more time to focus on education."</h2>
            <p>85% of surveyed EduOne school principals.¹</p>
          </div>
          <div className="proof-stat">
            <h2>Switch to EduOne</h2>
            <p>in two weeks or less, on average, according to customers.¹</p>
          </div>
        </div>
        <p className="disclaimer">¹Based on an August 2026 survey of 450+ EduOne customers</p>
      </section>

      {/* 6. Three Steps Onboarding */}
      <section className="gusto-three-steps">
        <div className="steps-header">
          <h2>You're three steps away from a smarter school.</h2>
        </div>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Create an account.</h3>
            <p>It's free to sign up. You'll pick your module configuration and add your school details.</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Add your people.</h3>
            <p>Add your staff and student details. They can even self-onboard to save you time.</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Go live.</h3>
            <p>Once we have your school structure ready, you can go live with just a few clicks.</p>
          </div>
        </div>
        <div className="steps-cta">
          <button className="landing-btn primary hero-btn" onClick={() => document.getElementById('demo-section').scrollIntoView({ behavior: 'smooth' })}>
            Explore the Demo
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="gusto-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <GraduationCap size={24} className="accent-icon" /> <span>EduOne</span>
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
