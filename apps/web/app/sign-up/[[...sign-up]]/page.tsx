import { SignUp } from "@clerk/nextjs";
import type { ReactElement } from "react";

export default function SignUpPage(): ReactElement {
  return (
    <main className="grid min-h-svh place-items-center bg-cove-page p-6">
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
    </main>
  );
}
