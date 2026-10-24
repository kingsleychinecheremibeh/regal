import Link from "next/link";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#C7F000" />
      <path
        d="M9 9l14 14M23 9L9 23"
        stroke="#0B1533"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2.6" fill="#E8B547" />
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
    <Link className={className} href={href} aria-label="TurboXGlobal home">
      <LogoMark size={size} />
      <span>
        Turbo<b>X</b>Global
      </span>
    </Link>
  );
}
