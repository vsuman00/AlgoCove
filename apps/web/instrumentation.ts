/** Hosted instances validate configuration before route initialization. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertHostedWebEnvironment } = await import("@algocove/config");
    assertHostedWebEnvironment(process.env);
  }
}
