import { DurableObject } from 'cloudflare:workers';

import { type SlotVerdict, takeSlot, type WindowLimit } from './sliding-window';

/** Forges acceptées par compte sur toute heure glissante : protège la facture Anthropic. */
export const FORGE_LIMIT: WindowLimit = { max: 20, windowMs: 60 * 60 * 1000 };

const STORAGE_KEY = 'forges';

/**
 * Compteur de forges d'un compte : une instance par compte, nommée par l'empreinte SHA-256 de son
 * identifiant Spotify. Il ne garde que les dates des forges de l'heure écoulée, sans rien d'autre,
 * et une alarme efface tout une heure après la dernière forge acceptée.
 *
 * Un Durable Object plutôt que le binding Rate Limiting : celui-ci ne compte que sur 10 ou 60 s,
 * par emplacement Cloudflare et de façon approximative.
 */
export class ForgeLimiter extends DurableObject<Env> {
  async take(): Promise<SlotVerdict> {
    const now = Date.now();
    const stored = this.ctx.storage.kv.get<number[]>(STORAGE_KEY) ?? [];
    const { verdict, timestamps } = takeSlot(stored, now, FORGE_LIMIT);
    if (!verdict.allowed) return verdict;

    this.ctx.storage.kv.put(STORAGE_KEY, timestamps);
    await this.ctx.storage.setAlarm(now + FORGE_LIMIT.windowMs);
    return verdict;
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
