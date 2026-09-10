"use client";

import Link from "next/link";
import { Cookie } from "lucide-react";
import { useEffect, useState } from "react";

const CONSENT_KEY = "atlas-cookie-consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!window.localStorage.getItem(CONSENT_KEY));
  }, []);

  const choose = (choice: "accepted" | "rejected") => {
    window.localStorage.setItem(CONSENT_KEY, choice);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside className="atlas-cookie-banner" role="dialog" aria-labelledby="cookie-title" aria-describedby="cookie-description">
      <div className="atlas-cookie-icon" aria-hidden="true"><Cookie size={21} /></div>
      <div className="atlas-cookie-copy">
        <h2 id="cookie-title">Your cookie preferences</h2>
        <p id="cookie-description">
          We use essential cookies to keep Atlas Learning secure and optional cookies to help us improve the experience. Read our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
      <div className="atlas-cookie-actions">
        <button type="button" className="atlas-cookie-reject" onClick={() => choose("rejected")}>Reject</button>
        <button type="button" className="atlas-cookie-accept" onClick={() => choose("accepted")}>Accept</button>
      </div>
    </aside>
  );
}
