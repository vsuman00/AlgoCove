import { SignIn } from "@clerk/nextjs";
import type { ReactElement } from "react";

export default function SignInPage(): ReactElement {
  return (
    <main className="grid min-h-svh place-items-center bg-cove-page p-6">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
    </main>
  );
}
