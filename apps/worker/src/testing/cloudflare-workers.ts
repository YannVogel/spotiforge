// Tests seulement : remplace le module `cloudflare:workers`, fourni par le runtime Workers et
// absent de Node (alias déclaré dans vitest.config.ts).
export class DurableObject<Env = unknown> {
  constructor(
    protected ctx: DurableObjectState,
    protected env: Env,
  ) {}
}
