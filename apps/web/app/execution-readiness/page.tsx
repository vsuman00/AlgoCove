import { LANGUAGE_PROFILES } from "@algocove/domain";
import type { ReactElement } from "react";
import AlgoCoveShell from "../../src/components/algocove-shell";
import { Icon } from "../../src/components/algocove-icons";

const evidence = [
  {
    title: "Language conformance",
    status: "Implemented",
    detail: "The shared semantic manifest is exercised across every declared adapter.",
    command: "pnpm test:conformance",
  },
  {
    title: "Runtime images",
    status: "Implemented",
    detail: "Pinned runtime profiles and deterministic image checks are present in the repository.",
    command: "pnpm images:test",
  },
  {
    title: "Sandbox abuse suite",
    status: "Technical evidence",
    detail: "Hostile-code abuse fixtures and the selected sandbox spike have recorded evidence.",
    command: "pnpm test:sandbox",
  },
] as const;

export default function ExecutionReadinessPage(): ReactElement {
  return (
    <AlgoCoveShell active="Runtimes">
      <main className="ac-readiness-page" id="main-content" tabIndex={-1}>
        <header className="ac-readiness-hero">
          <div>
            <p className="ac-eyebrow">Execution boundary evidence</p>
            <h1>Six languages, one explicit execution contract.</h1>
            <p>
              These values come from the domain language manifest. This page reports readiness; it
              does not pretend that learner code execution is released.
            </p>
          </div>
          <div className="ac-readiness-summary">
            <span>Supported contracts</span>
            <strong>{LANGUAGE_PROFILES.length}</strong>
            <small>learner runtime remains gated</small>
          </div>
        </header>

        <section className="ac-security-gate" aria-labelledby="security-gate-title">
          <Icon name="info" size={24} />
          <div>
            <p className="ac-eyebrow">Open release gate</p>
            <h2 id="security-gate-title">Security-owner approval is still required</h2>
            <p>
              The technical sandbox evidence is complete, but runnable content remains unavailable
              until the hostile-code isolation choice receives its required human approval.
            </p>
          </div>
          <span>BLOCKED</span>
        </section>

        <section className="ac-runtime-section" aria-labelledby="runtime-title">
          <header>
            <p className="ac-eyebrow">Domain source of truth</p>
            <h2 id="runtime-title">Language profiles</h2>
            <p>Adapter, entry point, timeout, and memory values are not UI placeholders.</p>
          </header>
          <div className="ac-runtime-grid">
            {LANGUAGE_PROFILES.map((profile) => (
              <article className="ac-runtime-card" key={profile.language}>
                <div>
                  <h3>{profile.displayName}</h3>
                  <code>{profile.runtimeFamily}</code>
                </div>
                <dl>
                  <div>
                    <dt>Adapter</dt>
                    <dd>
                      <code>{profile.adapterId}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Entry signature</dt>
                    <dd>
                      <code>{profile.entrySignature}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Compile limit</dt>
                    <dd>{profile.limitsProfile.compileTimeoutMs / 1000}s</dd>
                  </div>
                  <div>
                    <dt>Run limit</dt>
                    <dd>{profile.limitsProfile.runTimeoutMs / 1000}s</dd>
                  </div>
                  <div>
                    <dt>Memory</dt>
                    <dd>{profile.limitsProfile.memoryLimitMb} MB</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="ac-evidence-section" aria-labelledby="evidence-title">
          <header>
            <p className="ac-eyebrow">Repository evidence</p>
            <h2 id="evidence-title">What can be verified now</h2>
          </header>
          <div className="ac-evidence-list">
            {evidence.map((item) => (
              <article key={item.title}>
                <div>
                  <h3>{item.title}</h3>
                  <span>{item.status}</span>
                </div>
                <p>{item.detail}</p>
                <code>{item.command}</code>
              </article>
            ))}
          </div>
        </section>
      </main>
    </AlgoCoveShell>
  );
}
