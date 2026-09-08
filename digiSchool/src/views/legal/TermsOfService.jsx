import LegalLayout from './LegalLayout';
import { useSEO } from '../../lib/seo';

// NOTE FOR MAINTAINERS: Starting template for the Terms of Service. Have it
// reviewed by legal counsel and confirm pricing/trial, liability and governing
// law before relying on it.
const EFFECTIVE_DATE = 'August 31, 2026';
const CONTACT_EMAIL = 'sales@edu1app.tech';
const GOVERNING_LAW = 'the laws of Kenya';

function H({ children }) {
  return <h2 style={{ fontSize: 20, fontWeight: 700, margin: '28px 0 8px' }}>{children}</h2>;
}

export default function TermsOfService() {
  useSEO({
    title: 'Terms of Service — EduOne',
    description: 'The terms and conditions that govern use of the EduOne school management platform.',
    path: '/terms',
    noindex: false,
  });

  return (
    <LegalLayout title="Terms of Service" subtitle={`Last updated: ${EFFECTIVE_DATE}`}>
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the EduOne school management
        platform and related websites (the &ldquo;Service&rdquo;). By creating an account or using the Service, you
        agree to these Terms. If you are using the Service on behalf of a school, you represent that you are
        authorised to bind that school to these Terms.
      </p>

      <H>1. Accounts</H>
      <p>You are responsible for maintaining the confidentiality of your login credentials and for all activity under
        your account. Notify us promptly of any unauthorised use. Accounts are provisioned per role (administrators,
        staff, parents, students) with access appropriate to that role.</p>

      <H>2. Acceptable use</H>
      <p>You agree not to misuse the Service: no unlawful activity, no attempts to breach security or access data you
        are not authorised to view, no interference with the Service&rsquo;s operation, and no uploading of unlawful
        or infringing content. Schools are responsible for the accuracy and lawfulness of the records they enter.</p>

      <H>3. Trials, fees &amp; payment</H>
      <p>Paid plans and any free trial are described at the point of sign-up. Fees, billing cycle and applicable
        taxes are those presented when you subscribe. Unless stated otherwise, fees are non-refundable except as
        required by law. We may change pricing on reasonable notice for future billing periods.</p>

      <H>4. Data &amp; privacy</H>
      <p>Your use of the Service is also governed by our <a href="/privacy">Privacy Policy</a>. Schools retain
        ownership of the records they enter; we process that data to provide the Service as described in the Privacy
        Policy.</p>

      <H>5. Availability</H>
      <p>We work to keep the Service available and offline-capable, but we do not guarantee uninterrupted operation.
        We may perform maintenance, and features may change over time as the Service evolves.</p>

      <H>6. Intellectual property</H>
      <p>The Service, including its software, design and branding, is owned by EduOne and its licensors and is
        protected by applicable law. These Terms do not grant you any rights in our intellectual property except the
        limited right to use the Service.</p>

      <H>7. Termination</H>
      <p>You may stop using the Service at any time. We may suspend or terminate access for breach of these Terms or
        where required by law. On termination, the school may request export of its data as described in the Privacy
        Policy, subject to applicable retention requirements.</p>

      <H>8. Disclaimers &amp; liability</H>
      <p>The Service is provided &ldquo;as is&rdquo; without warranties of any kind to the fullest extent permitted by
        law. To the extent permitted by law, EduOne is not liable for indirect, incidental or consequential damages,
        or for loss of data or profits arising from use of the Service.</p>

      <H>9. Governing law</H>
      <p>These Terms are governed by {GOVERNING_LAW}, without regard to conflict-of-laws principles.</p>

      <H>10. Changes to these Terms</H>
      <p>We may update these Terms from time to time. Material changes will be reflected by updating the date above
        and, where appropriate, notifying account holders. Continued use after changes take effect constitutes
        acceptance.</p>

      <H>11. Contact us</H>
      <p>Questions about these Terms? Contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </LegalLayout>
  );
}
