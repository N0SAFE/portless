import type { Provider, ProviderInfo } from "./types.js";

/**
 * A pluggable provider registry.
 *
 * Providers are discovered by the daemon at startup. Custom/third-party
 * providers can be registered simply by pushing onto the registry; the core
 * engine is unaware of concrete provider implementations.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, Provider>();

  register(provider: Provider): void {
    this.providers.set(provider.info.id, provider);
  }

  unregister(id: string): boolean {
    return this.providers.delete(id);
  }

  get(id: string): Provider | undefined {
    return this.providers.get(id);
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  all(): Provider[] {
    return [...this.providers.values()];
  }

  listInfo(): ProviderInfo[] {
    return this.all().map((p) => p.info);
  }

  async available(): Promise<Provider[]> {
    const out: Provider[] = [];
    for (const p of this.all()) {
      if (p.info.enabled && (await p.detect())) out.push(p);
    }
    return out;
  }
}
