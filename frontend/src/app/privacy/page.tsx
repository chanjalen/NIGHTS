import Header from '@/components/Header';
import DecorativeBorder from '@/components/DecorativeBorder';

export const metadata = {
  title: 'Privacy Policy — Nights',
};

// Contact email shown publicly below. Forwards (via ImprovMX) to the
// findyournights@gmail.com inbox.
const CONTACT_EMAIL = 'contact@findyournights.com';

const sectionStyle = { marginBottom: '32px' } as const;
const headingStyle = {
  color: 'var(--text)',
  fontSize: '18px',
  fontWeight: 600,
  marginBottom: '12px',
} as const;
const paraStyle = {
  color: 'var(--text-dim)',
  fontSize: '16px',
  lineHeight: '1.75',
  marginBottom: '14px',
} as const;

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main>
        <div className="container">
          <div className="page-title-section">
            <h1 className="section-title">
              <span>Privacy</span>
              <span className="accent-line">Policy</span>
            </h1>
            <DecorativeBorder />
          </div>

          <div style={{ maxWidth: '720px', paddingBottom: '80px' }}>
            <p style={{ ...paraStyle, marginBottom: '32px' }}>
              Last updated: June 8, 2026. This policy explains what information
              Nights collects, how it is used, and the third-party services we
              rely on. By using Nights, you agree to the practices described
              below.
            </p>

            <div style={sectionStyle}>
              <h2 style={headingStyle}>Information we collect</h2>
              <p style={paraStyle}>
                When you create an account we collect your email address and, if
                you sign in with Google, your basic Google profile information
                (name and avatar). When you use the site we store the content
                you create — ratings, reviews, check-ins, uploaded photos or
                videos, and chat messages — along with the venue and city they
                relate to.
              </p>
            </div>

            <div style={sectionStyle}>
              <h2 style={headingStyle}>How we use your information</h2>
              <p style={paraStyle}>
                We use your information to operate Nights: to authenticate you,
                display your ratings and check-ins, power venue chat, and improve
                the product. We do not sell your personal information.
              </p>
            </div>

            <div style={sectionStyle}>
              <h2 style={headingStyle}>Advertising</h2>
              <p style={paraStyle}>
                Nights uses Google AdSense to display ads. Google and its
                partners use cookies and similar technologies to serve ads based
                on your prior visits to Nights and other websites. Google&apos;s
                use of advertising cookies enables it and its partners to serve
                ads to you based on your visit to our site and/or other sites on
                the internet.
              </p>
              <p style={paraStyle}>
                You can opt out of personalized advertising by visiting{' '}
                <a
                  href="https://www.google.com/settings/ads"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)' }}
                >
                  Google Ads Settings
                </a>
                . For more information about how Google uses data when you use
                our site, see{' '}
                <a
                  href="https://policies.google.com/technologies/partner-sites"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)' }}
                >
                  Google&apos;s policy
                </a>
                .
              </p>
            </div>

            <div style={sectionStyle}>
              <h2 style={headingStyle}>Analytics</h2>
              <p style={paraStyle}>
                We use PostHog to understand how the site is used so we can
                improve it. This involves cookies and usage data such as the
                pages you visit and actions you take.
              </p>
            </div>

            <div style={sectionStyle}>
              <h2 style={headingStyle}>Cookies</h2>
              <p style={paraStyle}>
                Nights uses cookies to keep you signed in, to power analytics,
                and to serve ads as described above. You can control or delete
                cookies through your browser settings, though some features of
                the site may not work without them.
              </p>
            </div>

            <div style={sectionStyle}>
              <h2 style={headingStyle}>Your choices</h2>
              <p style={paraStyle}>
                You may request access to or deletion of your account and
                associated data at any time by contacting us at the email below.
              </p>
            </div>

            <div style={sectionStyle}>
              <h2 style={headingStyle}>Contact</h2>
              <p style={paraStyle}>
                Questions about this policy? Email us at{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  style={{ color: 'var(--accent)' }}
                >
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
