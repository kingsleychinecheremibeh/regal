import Link from "next/link";
import { BRAND } from "@/lib/brand";

/** "R" monogram on the brand lime, with the gold accent dot. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#C7F000" />
      <path
        d="M11 24V8h6.5a4.75 4.75 0 0 1 0 9.5H11M16.5 17.5L22 24"
        fill="none"
        stroke="#0B1533"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23.5" cy="9.5" r="2.2" fill="#E8B547" />
    </svg>
  );
}

export function Logo({
  href = "/",
  size = 32,
  className = "logo",
}: {
  href?: string;
  size?: number;
  className?: string;
}) {
  return (
    <Link className={className} href={href} aria-label={`${BRAND} home`}>
      <LogoMark size={size} />
      <span>
        Regval<b>vest</b>
      </span>
    </Link>
  );
}
