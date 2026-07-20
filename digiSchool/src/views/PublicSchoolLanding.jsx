import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { createUseStyles } from 'react-jss';
import { FileText, Calendar, Building2, MapPin, Mail, Phone, Award } from 'lucide-react';
import { fmtKES } from '../data/modules';

const useStyles = createUseStyles({
  container: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: '"Inter", sans-serif'
  },
  hero: {
    background: 'linear-gradient(to right, #065f46, #064e3b)',
    color: '#fff',
    padding: '3rem 1.5rem',
  },
  heroInner: {
    maxWidth: '1152px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2rem',
    '@media (min-width: 768px)': {
      flexDirection: 'row',
    }
  },
  logoBox: {
    width: '96px',
    height: '96px',
    background: '#fff',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  },
  logoImg: { width: '100%', height: '100%', objectFit: 'contain' },
  heroText: { flex: 1, textAlign: 'center', '@media (min-width: 768px)': { textAlign: 'left' } },
  title: { fontSize: '2.25rem', fontWeight: 800, margin: '0 0 0.75rem 0' },
  subtitle: { fontSize: '1.125rem', color: '#ccfbf1', margin: 0, maxWidth: '600px' },
  meta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
    marginTop: '1.5rem',
    fontSize: '0.875rem',
    color: '#99f6e4',
    justifyContent: 'center',
    '@media (min-width: 768px)': { justifyContent: 'flex-start' }
  },
  metaItem: { display: 'flex', alignItems: 'center', gap: '4px' },
  actionBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    width: '100%',
    '@media (min-width: 768px)': { width: 'auto' }
  },
  btnPrimary: {
    padding: '0.75rem 2rem', background: '#fff', color: '#065f46', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', width: '100%',
    '&:hover': { transform: 'translateY(-2px)' }
  },
  btnSecondary: {
    padding: '0.75rem 2rem', background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'background 0.2s', width: '100%',
    '&:hover': { background: 'rgba(255,255,255,0.2)' }
  },
  mainContent: { maxWidth: '1152px', margin: '0 auto', padding: '3rem 1.5rem' },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '2rem',
    '@media (min-width: 1024px)': { gridTemplateColumns: '2fr 1fr' }
  },
  card: { background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardHeader: { padding: '1.5rem', borderBottom: '1px solid #f1f5f9', background: '#fff', display: 'flex', alignItems: 'center', gap: '12px' },
  cardTitle: { fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 },
  table: {
    width: '100%', borderCollapse: 'collapse', textAlign: 'left',
    '& th': { padding: '1rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
    '& td': { padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' }
  },
  badge: { display: 'inline-flex', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, background: '#dcfce7', color: '#166534' },
  btnSmall: { padding: '0.5rem 1rem', background: '#0f172a', color: '#fff', fontSize: '0.875rem', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', '&:hover': { background: '#334155' } },
  linkList: { display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem' },
  linkItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '8px', color: '#334155', fontWeight: 500, textDecoration: 'none', cursor: 'pointer', border: 'none', width: '100%', transition: 'all 0.2s', '&:hover': { background: '#ecfdf5', color: '#065f46' } }
});

export default function PublicSchoolLanding() {
  const { school_id } = useParams();
  const navigate = useNavigate();
  const classes = useStyles();

  const [school, setSchool] = useState(null);
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSchoolData() {
      if (!school_id) return;
      try {
        setLoading(true);
        const { data: schoolData, error: schoolErr } = await supabase.from('schools').select('*').eq('domain', school_id).single();
        let targetSchoolId = schoolData?.id;
        if (schoolErr && !schoolData) {
          const { data: byId } = await supabase.from('schools').select('*').eq('id', school_id).single();
          if (byId) { setSchool(byId); targetSchoolId = byId.id; }
        } else {
          setSchool(schoolData);
        }

        if (targetSchoolId) {
          const { data: tendersData } = await supabase.from('tenders').select('*').eq('school_id', targetSchoolId).eq('published', true).eq('status', 'Open').order('deadline', { ascending: true });
          if (tendersData) setTenders(tendersData);
        }
      } catch (err) {} finally { setLoading(false); }
    }
    loadSchoolData();
  }, [school_id]);

  if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

  if (!school) return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <h1 style={{ fontSize: '2rem', color: '#0f172a', marginBottom: '0.5rem' }}>School Not Found</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>We couldn't find a public profile for this school.</p>
      <button onClick={() => navigate('/')} style={{ padding: '0.75rem 1.5rem', background: '#065f46', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Return to EduOne</button>
    </div>
  );

  return (
    <div className={classes.container}>
      <div className={classes.hero}>
        <div className={classes.heroInner}>
          <div className={classes.logoBox}>
            {school.logo ? <img src={school.logo} alt="Logo" className={classes.logoImg} /> : <Building2 size={48} color="#065f46" />}
          </div>
          <div className={classes.heroText}>
            <h1 className={classes.title}>{school.name}</h1>
            <p className={classes.subtitle}>Official Public Portal for Admissions, Student Records, and Procurement Tenders.</p>
            <div className={classes.meta}>
              <span className={classes.metaItem}><MapPin size={16} /> {school.location || 'Nairobi, Kenya'}</span>
              <span className={classes.metaItem}><Mail size={16} /> admissions@{school.domain || 'school'}.edu</span>
              <span className={classes.metaItem}><Phone size={16} /> +254 700 000000</span>
            </div>
          </div>
          <div className={classes.actionBox}>
            <button onClick={() => navigate('/apply')} className={classes.btnPrimary}>Apply for Admission</button>
            <button onClick={() => navigate('/login')} className={classes.btnSecondary}>Parent & Staff Portal</button>
          </div>
        </div>
      </div>

      <div className={classes.mainContent}>
        <div className={classes.grid}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className={classes.card}>
              <div className={classes.cardHeader}>
                <div style={{ padding: '8px', background: '#ecfdf5', borderRadius: '8px' }}><FileText size={20} color="#065f46" /></div>
                <h2 className={classes.cardTitle}>Open Tenders</h2>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className={classes.table}>
                  <thead>
                    <tr>
                      <th>Tender Name</th>
                      <th>Deadline</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenders.map(t => (
                      <tr key={t.id}>
                        <td>
                          <p style={{ fontWeight: 600, color: '#0f172a', margin: '0 0 4px 0' }}>{t.title}</p>
                          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>{t.description}</p>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: '#475569', fontWeight: 500 }}>
                            <Calendar size={14} color="#94a3b8" /> {new Date(t.deadline).toLocaleDateString()}
                          </div>
                        </td>
                        <td><span className={classes.badge}>OPEN</span></td>
                        <td><button className={classes.btnSmall}>Submit Bid</button></td>
                      </tr>
                    ))}
                    {tenders.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                          <p style={{ color: '#64748b', margin: 0 }}>No active tenders at this time.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className={classes.card} style={{ padding: '2rem' }}>
              <h2 className={classes.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}><Award color="#065f46" /> School Excellence</h2>
              <p style={{ color: '#475569', lineHeight: 1.6, marginBottom: '1rem' }}>Welcome to {school.name}. We are dedicated to providing the highest quality education and nurturing the potential of every student. Our modern facilities, experienced faculty, and rigorous curriculum ensure that our students are well-prepared for their future endeavors.</p>
              <p style={{ color: '#475569', lineHeight: 1.6 }}>For 2026 Admissions, please ensure you have downloaded the required medical forms and have your previous academic transcripts ready before applying through the online portal.</p>
            </div>
          </div>
          
          <div>
            <div className={classes.card}>
              <div className={classes.cardHeader}><h3 className={classes.cardTitle}>Quick Links</h3></div>
              <div className={classes.linkList}>
                <button onClick={() => navigate('/apply')} className={classes.linkItem}>Online Admission Form <span>â†’</span></button>
                <button className={classes.linkItem}>Fee Structure 2026 <span>â†’</span></button>
                <button className={classes.linkItem}>Academic Calendar <span>â†’</span></button>
                <button className={classes.linkItem}>Download Prospectus <span>â†’</span></button>
              </div>
            </div>
          </div>
          
        </div>
      </div>
      
      <footer style={{ background: '#0f172a', color: '#94a3b8', padding: '2rem', textAlign: 'center', fontSize: '0.875rem' }}>
        <p>Â© {new Date().getFullYear()} {school.name}. All rights reserved.</p>
      </footer>
    </div>
  );
}



