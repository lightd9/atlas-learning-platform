import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";

export default function PrivacyPage() {
  return (
    <div className="atlas-public-home public-content-page">
      <PublicNavbar />
      <main className="atlas-legal-page">
        <header>
          <p className="atlas-section-kicker">Legal information</p>
          <h1>Privacy Policy</h1>
          <p>Last updated: 5 August 2026</p>
        </header>
        <section>
          <h2>Information we collect</h2>
          <p>Atlas Learning may collect account details, school and role information, course activity, progress records, and technical information needed to operate and secure the platform.</p>
          <h2>How we use information</h2>
          <p>We use information to provide learning services, manage access, record course progress, support schools, improve platform reliability, and meet legal or safeguarding obligations.</p>
          <h2>How information is shared</h2>
          <p>Information is shared only with authorised school administrators, trusted service providers supporting Atlas Learning, or where disclosure is required by law. We do not sell personal information.</p>
          <h2>Data retention and security</h2>
          <p>We retain information for as long as it is required to provide the service or meet applicable obligations. Appropriate technical and organisational safeguards are used to protect account and learning data.</p>
          <h2>Your rights</h2>
          <p>You may have rights to access, correct, restrict, or request deletion of your personal information. Some records may need to be retained for legal or legitimate operational reasons.</p>
          <h2>Contact</h2>
          <p>Questions about privacy or personal information can be sent to contact@atlassupport.co.uk.</p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
