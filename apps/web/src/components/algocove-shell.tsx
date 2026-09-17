import type { ReactElement, ReactNode } from "react";
import AlgoCoveMark from "./algocove-mark";
import { Icon } from "./algocove-icons";
import AuthControls from "./auth-controls";
import AuthLinks from "./auth-links";
import { isClerkConfigured } from "../auth/clerk-config";

const navItems = [
  ["Today", "/", "home", true],
  ["Roadmap", "#roadmap", "map", false],
  ["Learn", "#learn", "book", false],
  ["Practice Journal", "#journal", "journal", false],
  ["Progress", "#progress", "progress", false],
] as const;

export default function AlgoCoveShell({
  children,
  active = "Today",
}: {
  children: ReactNode;
  active?: string;
}): ReactElement {
  const clerkConfigured = isClerkConfigured();
  return (
    <div className="ac-app-shell" data-shell={active === "Roadmap" ? "deep-journey" : "quiet-home"}>
      <a className="ac-skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="ac-sidebar" aria-label="Primary navigation">
        <a className="ac-sidebar__brand" href="/" aria-label="AlgoCove home">
          <AlgoCoveMark dark={active === "Roadmap"} />
        </a>
        <nav className="ac-sidebar__nav" aria-label="Primary navigation">
          {navItems.map(([label, href, icon, enabled]) =>
            enabled ? (
              <a
                className={`ac-nav-item${active === label ? " is-active" : ""}`}
                href={href}
                key={label}
              >
                <Icon name={icon} size={22} />
                <span>{label}</span>
              </a>
            ) : (
              <span
                className="ac-nav-item is-disabled"
                aria-disabled="true"
                title={`${label} is not available in this phase`}
                key={label}
              >
                <Icon name={icon} size={22} />
                <span>{label}</span>
              </span>
            ),
          )}
        </nav>
        <div className="ac-sidebar__footer">
          <a className="ac-nav-item" href="/settings">
            <Icon name="settings" size={22} />
            <span>Settings</span>
          </a>
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
          <label className="ac-search">
            <Icon name="search" size={22} />
            <input
              type="search"
              aria-label="Search concepts, patterns, problems"
              placeholder="Search concepts, patterns, problems..."
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="ac-utility-actions">
            <button className="ac-utility-button" type="button">
              <Icon name="globe" size={20} />
              Asia/Kolkata <span aria-hidden="true">⌄</span>
            </button>
            <span className="ac-utility-divider" aria-hidden="true" />
            <button className="ac-icon-button" type="button" aria-label="Notifications">
              <Icon name="bell" size={21} />
              <i className="ac-notification-dot" />
            </button>
            <span className="ac-utility-divider" aria-hidden="true" />
            {clerkConfigured ? <AuthControls /> : <AuthLinks />}
            <a className="ac-sr-only" href="/api/health">
              System status
            </a>
          </div>
        </header>
        <div className="ac-page-content">{children}</div>
      </div>
    </div>
  );
}
