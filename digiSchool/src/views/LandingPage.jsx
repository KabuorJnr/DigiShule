import React from 'react';
import { Search, ShoppingCart, MapPin, Menu, ChevronRight } from 'lucide-react';
import { USERS } from '../data/users';

const LandingPage = ({ onGetStarted, onDemoLogin }) => {
  const primaryRoles = ['principal', 'teacher', 'student', 'parent'];
  const getRoleUser = (role) => USERS.find(u => u.role === role);

  return (
    <div className="amz-body">
      {/* Header */}
      <header className="amz-header">
        <div className="amz-nav-top">
          {/* Logo */}
          <div className="amz-nav-left">
            <div className="amz-logo">
              <span className="amz-logo-text">edu<span className="amz-logo-smile">one</span></span>
            </div>
            <div className="amz-nav-location desktop-only">
              <MapPin size={16} />
              <div className="amz-nav-text">
                <span className="amz-nav-line-1">Deliver to</span>
                <span className="amz-nav-line-2">Your School</span>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="amz-nav-search">
            <select className="amz-search-dropdown desktop-only">
              <option>All Modules</option>
              <option>Academics</option>
              <option>Finance</option>
            </select>
            <input type="text" className="amz-search-input" placeholder="Search EduOne..." />
            <button className="amz-search-btn">
              <Search size={20} color="#333" />
            </button>
          </div>

          {/* Right Tools */}
          <div className="amz-nav-right">
            <div className="amz-nav-tool" onClick={onGetStarted}>
              <span className="amz-nav-line-1">Hello, sign in</span>
              <span className="amz-nav-line-2">Account &amp; Lists</span>
            </div>
            <div className="amz-nav-tool desktop-only">
              <span className="amz-nav-line-1">Returns</span>
              <span className="amz-nav-line-2">&amp; Orders</span>
            </div>
            <div className="amz-nav-cart">
              <ShoppingCart size={28} />
              <span className="amz-cart-count">0</span>
              <span className="amz-nav-line-2 desktop-only">Cart</span>
            </div>
          </div>
        </div>

        {/* Sub Nav */}
        <div className="amz-nav-sub">
          <div className="amz-nav-sub-item amz-menu">
            <Menu size={20} /> All
          </div>
          <div className="amz-nav-sub-item">Today's Deals</div>
          <div className="amz-nav-sub-item">Customer Service</div>
          <div className="amz-nav-sub-item">Registry</div>
          <div className="amz-nav-sub-item">Gift Cards</div>
          <div className="amz-nav-sub-item">Sell</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="amz-main">
        {/* Hero Banner Area */}
        <div className="amz-hero">
          <div className="amz-hero-gradient"></div>
        </div>

        {/* Product Grid */}
        <div className="amz-grid">
          {/* Card 1 */}
          <div className="amz-card">
            <h2>Academics Engine</h2>
            <div className="amz-card-img" style={{background: '#f0f8ff'}}>
               <img src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=300&q=80" alt="Academics" />
            </div>
            <a className="amz-card-link">Shop grading systems</a>
          </div>

          {/* Card 2 */}
          <div className="amz-card">
            <h2>Finance & Billing</h2>
            <div className="amz-card-grid">
              <div className="amz-card-sub"><img src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=150&q=80" alt="1" /><span>Invoicing</span></div>
              <div className="amz-card-sub"><img src="https://images.unsplash.com/photo-1580519542036-ed47f3e42214?auto=format&fit=crop&w=150&q=80" alt="2" /><span>Payments</span></div>
              <div className="amz-card-sub"><img src="https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=150&q=80" alt="3" /><span>Reports</span></div>
              <div className="amz-card-sub"><img src="https://images.unsplash.com/photo-1579621970588-a35d0e7ab9b6?auto=format&fit=crop&w=150&q=80" alt="4" /><span>Payroll</span></div>
            </div>
            <a className="amz-card-link">See more</a>
          </div>

          {/* Card 3 */}
          <div className="amz-card">
            <h2>Clinic & Health</h2>
            <div className="amz-card-img" style={{background: '#fcf0f0'}}>
              <img src="https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&w=300&q=80" alt="Clinic" />
            </div>
            <a className="amz-card-link">Explore health tracking</a>
          </div>

          {/* Demo Sign In Widget (Amazon Style) */}
          <div className="amz-card amz-demo-card">
            <h2>Sign in for the best experience</h2>
            <button className="amz-btn-primary amz-main-login-btn" onClick={onGetStarted}>Sign in securely</button>
            <div className="amz-demo-roles">
              <p>Or test drive a demo account:</p>
              <ul>
                {primaryRoles.map(role => {
                  const user = getRoleUser(role);
                  if (!user) return null;
                  return (
                    <li key={role}>
                      <button className="amz-demo-link" onClick={() => onDemoLogin(user)}>
                        Sign in as {user.name} ({role}) <ChevronRight size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        {/* Second Row of Cards */}
        <div className="amz-grid" style={{marginTop: 20}}>
          <div className="amz-card amz-wide-card">
            <div style={{display: 'flex', gap: 20, alignItems: 'center'}}>
              <img src="https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&w=200&q=80" alt="Library" style={{borderRadius: 8}} />
              <div>
                <h2>Discover the Library Module</h2>
                <p style={{fontSize: 14, color: '#0F1111', marginTop: 8}}>Manage inventory, track borrowed books, and streamline returns.</p>
                <a className="amz-card-link" style={{marginTop: 8, display: 'inline-block'}}>Click to learn more</a>
              </div>
            </div>
          </div>
        </div>

        <div className="amz-spacer"></div>
      </main>

      {/* Footer */}
      <footer className="amz-footer">
        <a href="#" className="amz-back-top">Back to top</a>
        <div className="amz-footer-links">
          <div className="amz-footer-col">
            <h3>Get to Know Us</h3>
            <a href="#">Careers</a>
            <a href="#">Blog</a>
            <a href="#">About EduOne</a>
          </div>
          <div className="amz-footer-col">
            <h3>Make Money with Us</h3>
            <a href="#">Sell products on EduOne</a>
            <a href="#">Become an Affiliate</a>
            <a href="#">Advertise Your Products</a>
          </div>
          <div className="amz-footer-col">
            <h3>EduOne Payment Products</h3>
            <a href="#">EduOne Business Card</a>
            <a href="#">Shop with Points</a>
            <a href="#">Reload Your Balance</a>
          </div>
          <div className="amz-footer-col">
            <h3>Let Us Help You</h3>
            <a href="#">Your Account</a>
            <a href="#">Your Orders</a>
            <a href="#">Help</a>
          </div>
        </div>
        <div className="amz-footer-bottom">
          <div className="amz-logo">
             <span className="amz-logo-text">edu<span className="amz-logo-smile">one</span></span>
          </div>
          <p>© 2026, EduOne.com, Inc. or its affiliates</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
