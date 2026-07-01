import React, { useState } from 'react';
import { BookOpen, Layout, GraduationCap, Users, ArrowRight, Zap, WifiOff, FileText, Camera, ShieldCheck, CheckCircle2 } from 'lucide-react';
import './LandingPage.css';

export default function LandingPage({ onGetStarted, onApply, onSignUp }) {
  const [activeTab, setActiveTab] = useState('principal');

  const roleDetails = {
    principal: { 
      title: 'Principal Portal', 
      desc: 'Get a bird\'s eye view of your entire school. Monitor daily attendance, track real-time fee collections, and oversee academic performance across all departments from one powerful, glassmorphic dashboard.', 
      icon: <Layout size={48} /> 
    },
    teacher: { 
      title: 'Teacher Portal', 
      desc: 'Put the joy back into teaching. Streamline your grading process, upload assignments with ease, and record attendance even when the internet goes down thanks to our Offline-First engine.', 
      icon: <BookOpen size={48} /> 
    },
    student: { 
      title: 'Student Portal', 
      desc: 'Your ultimate study companion. Access your daily timetable, download learning resources, and track your own academic progress in a beautifully clean, distraction-free environment.', 
      icon: <GraduationCap size={48} /> 
    },
    parent: { 
      title: 'Parent Portal', 
      desc: 'Stay connected to your child\'s education. Receive instant SMS notifications, view report cards securely, and scroll through the school\'s photo gallery without eating up your mobile data.', 
      icon: <Users size={48} /> 
    }
  };

  return (
    <div className="bespoke-theme">
      {/* Navbar */}
      <nav className="bespoke-nav animate-fade-in-up">
        <div className="bespoke-brand">
          <ShieldCheck size={28} style={{ color: '#2563eb' }} />
          EduOne
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="bespoke-btn ghost" onClick={onGetStarted}>Sign In</button>
          <button className="bespoke-btn secondary" onClick={onSignUp}>Sign Up</button>
          <button className="bespoke-btn primary" onClick={onApply}>
            Apply Now
          </button>
        </div>
      </nav>

      {/* 1. Hero Section */}
      <header className="bespoke-hero">
        <div className="b-hero-badge animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <Zap size={14} /> The Next-Generation SaaS for African Schools
        </div>
        <h1 className="b-hero-title animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          The operating system <br/>for <span>modern schools.</span>
        </h1>
        <p className="b-hero-subtitle animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          Say goodbye to fragmented tools and internet outages. EduOne brings academics, finance, and parent communication into one beautifully designed, lightning-fast platform that works offline.
        </p>
        <div className="animate-fade-in-up" style={{ marginTop: '30px', display: 'flex', gap: '16px', justifyContent: 'center', animationDelay: '0.4s' }}>
          <button className="bespoke-btn primary" onClick={onApply} style={{ padding: '16px 32px', fontSize: '18px' }}>
            Start Online Application
          </button>
          <button className="bespoke-btn secondary" onClick={() => document.getElementById('bento').scrollIntoView({ behavior: 'smooth' })} style={{ padding: '16px 32px', fontSize: '18px' }}>
            Explore Features <ArrowRight size={18} />
          </button>
        </div>

        {/* Floating Glass Dashboard Visual */}
        <div className="b-hero-visual animate-fade-in-up animate-float" style={{ animationDelay: '0.6s' }}>
          <img src="/dashboard_mockup.png" alt="EduOne System Dashboard" />
        </div>
      </header>

      {/* 3. Bento Grid Section */}
      <section id="bento" className="bespoke-bento">
        <div className="b-section-header">
          <h2>Everything you need, in one place.</h2>
          <p>We replaced clunky legacy software with a suite of beautiful, interconnected modules designed for reliability.</p>
        </div>
        
        <div className="bento-grid">
          {/* Large Card: Offline Sync */}
          <div className="bento-card bento-large">
            <div className="bento-icon blue"><WifiOff size={24} /></div>
            <h3>True Offline-First Resilience</h3>
            <p>Don't let rural internet outages disrupt your school. Our cutting-edge IndexedDB engine allows teachers to input hundreds of grades and take attendance completely offline. The moment your WiFi returns, EduOne automatically syncs everything securely to the cloud.</p>
            <div style={{ marginTop: 40, padding: 20, background: 'rgba(255,255,255,0.8)', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(37,99,235,0.1)' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                 <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }}></div>
                 <span style={{ fontWeight: 600, color: '#0f172a' }}>Connection Lost</span>
               </div>
               <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, fontSize: 14, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                 <span>Saving 45 marks to local cache...</span>
                 <CheckCircle2 size={18} color="#10b981" />
               </div>
            </div>
          </div>

          {/* Medium Card 1: CBC/KNEC */}
          <div className="bento-card bento-medium">
            <div className="bento-icon orange"><FileText size={24} /></div>
            <h3>1-Click KNEC & CBC Reports</h3>
            <p>Generate beautiful, compliant PDF report cards with value-addition graphs and automated grading rubrics. Instantly export CSV files formatted perfectly for the government NEMIS portal.</p>
          </div>

          {/* Medium Card 2: Media Gallery */}
          <div className="bento-card bento-medium">
            <div className="bento-icon green"><Camera size={24} /></div>
            <h3>Zero-Bloat Media Gallery</h3>
            <p>Share school memories securely with parents. Our cPanel-style CDN architecture ensures you can upload thousands of photos without ever crashing the database or slowing down the browser.</p>
          </div>
          
          {/* Medium Card 3: Finance */}
          <div className="bento-card bento-medium">
            <div className="bento-icon purple"><Layout size={24} /></div>
            <h3>Automated Finance</h3>
            <p>Issue invoices, track payments, and send automatic SMS fee reminders to parents via our embedded Africa's Talking gateway.</p>
          </div>
        </div>
      </section>

      {/* 4. Interactive Role Switcher */}
      <section className="role-switcher-section">
        <div className="b-section-header">
          <h2>Built for your entire ecosystem.</h2>
          <p>Click below to see how EduOne transforms the experience for every stakeholder.</p>
        </div>
        
        <div className="role-tabs">
          {Object.keys(roleDetails).map(role => (
            <button 
              key={role}
              className={`role-tab ${activeTab === role ? 'active' : ''}`}
              onClick={() => setActiveTab(role)}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </button>
          ))}
        </div>

        <div className="role-content glass-panel" style={{ padding: '60px 40px', background: '#f8fafc' }}>
          <div className="role-content-icon animate-fade-in-up" key={`${activeTab}-icon`}>
            {roleDetails[activeTab].icon}
          </div>
          <h3 className="animate-fade-in-up" key={`${activeTab}-title`}>{roleDetails[activeTab].title}</h3>
          <p className="animate-fade-in-up" key={`${activeTab}-desc`}>{roleDetails[activeTab].desc}</p>
        </div>
      </section>

      {/* 5. Final CTA */}
      <section className="bespoke-cta">
        <h2>Ready to digitize your school?</h2>
        <p>Join the next generation of modern schools. Set up your institution in minutes and experience the fastest, most reliable school management system built for Africa.</p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button className="bespoke-btn primary" onClick={onApply} style={{ padding: '16px 40px', fontSize: '18px', background: '#fff', color: '#1e3a8a' }}>
            Get Started Now
          </button>
          <button className="bespoke-btn ghost" style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }} onClick={onGetStarted}>
            Sign in to Portal
          </button>
        </div>
      </section>
    </div>
  );
}
