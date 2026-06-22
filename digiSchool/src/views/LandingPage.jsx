import React, { useState } from 'react';
import { BookOpen, Layout, GraduationCap, Users, ArrowRight, ShieldCheck, Zap, Activity } from 'lucide-react';
import { USERS } from '../data/users';

const LandingPage = ({ onGetStarted, onDemoLogin, onApply }) => {
  const [activeTab, setActiveTab] = useState('principal');
  
  const getRoleUser = (role) => USERS.find(u => u.role === role);

  const roleDetails = {
    principal: { 
      title: 'Principal Portal', 
      desc: 'Get a bird\'s eye view of your entire school. Monitor daily attendance, track real-time fee collections, and oversee academic performance across all departments from one powerful glassmorphic dashboard.', 
      icon: <Layout size={48} /> 
    },
    teacher: { 
      title: 'Teacher Portal', 
      desc: 'Put the joy back into teaching. Streamline your grading process, upload assignments with ease, and communicate directly with students and parents without leaving the platform.', 
      icon: <BookOpen size={48} /> 
    },
    student: { 
      title: 'Student Portal', 
      desc: 'Your ultimate study companion. Access your daily timetable, download learning resources, and track your own academic progress in a beautifully clean, distraction-free environment.', 
      icon: <GraduationCap size={48} /> 
    },
    parent: { 
      title: 'Parent Portal', 
      desc: 'Stay connected to your child\'s education. Receive instant notifications about behavior or clinic visits, view report cards securely, and pay fees online without the hassle.', 
      icon: <Users size={48} /> 
    }
  };

  return (
    <div className="bespoke-theme">
      {/* Navbar */}
      <nav className="bespoke-nav">
        <div className="bespoke-brand">
          <img src="/logo.png" alt="EduOne Logo" style={{ height: '36px' }} />
          EduOne
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="bespoke-btn ghost" onClick={onGetStarted}>Sign in</button>
          <button className="bespoke-btn primary" onClick={onApply} style={{ background: '#10b981', borderColor: '#10b981', color: '#fff' }}>
            Apply Now
          </button>
        </div>
      </nav>

      {/* 1. Hero Section */}
      <header className="bespoke-hero">
        <div className="b-hero-badge">
          <Zap size={14} /> The Next-Generation SaaS for Education
        </div>
        <h1 className="b-hero-title">
          The unified operating system <br/>for <span>modern schools.</span>
        </h1>
        <p className="b-hero-subtitle">
          Say goodbye to fragmented tools. EduOne brings academics, finance, operations, and communication into one beautifully designed, lightning-fast platform.
        </p>
        <div style={{ marginTop: '30px', display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button className="bespoke-btn primary" onClick={onApply} style={{ padding: '16px 32px', fontSize: '18px', background: '#10b981', borderColor: '#10b981', color: '#fff' }}>
            Start Online Application
          </button>
          <button className="bespoke-btn secondary" onClick={() => document.getElementById('bento').scrollIntoView({ behavior: 'smooth' })} style={{ padding: '16px 32px', fontSize: '18px' }}>
            Explore Platform <ArrowRight size={18} />
          </button>
        </div>

        {/* Floating Glass Dashboard Visual */}
        <div className="b-hero-visual">
          <div className="b-glass-dashboard">
            <div className="b-dash-header">
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#eab308' }} />
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }} />
              </div>
              <div className="b-dash-skeleton" style={{ width: '120px' }} />
            </div>
            <div className="b-dash-grid">
              <div className="b-dash-card">
                <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Total Active Students</div>
                <div className="b-dash-skeleton" style={{ width: '80px', height: '32px', marginBottom: '4px' }} />
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px', alignItems: 'flex-end', height: '60px' }}>
                  <div style={{ width: '16%', height: '40%', background: '#e2e8f0', borderRadius: '4px' }} />
                  <div style={{ width: '16%', height: '60%', background: '#e2e8f0', borderRadius: '4px' }} />
                  <div style={{ width: '16%', height: '50%', background: '#e2e8f0', borderRadius: '4px' }} />
                  <div style={{ width: '16%', height: '80%', background: '#e2e8f0', borderRadius: '4px' }} />
                  <div style={{ width: '16%', height: '70%', background: '#e2e8f0', borderRadius: '4px' }} />
                  <div style={{ width: '16%', height: '100%', background: '#3b82f6', borderRadius: '4px' }} />
                </div>
              </div>
              <div className="b-dash-card" style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>System Status</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: '600' }}>
                  <ShieldCheck size={20} /> All Systems Operational
                </div>
                <div className="b-dash-skeleton" style={{ width: '100%', marginTop: '32px', background: 'rgba(255,255,255,0.1)' }} />
                <div className="b-dash-skeleton" style={{ width: '80%', marginTop: '12px', background: 'rgba(255,255,255,0.1)' }} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 3. Bento Grid Section */}
      <section id="bento" className="bespoke-bento">
        <div className="b-section-header">
          <h2>Everything you need, in one place.</h2>
          <p>We replaced clunky legacy software with a suite of beautiful, interconnected modules.</p>
        </div>
        
        <div className="bento-grid">
          {/* Large Card */}
          <div className="bento-card bento-large">
            <div className="bento-icon blue"><BookOpen size={24} /></div>
            <h3>Smart Academics</h3>
            <p>A buttery-smooth gradebook that calculates averages instantly. Manage complex timetables, assignments, and curriculum tracking without ever opening a spreadsheet.</p>
            <div className="bento-visual">
               <div style={{ position: 'absolute', bottom: '20px', right: '20px', left: '20px', height: '120px', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', padding: '16px' }}>
                 <div className="b-dash-skeleton" style={{ width: '40%', marginBottom: '16px' }} />
                 <div className="b-dash-skeleton" style={{ width: '100%', marginBottom: '8px' }} />
                 <div className="b-dash-skeleton" style={{ width: '80%' }} />
               </div>
            </div>
          </div>

          {/* Medium Card 1 */}
          <div className="bento-card bento-medium">
            <div className="bento-icon orange"><Layout size={24} /></div>
            <h3>Automated Operations</h3>
            <p>From admissions to staff attendance, we put your daily operations on autopilot.</p>
          </div>

          {/* Medium Card 2 */}
          <div className="bento-card bento-medium">
            <div className="bento-icon teal"><Activity size={24} /></div>
            <h3>Student Wellbeing</h3>
            <p>Securely log clinic visits and track behavioral notes with complete privacy.</p>
          </div>

          {/* Horizontal Card */}
          <div className="bento-card bento-horizontal">
            <h3>Seamless Communication</h3>
            <p>Send instant, secure notices directly to teachers, specific students, or parents without relying on scattered email threads or external messaging apps.</p>
          </div>
        </div>
      </section>

      {/* 4. Interactive Role Showcase */}
      <section className="bespoke-roles">
        <div className="b-section-header">
          <h2>Experience EduOne by Role</h2>
          <p>A unified platform that adapts to who you are. Select a role below to explore.</p>
        </div>

        <div className="b-roles-container">
          <div className="b-role-tabs">
            {['principal', 'teacher', 'student', 'parent'].map(role => (
              <button 
                key={role} 
                className={`b-role-tab ${activeTab === role ? 'active' : ''}`}
                onClick={() => setActiveTab(role)}
              >
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </button>
            ))}
          </div>

          <div className="b-role-content">
            <div className="b-role-text">
              <h3>{roleDetails[activeTab].title}</h3>
              <p>{roleDetails[activeTab].desc}</p>
              <button 
                className="bespoke-btn primary"
                onClick={() => onDemoLogin(getRoleUser(activeTab))}
              >
                Launch {roleDetails[activeTab].title.split(' ')[0]} Demo <ArrowRight size={16} />
              </button>
            </div>
            <div className="b-role-visual">
              {roleDetails[activeTab].icon}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bespoke-footer">
        <div className="b-footer-content">
          <div className="bespoke-brand" style={{ fontSize: '20px' }}>
            <img src="/logo.png" alt="EduOne Logo" style={{ height: '24px' }} />
            EduOne
          </div>
          <div>
            Crafted with precision by <strong>GovTech Builders KE</strong>
            <br />
            &copy; 2026 EduOne Technologies. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
