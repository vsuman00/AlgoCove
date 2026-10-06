import {
  deriveChunks,
  DerivationFailure,
  identity,
  type Derivation,
  type IndexSource,
} from "@algocove/content";
export type IndexJob = { eventId: string; topic: string; payload: unknown; attempts: number };
export type ContentDescriptor = {
  contentVersionId: string;
  sourceChecksum: string;
  policyVersion: string;
};
export type EmbeddingConfiguration = {
  policyVersion: string;
  provider: string;
  model: string;
  dimensions: number;
  normalization: "unit" | "none";
};
export type EmbeddingPort = {
  readonly configuration: EmbeddingConfiguration;
  embed(texts: readonly string[], signal: AbortSignal): Promise<readonly (readonly number[])[]>;
};
export type IndexStore = {
  load(descriptor: ContentDescriptor): Promise<IndexSource | null>;
  commitDerivation(
    job: IndexJob,
    descriptor: ContentDescriptor,
    derivation: Derivation,
  ): Promise<void>;
  commitEmbeddings(
    job: IndexJob,
    descriptor: ContentDescriptor,
    derivation: Derivation,
    configuration: EmbeddingConfiguration,
    vectors: readonly (readonly number[])[],
  ): Promise<void>;
  quarantine(
    job: IndexJob,
    descriptor: ContentDescriptor,
    reason: "invalid_source" | "injection_detected" | "unsupported_policy" | "invalid_embedding",
  ): Promise<void>;
};
export function embeddingConfigurationId(config: EmbeddingConfiguration): string {
  for (const label of [config.policyVersion, config.provider, config.model])
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(label)) throw Error("Invalid embedding configuration.");
  if (
    !Number.isInteger(config.dimensions) ||
    config.dimensions < 1 ||
    config.dimensions > 1536 ||
    !["unit", "none"].includes(config.normalization)
  )
    throw Error("Invalid embedding configuration.");
  return identity("emb_", [
    config.provider,
    config.model,
    config.dimensions,
    config.normalization,
    config.policyVersion,
  ]);
}
export function validateEmbeddings(
  vectors: readonly (readonly number[])[],
  count: number,
  config: EmbeddingConfiguration,
): void {
  embeddingConfigurationId(config);
  if (
    !Array.isArray(vectors) ||
    vectors.length !== count ||
    vectors.some(
      (v) =>
        !Array.isArray(v) ||
        v.length !== config.dimensions ||
        v.some((x) => !Number.isFinite(x) || !Number.isFinite(Math.fround(x))) ||
        !v.some((x) => x !== 0) ||
        (config.normalization === "unit" && Math.abs(Math.hypot(...v) - 1) > 0.0001),
    )
  )
    throw new DerivationFailure("invalid_source");
}
/** Provider-neutral orchestration. All network work finishes before an atomic store commit. */
export class ContentIndexer {
  private readonly store: IndexStore;
  private readonly now: () => string;
  constructor(store: IndexStore, now: () => string) {
    this.store = store;
    this.now = now;
  }
  async derive(job: IndexJob, descriptor: ContentDescriptor): Promise<void> {
    const source = await this.store.load(descriptor);
    if (!source) throw Error("Canonical indexing source unavailable.");
    let derived: Derivation;
    try {
      derived = deriveChunks(source, descriptor.policyVersion, this.now());
    } catch (error) {
      if (!(error instanceof DerivationFailure) || error.code === "unavailable") throw error;
      await this.store.quarantine(job, descriptor, error.code);
      return;
    }
    await this.store.commitDerivation(job, descriptor, derived);
  }
  async embed(
    job: IndexJob,
    descriptor: ContentDescriptor,
    chunkPolicy: string,
    port: EmbeddingPort,
    timeoutMs = 5000,
  ): Promise<void> {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000)
      throw Error("Invalid embedding deadline.");
    const configuration = Object.freeze({ ...port.configuration });
    embeddingConfigurationId(configuration);
    if (descriptor.policyVersion !== configuration.policyVersion)
      throw Error("Embedding policy mismatch.");
    const source = await this.store.load(descriptor);
    if (!source) throw Error("Canonical indexing source unavailable.");
    const derived = deriveChunks(source, chunkPolicy, this.now());
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let vectors: readonly (readonly number[])[];
    try {
      vectors = await Promise.race([
        port.embed(
          derived.chunks.map((c) => c.text),
          abort.signal,
        ),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            abort.abort();
            reject(Error("Embedding deadline exceeded."));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    try {
      validateEmbeddings(vectors, derived.chunks.length, configuration);
    } catch {
      await this.store.quarantine(job, descriptor, "invalid_embedding");
      return;
    }
    const snapshot = vectors.map((v) => Object.freeze([...v]));
    await this.store.commitEmbeddings(job, descriptor, derived, configuration, snapshot);
  }
}
