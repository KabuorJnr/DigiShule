import React from 'react';
import { Shield, BookOpen, Activity, Layout, Terminal, Code2, Cpu } from 'lucide-react';
import { USERS } from '../data/users';

const LandingPage = ({ onGetStarted, onDemoLogin }) => {
  const primaryRoles = ['principal', 'teacher', 'student', 'parent'];
  
  const getRoleUser = (role) => USERS.find(u => u.role === role);

  return (
    <div className="landing-container">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-brand">
          <Terminal size={24} className="accent-icon" />
          <span>EduOne_</span>
        </div>
        <div className="landing-actions">
          <button className="landing-btn outline" onClick={onGetStarted}>Standard Login</button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="landing-hero">
        <div className="hero-content">
          <div className="hero-badge">v2.0 // Enterprise Ready</div>
          <h1 className="hero-title">
            The Operating System for <span className="highlight-text">Modern Education.</span>
          </h1>
          <p className="hero-subtitle">
            Execute school management with precision. From admissions and academics to finance and health—EduOne compiles your entire institution into a single, high-performance platform.
          </p>
          <div className="hero-cta">
            <button className="landing-btn primary" onClick={() => {
              document.getElementById('demo-section').scrollIntoView({ behavior: 'smooth' });
            }}>
              Initialize Demo System <Cpu size={18} style={{ marginLeft: 8 }} />
            </button>
          </div>
        </div>
        
        {/* Abstract code visual decoration */}
        <div className="hero-visual">
          <div className="code-window">
            <div className="window-header">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <pre className="code-block">
              <code>
                <span className="token keyword">import</span> {'{'} EduOne {'}'} <span className="token keyword">from</span> <span className="token string">'@school/core'</span>;{'\n\n'}
                <span className="token keyword">const</span> system = <span className="token keyword">new</span> <span className="token class-name">EduOne</span>({'{'}{'\n'}
                {'  '}modules: [<span className="token string">'Academics'</span>, <span className="token string">'Finance'</span>, <span className="token string">'Clinic'</span>],{'\n'}
                {'  '}performance: <span className="token string">'O(1)'</span>,{'\n'}
                {'  '}security: <span className="token boolean">true</span>{'\n'}
                {'}'});{'\n\n'}
                system.<span className="token function">initialize</span>().<span className="token function">then</span>(() =&gt; {'{'}{'\n'}
                {'  '}console.<span className="token function">log</span>(<span className="token string">'Institution is live.'</span>);{'\n'}
                {'}'});
              </code>
            </pre>
          </div>
        </div>
      </header>

      {/* Features Grid */}
      <section className="landing-features">
        <h2 className="section-title">Core Modules Executed <span className="highlight-text">Flawlessly</span></h2>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon"><BookOpen size={24} /></div>
            <h3>Academics Engine</h3>
            <p>Compute grades, manage CBC curriculum, and generate insightful analytics for every student.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Layout size={24} /></div>
            <h3>Resource Allocation</h3>
            <p>Schedule classes, assign teachers, and manage venues to optimize your operational bandwidth.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Activity size={24} /></div>
            <h3>Health & Discipline</h3>
            <p>Real-time telemetry on student wellbeing, clinic visits, and disciplinary logs.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Shield size={24} /></div>
            <h3>Role-Based Auth</h3>
            <p>Cryptographically secure access control tailored for principals, teachers, students, and parents.</p>
          </div>
        </div>
      </section>

      {/* Demo Quick Access */}
      <section id="demo-section" className="landing-demo">
        <h2 className="section-title">Test Drive the <span className="highlight-text">Ecosystem</span></h2>
        <p className="section-subtitle">No configuration required. Select a role below to boot a demo session instantly.</p>
        
        <div className="demo-roles">
          {primaryRoles.map(role => {
            const user = getRoleUser(role);
            if (!user) return null;
            return (
              <button key={role} className="role-card" onClick={() => onDemoLogin(user)}>
                <div className="role-header">
                  <h3>{user.name}</h3>
                  <span className="role-badge">{role}</span>
                </div>
                <div className="role-details">
                  <span className="role-dept">{user.dept}</span>
                  <span className="role-action">Boot Session &rarr;</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <Terminal size={18} className="accent-icon" /> EduOne_
          </div>
          <div className="footer-links">
            <span>© 2026 Advanced Agentic Solutions</span>
            <span>v2.0.4-stable</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
