import type { ReactElement, ReactNode } from "react";
import AlgoCoveMark from "./algocove-mark";
import { Icon } from "./algocove-icons";
import AuthControls from "./auth-controls";
import AuthLinks from "./auth-links";
import { isClerkConfigured } from "../auth/clerk-config";

const navItems = [
  ["Home", "/", "home"],
  ["Learner profile", "/onboarding", "target"],
  ["Content", "/admin/content", "book"],
  ["Runtimes", "/execution-readiness", "progress"],
] as const;

function Navigation({
  active,
  mobile = false,
}: {
  active: string;
  mobile?: boolean;
}): ReactElement {
  return (
    <nav
      className={mobile ? "ac-mobile-navigation" : "ac-sidebar__nav"}
      aria-label={mobile ? "Mobile navigation" : "Primary navigation"}
    >
      {navItems.map(([label, href, icon]) => (
        <a className={`ac-nav-item${active === label ? " is-active" : ""}`} href={href} key={label}>
          <Icon name={icon} size={22} />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}

export default function AlgoCoveShell({
  children,
  active = "Home",
}: {
  children: ReactNode;
  active?: string;
}): ReactElement {
  const clerkConfigured = isClerkConfigured();
  return (
    <div className="ac-app-shell">
      <a className="ac-skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="ac-sidebar" aria-label="Application sidebar">
        <a className="ac-sidebar__brand" href="/" aria-label="AlgoCove home">
          <AlgoCoveMark />
        </a>
        <Navigation active={active} />
        <div className="ac-sidebar__footer">
          <div className="ac-sidebar__motto">
            <span className="ac-motto-art" aria-hidden="true">
              ◒
            </span>
            <span>
              Calmer minds
              <br />
              Stronger problem solvers
            </span>
          </div>
        </div>
      </aside>
      <div className="ac-app-content">
        <header className="ac-utility-bar">
          <a className="ac-mobile-brand" href="/" aria-label="AlgoCove home">
            <AlgoCoveMark />
          </a>
          <div className="ac-product-context" aria-label="Current product scope">
            <strong>AlgoCove</strong>
            <span>Foundation and execution readiness</span>
          </div>
          <div className="ac-utility-actions">
            {clerkConfigured ? <AuthControls /> : <AuthLinks />}
            <a className="ac-sr-only" href="/api/health">
              System status
            </a>
          </div>
        </header>
        <Navigation active={active} mobile />
        <div className="ac-page-content">{children}</div>
      </div>
    </div>
  );
}
