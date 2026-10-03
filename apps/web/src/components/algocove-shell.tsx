import type { ReactElement, ReactNode } from "react";
import AlgoCoveMark from "./algocove-mark";
import { Icon } from "./algocove-icons";
import AuthControls from "./auth-controls";
import AuthLinks from "./auth-links";
import StaffNavigation, { StaffNavigationProvider } from "./staff-navigation";
import { isClerkConfigured } from "../auth/clerk-config";

const navItems = [
  ["Home", "/", "home"],
  ["Planning", "/plan", "target"],
  ["Reviews", "/review", "book"],
  ["Progress", "/progress", "progress"],
  ["Learner profile", "/onboarding", "target"],
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
        <a
          className={`ac-nav-item${active === label ? " is-active" : ""}`}
          href={href}
          key={label}
          aria-current={active === label ? "page" : undefined}
        >
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
  focused = false,
}: {
  children: ReactNode;
  active?: string;
  focused?: boolean;
}): ReactElement {
  const clerkConfigured = isClerkConfigured();
  const deep = active === "Planning" || active === "Progress";
  return (
    <StaffNavigationProvider>
      <div
        className="ac-app-shell"
        data-shell={focused ? "focused" : deep ? "deep-journey" : "light-daily"}
      >
        <a className="ac-skip-link" href="#main-content">
          Skip to content
        </a>
        {!focused && (
          <aside className="ac-sidebar" aria-label="Application sidebar">
            <a className="ac-sidebar__brand" href="/" aria-label="AlgoCove home">
              <AlgoCoveMark dark={deep} />
            </a>
            <Navigation active={active} />
            <StaffNavigation active={active} />
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
        )}
        <div className="ac-app-content">
          <header className="ac-utility-bar">
            <a
              className={focused ? "ac-focused-brand" : "ac-mobile-brand"}
              href="/"
              aria-label="AlgoCove home"
            >
              <AlgoCoveMark />
            </a>
            {!focused && (
              <div className="ac-product-context" aria-label="Current product scope">
                <strong>AlgoCove</strong>
                <span>Guided practice and learning progress</span>
              </div>
            )}
            <div className="ac-utility-actions">
              {clerkConfigured ? <AuthControls /> : <AuthLinks />}
              <a className="ac-sr-only" href="/api/health">
                System status
              </a>
            </div>
          </header>
          {!focused && <Navigation active={active} mobile />}
          {!focused && (
            <div className="ac-mobile-staff">
              <StaffNavigation active={active} />
            </div>
          )}
          <div className="ac-page-content">{children}</div>
        </div>
      </div>
    </StaffNavigationProvider>
  );
}
