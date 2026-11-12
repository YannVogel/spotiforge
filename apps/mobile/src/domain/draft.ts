import {
  DECADES,
  DEFAULT_LOCALE,
  type Decade,
  FORGE_LIMITS,
  type ForgeLength,
  type ForgeRequest,
  forgeRequestSchema,
  type ForgeSettings,
  type LengthUnit,
  type Shape,
  type Taste,
} from '@spotiforge/shared';

import { MINUTES_PER_TRACK } from './piece';

/** Ce que l'écran Création prépare : le minerai et les réglages. */
export type Draft = {
  prompt: string;
  settings: ForgeSettings;
};

/** Un moule ou une pièce existante, dont on reprend le minerai et les réglages. */
export type DraftSource = Pick<Draft, 'prompt' | 'settings'>;

/** Pas des curseurs, d'après la maquette Création. */
export const LENGTH_STEP: Record<LengthUnit, number> = { minutes: 5, tracks: 1 };
export const DISCOVERY_STEP = 10;

export const DEFAULT_SETTINGS: ForgeSettings = {
  length: { unit: 'minutes', value: 40 },
  discovery: 50,
  decades: [],
  shape: 'free',
  useTaste: false,
};

export function createDraft(): Draft {
  return { prompt: '', settings: { ...DEFAULT_SETTINGS, decades: [] } };
}

function clampToStep(value: number, min: number, max: number, step: number): number {
  const snapped = min + Math.round((value - min) / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

export function boundedLength(unit: LengthUnit, value: number): ForgeLength {
  const { min, max } = FORGE_LIMITS.length[unit];
  return { unit, value: clampToStep(value, min, max, LENGTH_STEP[unit]) };
}

export function boundedDiscovery(value: number): number {
  const { min, max } = FORGE_LIMITS.discovery;
  return clampToStep(value, min, max, DISCOVERY_STEP);
}

export function setPrompt(draft: Draft, prompt: string): Draft {
  return { ...draft, prompt: prompt.slice(0, FORGE_LIMITS.prompt.maxLength) };
}

export function setLengthValue(draft: Draft, value: number): Draft {
  return {
    ...draft,
    settings: { ...draft.settings, length: boundedLength(draft.settings.length.unit, value) },
  };
}

/** Bascule minutes ↔ titres en gardant une durée équivalente (4 minutes par titre). */
export function setLengthUnit(draft: Draft, unit: LengthUnit): Draft {
  const { length } = draft.settings;
  if (length.unit === unit) return draft;
  const converted =
    unit === 'tracks' ? length.value / MINUTES_PER_TRACK : length.value * MINUTES_PER_TRACK;
  return { ...draft, settings: { ...draft.settings, length: boundedLength(unit, converted) } };
}

export function setDiscovery(draft: Draft, value: number): Draft {
  return { ...draft, settings: { ...draft.settings, discovery: boundedDiscovery(value) } };
}

/** Ajoute ou retire une décennie ; la liste reste dans l'ordre chronologique. */
export function toggleDecade(draft: Draft, decade: Decade): Draft {
  const selected = new Set(draft.settings.decades);
  if (selected.has(decade)) selected.delete(decade);
  else selected.add(decade);
  return {
    ...draft,
    settings: { ...draft.settings, decades: DECADES.filter((d) => selected.has(d)) },
  };
}

export function setShape(draft: Draft, shape: Shape): Draft {
  return { ...draft, settings: { ...draft.settings, shape } };
}

export function setUseTaste(draft: Draft, useTaste: boolean): Draft {
  return { ...draft, settings: { ...draft.settings, useTaste } };
}

/**
 * Reprend le minerai et les réglages d'un moule ou d'une pièce. Copie : modifier le brouillon ne
 * touche pas la source. Les valeurs sont recalées sur les bornes et les pas actuels.
 */
export function draftFrom(source: DraftSource): Draft {
  const { settings } = source;
  return {
    prompt: source.prompt.slice(0, FORGE_LIMITS.prompt.maxLength),
    settings: {
      length: boundedLength(settings.length.unit, settings.length.value),
      discovery: boundedDiscovery(settings.discovery),
      decades: DECADES.filter((decade) => settings.decades.includes(decade)),
      shape: settings.shape,
      useTaste: settings.useTaste,
    },
  };
}

/** Le bouton « Forger » n'est actif qu'avec un minerai. */
export function canForge(draft: Draft): boolean {
  return draft.prompt.trim().length > 0;
}

export type ForgeRequestOptions = {
  /** Résumé des écoutes ; envoyé seulement si « Alliage : mes écoutes » est activé. */
  taste?: Taste;
  locale?: string;
};

/** Traduit le brouillon en `ForgeRequest` validée par le contrat partagé. */
export function toForgeRequest(draft: Draft, options: ForgeRequestOptions = {}): ForgeRequest {
  if (!canForge(draft)) {
    throw new Error('Cannot build a forge request without an ore (prompt)');
  }
  const { useTaste, ...settings } = draft.settings;
  return forgeRequestSchema.parse({
    ...settings,
    prompt: draft.prompt,
    locale: options.locale ?? DEFAULT_LOCALE,
    ...(useTaste && options.taste && { taste: options.taste }),
  });
}
