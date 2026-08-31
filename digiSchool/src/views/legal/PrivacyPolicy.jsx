import LegalLayout from './LegalLayout';
import { useSEO } from '../../lib/seo';

// NOTE FOR MAINTAINERS: This is a practical starting template for a school-SaaS
// privacy policy. Have it reviewed by legal counsel and confirm the specifics
// (data-retention periods, sub-processors, governing jurisdiction) before you
// rely on it. Contact details are pulled from the marketing site.
const EFFECTIVE_DATE = 'August 31, 2026';
const CONTACT_EMAIL = 'sales@edu1app.tech';
const POSTAL = 'P.O. Box 4021-00100, Nairobi, Kenya';

function H({ children }) {
  return <h2 style={{ fontSize: 20, fontWeight: 700, margin: '28px 0 8px' }}>{children}</h2>;
}

export default function PrivacyPolicy() {
  useSEO({
    title: 'Privacy Policy — EduOne',
    description: 'How EduOne collects, uses, protects and shares personal data across its school management platform.',
    path: '/privacy',
    noindex: false,
  });

  return (
    <LegalLayout title="Privacy Policy" subtitle={`Last updated: ${EFFECTIVE_DATE}`}>
      <p>
        This Privacy Policy explains how EduOne (&ldquo;EduOne&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses,
        discloses and safeguards personal information when schools, staff, parents and students use our school
        management platform and related websites (the &ldquo;Service&rdquo;). By using the Service you agree to the
        practices described here.
      </p>

      <H>1. Information we collect</H>
      <p>We collect information needed to run a school management platform, including:</p>
      <ul>
        <li><strong>Account &amp; profile data</strong> — names, roles, email addresses, phone numbers and login credentials.</li>
        <li><strong>Student records</strong> — admission details, class/stream, grades and assessments, attendance, health and disciplinary records, entered by the school.</li>
        <li><strong>Financial data</strong> — invoices, fee payments and payment references (including mobile-money and bank transaction identifiers).</li>
        <li><strong>Usage &amp; device data</strong> — pages viewed, actions taken, IP address, browser and device type, collected to operate and improve the Service.</li>
      </ul>

      <H>2. How we use information</H>
      <p>We use personal data to provide and secure the Service: to authenticate users, deliver school features
        (grading, fees, timetables, communication), notify parents about their own children, provide support, and
        improve reliability and performance. We do not sell personal data.</p>

      <H>3. The school as data controller</H>
      <p>For student and school records, the school is the data controller and EduOne acts as its processor: the
        school decides what data is entered and who may access it. EduOne processes that data only to provide the
        Service and on the school&rsquo;s instructions.</p>

      <H>4. Sharing &amp; sub-processors</H>
      <p>We share data only as needed to run the Service — for example with infrastructure and communication
        providers (hosting, database, email/SMS and payment processors) acting on our behalf under confidentiality
        obligations, or where required by law. Parents see information relating to their own children only.</p>

      <H>5. Data security</H>
      <p>Data is encrypted in transit, access is restricted by role-based permissions, and each school&rsquo;s data is
        isolated from others. No system is perfectly secure, but we work to protect your information using industry
        practices.</p>

      <H>6. Data retention</H>
      <p>We retain personal data for as long as the school&rsquo;s account is active and as needed to provide the
        Service, comply with legal obligations, resolve disputes and enforce agreements. Schools may request export
        or deletion of their data, subject to applicable record-keeping requirements.</p>

      <H>7. Cookies &amp; analytics</H>
      <p>We use essential cookies to keep you signed in and, with your consent, privacy-friendly analytics to
        understand how the Service is used. You can accept or decline non-essential cookies via the consent banner,
        and manage cookies in your browser settings.</p>

      <H>8. Your rights</H>
      <p>Depending on your jurisdiction, you may have rights to access, correct, export or delete your personal data,
        or to object to certain processing. Parents and staff should direct such requests to their school; schools
        and other users may contact us using the details below.</p>

      <H>9. Children&rsquo;s data</H>
      <p>The Service is used by schools to manage records that may relate to minors. Such records are entered and
        controlled by the school under its own authority and consent obligations. EduOne processes them solely to
        provide the Service to that school.</p>

      <H>10. Changes to this policy</H>
      <p>We may update this policy from time to time. Material changes will be reflected by updating the date above
        and, where appropriate, notifying schools.</p>

      <H>11. Contact us</H>
      <p>
        Questions about this policy or your data? Contact us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or by post at {POSTAL}.
      </p>
    </LegalLayout>
  );
}
