import React from 'react';
import { ArrowRight, BookOpen, Calculator, Stethoscope, Users, Building, ShieldCheck, CheckCircle } from 'lucide-react';
import { USERS } from '../data/users';

const LandingPage = ({ onGetStarted, onDemoLogin }) => {
  const primaryRoles = ['principal', 'teacher', 'student', 'parent'];
  const getRoleUser = (role) => USERS.find(u => u.role === role);

  return (
    <div className="saas-body">
      {/* Navigation */}
      <nav className="saas-nav">
        <div className="saas-nav-container">
          <div className="saas-brand">
             edu<span className="saas-brand-highlight">one</span>
          </div>
          <div className="saas-nav-links desktop-only">
            <a href="#features">Features</a>
            <a href="#solutions">Solutions</a>
            <a href="#demo">Interactive Demo</a>
          </div>
          <div className="saas-nav-actions">
            <button className="saas-btn-text" onClick={onGetStarted}>Log in</button>
            <button className="saas-btn-primary" onClick={onGetStarted}>Get Started</button>
          </div>
        </div>
      </nav>

      <main className="saas-main">
        {/* Hero Section */}
        <section className="saas-hero">
          <div className="saas-hero-content">
            <div className="saas-badge">✨ The Modern Operating System for Schools</div>
            <h1 className="saas-hero-title">
              Manage your entire school from one <span className="saas-text-gradient">unified platform.</span>
            </h1>
            <p className="saas-hero-subtitle">
              EduOne brings academics, finance, health, and administration together in a beautiful, easy-to-use cloud platform. Built for modern educators and administrators.
            </p>
            <div className="saas-hero-actions">
              <button className="saas-btn-primary saas-btn-large" onClick={onGetStarted}>
                Start your free trial <ArrowRight size={18} />
              </button>
              <button className="saas-btn-outline saas-btn-large" onClick={() => document.getElementById('demo').scrollIntoView({ behavior: 'smooth' })}>
                Try interactive demo
              </button>
            </div>
            <div className="saas-hero-trust">
              <p>Trusted by innovative institutions worldwide</p>
              <div className="saas-trust-logos">
                <span>St. Patrick's Academy</span>
                <span>•</span>
                <span>Oakridge International</span>
                <span>•</span>
                <span>Greenwood High</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="saas-features">
          <div className="saas-section-header">
            <h2>Everything you need to run your school</h2>
            <p>Replace disjointed tools with a single, powerful platform designed for education.</p>
          </div>
          
          <div className="saas-feature-grid">
            {/* Feature 1 */}
            <div className="saas-feature-card">
              <div className="saas-feature-icon" style={{background: '#e0e7ff', color: '#4f46e5'}}>
                <BookOpen size={24} />
              </div>
              <h3>Academics Engine</h3>
              <p>Comprehensive grading systems supporting both 8-4-4 and modern CBC frameworks. Track attendance, manage assignments, and generate insightful report cards effortlessly.</p>
              <ul className="saas-feature-list">
                <li><CheckCircle size={16} /> CBC & Standard Grading</li>
                <li><CheckCircle size={16} /> Automated Report Cards</li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="saas-feature-card">
              <div className="saas-feature-icon" style={{background: '#dcfce7', color: '#16a34a'}}>
                <Calculator size={24} />
              </div>
              <h3>Finance & Billing</h3>
              <p>Streamline your financial operations. Automate fee collection, track expenses, manage payroll, and generate professional invoices for parents in seconds.</p>
              <ul className="saas-feature-list">
                <li><CheckCircle size={16} /> Automated Invoicing</li>
                <li><CheckCircle size={16} /> Expense Tracking</li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="saas-feature-card">
              <div className="saas-feature-icon" style={{background: '#fee2e2', color: '#dc2626'}}>
                <Stethoscope size={24} />
              </div>
              <h3>Health & Clinic</h3>
              <p>Ensure student wellbeing with a dedicated digital clinic. Log medical visits, track prescriptions, and maintain comprehensive student health records securely.</p>
              <ul className="saas-feature-list">
                <li><CheckCircle size={16} /> Medical Logs</li>
                <li><CheckCircle size={16} /> Secure Health Records</li>
              </ul>
            </div>
            
             {/* Feature 4 */}
             <div className="saas-feature-card">
              <div className="saas-feature-icon" style={{background: '#fef3c7', color: '#d97706'}}>
                <Users size={24} />
              </div>
              <h3>Admissions & Enrollment</h3>
              <p>Manage the entire student lifecycle from application to graduation. Digitize enrollment forms and keep parent communication organized.</p>
              <ul className="saas-feature-list">
                <li><CheckCircle size={16} /> Digital Applications</li>
                <li><CheckCircle size={16} /> Parent Portals</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Interactive Demo Sandbox */}
        <section id="demo" className="saas-demo-section">
          <div className="saas-demo-container">
            <div className="saas-demo-content">
              <h2>Interactive Sandbox</h2>
              <p>Experience EduOne from every perspective. Select a role below to jump into a fully populated demo environment.</p>
              
              <div className="saas-demo-grid">
                {primaryRoles.map(role => {
                  const user = getRoleUser(role);
                  if (!user) return null;
                  
                  let Icon = Users;
                  if (role === 'principal') Icon = Building;
                  if (role === 'teacher') Icon = BookOpen;
                  if (role === 'student') Icon = ShieldCheck;
                  
                  return (
                    <div key={role} className="saas-demo-card" onClick={() => onDemoLogin(user)}>
                      <div className="saas-demo-icon">
                        <Icon size={24} />
                      </div>
                      <div className="saas-demo-info">
                        <h4>{user.name}</h4>
                        <span className="saas-demo-role">{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                      </div>
                      <ArrowRight className="saas-demo-arrow" size={20} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="saas-demo-image desktop-only">
               <div className="saas-browser-mockup">
                 <div className="saas-browser-header">
                   <div className="saas-browser-dots">
                     <span></span><span></span><span></span>
                   </div>
                 </div>
                 <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80" alt="Dashboard Preview" />
               </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="saas-footer">
        <div className="saas-footer-container">
          <div className="saas-footer-brand">
            <div className="saas-brand">
               edu<span className="saas-brand-highlight">one</span>
            </div>
            <p>The operating system for modern education.</p>
          </div>
          <div className="saas-footer-links">
            <div className="saas-footer-col">
              <h4>Product</h4>
              <a href="#">Features</a>
              <a href="#">Pricing</a>
              <a href="#">Security</a>
            </div>
            <div className="saas-footer-col">
              <h4>Resources</h4>
              <a href="#">Documentation</a>
              <a href="#">Help Center</a>
              <a href="#">API</a>
            </div>
            <div className="saas-footer-col">
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Careers</a>
              <a href="#">Contact</a>
            </div>
          </div>
        </div>
        <div className="saas-footer-bottom">
          <p>&copy; 2026 EduOne Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
