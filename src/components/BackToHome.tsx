import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BackToHome({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="login-back" aria-label="Back to home">
      <ArrowLeft size={18} aria-hidden="true" />
    </Link>
  );
}