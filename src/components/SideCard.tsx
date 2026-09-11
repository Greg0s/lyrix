import type { ReactNode } from "react";

interface SideCardProps {
  title: string;
  tiltClass: "tilt-left" | "tilt-right";
  isMobile: boolean;
  open: boolean;
  onToggle: () => void;
  subtitle?: ReactNode;
  children: ReactNode;
}

export function SideCard({ title, tiltClass, isMobile, open, onToggle, subtitle, children }: SideCardProps) {
  const showBody = !isMobile || open;

  return (
    <div className={`lyrix-side-card ${tiltClass}`}>
      <div className="lyrix-pin-dot" />
      <button
        type="button"
        className="lyrix-card-header"
        onClick={isMobile ? onToggle : undefined}
        aria-expanded={isMobile ? open : undefined}
      >
        <h2>{title}</h2>
        <span className={`lyrix-chevron${open ? " is-open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {subtitle}
      {showBody ? children : null}
    </div>
  );
}
