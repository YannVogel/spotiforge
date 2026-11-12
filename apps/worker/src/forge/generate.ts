import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { type ForgeRequest, type ForgeResponse, forgeResponseSchema } from '@spotiforge/shared';

import type { ForgePlan } from './plan';
import { buildUserMessage, SYSTEM_PROMPT } from './prompt';

/** Une sortie invalide déclenche une seule nouvelle tentative (docs/GENERATION.md). */
export const MAX_ATTEMPTS = 2;
const MAX_TOKENS = 16_000;

/**
 * Sortie JSON contrainte par le schéma du contrat : l'API reçoit le schéma JSON (les bornes qu'elle
 * ne gère pas sont retirées par le SDK), et `parse` revalide le texte avec Zod.
 */
const OUTPUT_FORMAT = betaZodOutputFormat(forgeResponseSchema);

export type GenerationResult =
  | { ok: true; response: ForgeResponse }
  | { ok: false; reason: 'invalid_output' | 'refused' | 'upstream' };

export type GeneratorOptions = {
  apiKey: string;
  model: string;
  /** Tentatives du SDK sur 408, 409, 429, 5xx et coupures réseau. */
  maxRetries?: number;
  timeoutMs?: number;
  /** Remplace `fetch` (tests). */
  fetch?: typeof fetch;
};

type Attempt = GenerationResult | { ok: false; reason: 'retry' };

/** Génère une `ForgeResponse` conforme au contrat partagé, ou échoue proprement. */
export function createForgeGenerator({
  apiKey,
  model,
  maxRetries = 1,
  timeoutMs = 90_000,
  fetch,
}: GeneratorOptions) {
  const client = new Anthropic({ apiKey, maxRetries, timeout: timeoutMs, ...(fetch && { fetch }) });

  async function attempt(request: ForgeRequest, plan: ForgePlan): Promise<Attempt> {
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await client.beta.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        // Repli côté serveur si le modèle décline pour des raisons de politique d'usage.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: OUTPUT_FORMAT },
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildUserMessage(request, plan) }],
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        console.error(`Claude request failed (status ${error.status ?? 'none'})`);
        return { ok: false, reason: 'upstream' };
      }
      throw error;
    }

    // Un refus (après le repli serveur) n'est pas retenté : il se reproduirait.
    if (message.stop_reason === 'refusal') return { ok: false, reason: 'refused' };
    const text = message.content.find((block) => block.type === 'text');
    if (!text) return { ok: false, reason: 'retry' };
    try {
      return { ok: true, response: OUTPUT_FORMAT.parse(text.text) };
    } catch {
      // Sortie illisible, tronquée ou hors contrat. Le détail n'est pas journalisé : il peut
      // décrire le contenu généré.
      return { ok: false, reason: 'retry' };
    }
  }

  return async function generate(
    request: ForgeRequest,
    plan: ForgePlan,
  ): Promise<GenerationResult> {
    for (let attemptNumber = 1; attemptNumber <= MAX_ATTEMPTS; attemptNumber++) {
      const result = await attempt(request, plan);
      if (result.ok || result.reason !== 'retry') return result;
      console.warn(`Claude output invalid (attempt ${attemptNumber}/${MAX_ATTEMPTS})`);
    }
    return { ok: false, reason: 'invalid_output' };
  };
}

export type ForgeGenerator = ReturnType<typeof createForgeGenerator>;
