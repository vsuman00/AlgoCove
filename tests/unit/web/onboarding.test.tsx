import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import OnboardingPage from "../../../apps/web/app/onboarding/page";

vi.mock("../../../apps/web/src/components/shell/algocove-shell", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
afterEach(() => vi.unstubAllGlobals());

it("shows the rejected profile field and allows correction and retry", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ profile: null }))
    .mockResolvedValueOnce(
      Response.json(
        {
          error: {
            code: "invalid_request",
            message: "Choose at least one supported language.",
          },
        },
        { status: 400 },
      ),
    )
    .mockResolvedValueOnce(Response.json({ profile: { version: 1 } }));
  vi.stubGlobal("fetch", fetchMock);
  render(<OnboardingPage />);
  await screen.findByText("Start with a few details so the learning loop fits your week.");
  fireEvent.change(screen.getByLabelText("Learning goal"), { target: { value: "Learn arrays" } });
  fireEvent.change(screen.getByLabelText("Target role"), { target: { value: "Engineer" } });
  fireEvent.change(screen.getByLabelText(/^Preferred languages/), { target: { value: "," } });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await screen.findByText("Choose at least one supported language.");
  expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
  fireEvent.change(screen.getByLabelText(/^Preferred languages/), { target: { value: "python" } });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await screen.findByText("Profile saved. Your learning plan can now use it.");
  expect(JSON.parse(fetchMock.mock.calls[2]![1].body)).toMatchObject({
    preferredLanguages: ["python"],
  });
});

it("recovers from a failed save connection without leaving the form busy", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ profile: null }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch")),
  );
  render(<OnboardingPage />);
  await screen.findByText("Start with a few details so the learning loop fits your week.");
  fireEvent.change(screen.getByLabelText("Learning goal"), { target: { value: "Learn arrays" } });
  fireEvent.change(screen.getByLabelText("Target role"), { target: { value: "Engineer" } });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await screen.findByText("We could not reach the profile service. Try again.");
  await waitFor(() => expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled());
});
