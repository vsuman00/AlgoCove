import { ProviderFailure, type RoadmapGenerationPort } from "@algocove/tutor";
/** Provider-neutral internal gateway contract. The separately approved gateway
 * owns vendor credentials, model SDKs and region enforcement. */
export function createHttpRoadmapTransport(input: {
  url: string;
  token: string;
  fetch?: typeof fetch;
}): RoadmapGenerationPort["generate"] {
  const url = new URL(input.url);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    !input.token.trim()
  )
    throw new ProviderFailure("invalid_request");
  const transport = input.fetch ?? fetch;
  return async (request, signal) => {
    let response: Response;
    try {
      response = await transport(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.token}` },
        body: JSON.stringify(request),
        signal,
        redirect: "error",
        cache: "no-store",
      });
    } catch {
      throw new ProviderFailure(signal.aborted ? "timeout" : "unavailable");
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new ProviderFailure("unavailable");
    }
    const reader = response.body.getReader(),
      decoder = new TextDecoder();
    let body = "",
      bytes = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 48000 || signal.aborted) throw new ProviderFailure("malformed_output");
        body += decoder.decode(part.value, { stream: true });
        if (body.length > 12000) throw new ProviderFailure("malformed_output");
      }
      body += decoder.decode();
      if (body.length > 12000) throw new ProviderFailure("malformed_output");
      return JSON.parse(body) as unknown;
    } catch {
      throw new ProviderFailure(signal.aborted ? "timeout" : "malformed_output");
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  };
}
