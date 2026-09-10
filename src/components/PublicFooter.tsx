import Link from "next/link";
import { ChevronDown } from "lucide-react";
import Logo from "@/components/Logo";

export default function PublicFooter() {
  return (
    <footer className="atlas-public-footer">
      <div className="atlas-footer-about">
        <Logo />
        <p>
          Atlas Learning is the online learning platform from Atlas Support,
          created to help schools strengthen digital capability.
        </p>
        <button type="button">
          English <ChevronDown size={12} aria-hidden="true" />
        </button>
      </div>
      <div>
        <h2>Atlas</h2>
        <Link href="/about">About</Link>
        <Link href="/explore">Courses</Link>
        <Link href="/#roadmap">Roadmap</Link>
        <Link href="/contact">Contact</Link>
      </div>
      <div>
        <h2>Learning</h2>
        <Link href="/explore#artificial-intelligence">AI foundations</Link>
        <Link href="/explore#safety">Responsible AI</Link>
        <Link href="/explore#productivity">Practical AI</Link>
        <Link href="/login">Learner sign in</Link>
      </div>
      <div>
        <h2>Support</h2>
        <Link href="/help">Help centre</Link>
        <Link href="/contact">School enquiries</Link>
        <a href="mailto:contact@atlassupport.co.uk">Email us</a>
        <a href="https://www.atlassupport.co.uk">Atlas Support</a>
      </div>
      <div className="atlas-footer-bottom">
        <span>© 2026 Atlas Support. All rights reserved.</span>
        <a href="mailto:sales@layer21.com" className="atlas-footer-layer21">Powered by Layer21</a>
        <span className="atlas-footer-legal">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms and Conditions</Link>
        </span>
      </div>
    </footer>
  );
}
