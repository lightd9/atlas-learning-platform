import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";

export default function TermsPage() {
  return (
    <div className="atlas-public-home public-content-page">
      <PublicNavbar />
      <main className="atlas-legal-page">
        <header>
          <p className="atlas-section-kicker">Legal information</p>
          <h1>Terms and Conditions</h1>
          <p>Last updated: 5 August 2026</p>
        </header>
        <section>
          <h2>Using Atlas Learning</h2>
          <p>Atlas Learning provides educational content and course-management services for authorised schools and users. You must use the platform lawfully and in accordance with the permissions assigned to your account.</p>
          <h2>Accounts and access</h2>
          <p>You are responsible for keeping your login details secure and for notifying your school or Atlas Support if you believe your account has been accessed without permission. Accounts must not be shared.</p>
          <h2>Learning content</h2>
          <p>Course materials are provided for professional learning and general guidance. Schools remain responsible for their own policies, decisions, regulatory duties, and professional judgement.</p>
          <h2>Acceptable use</h2>
          <p>You must not attempt to disrupt the service, gain unauthorised access, misuse another person&apos;s information, copy protected material beyond permitted use, or use the platform for unlawful or harmful activity.</p>
          <h2>Availability and changes</h2>
          <p>We may update courses, features, or these terms as the service develops. We aim to keep Atlas Learning available and reliable, but uninterrupted access cannot be guaranteed.</p>
          <h2>Contact</h2>
          <p>Questions about these terms can be sent to contact@atlassupport.co.uk.</p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
