// Fabriques de données de test, partagées par l'app et le Worker. Données inventées.
import type {
  Candidate,
  ForgeRequest,
  ForgeResponse,
  ForgeSettings,
  KeptTrack,
  Taste,
  TrackRef,
} from '../forge';

export function makeForgeSettings(overrides: Partial<ForgeSettings> = {}): ForgeSettings {
  return {
    length: { unit: 'minutes', value: 40 },
    discovery: 60,
    decades: [],
    shape: 'rise',
    useTaste: false,
    ...overrides,
  };
}

export function makeTaste(overrides: Partial<Taste> = {}): Taste {
  return {
    topArtists: ['Les Braises', 'Fonderie Nord'],
    recentArtists: ['Acier Doux'],
    genres: ['synthwave'],
    ...overrides,
  };
}

export function makeTrackRef(n: number): TrackRef {
  return { artist: `Artiste ${n}`, title: `Titre ${n}` };
}

export function makeKeptTrack(position: number, n = position + 1): KeptTrack {
  return { ...makeTrackRef(n), position };
}

export function makeForgeRequest(overrides: Partial<ForgeRequest> = {}): ForgeRequest {
  return {
    prompt: 'Route de nuit au bord de la mer, ça monte doucement.',
    length: { unit: 'minutes', value: 40 },
    discovery: 60,
    decades: [],
    shape: 'rise',
    locale: 'fr',
    ...overrides,
  };
}

export function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    ...makeTrackRef(1),
    year: 1984,
    reason: 'Une raison inventée pour les tests.',
    slot: 0,
    familiar: false,
    ...overrides,
  };
}

/** `count` candidats distincts (`Artiste 1`/`Titre 1`…), `slot` réparti de 0 à 1. */
export function makeCandidates(count: number): Candidate[] {
  return Array.from({ length: count }, (_, index) =>
    makeCandidate({
      ...makeTrackRef(index + 1),
      year: 1970 + index,
      slot: count === 1 ? 0 : index / (count - 1),
      familiar: index % 2 === 0,
    }),
  );
}

export function makeForgeResponse(overrides: Partial<ForgeResponse> = {}): ForgeResponse {
  return {
    title: 'Route de nuit',
    description: 'Des synthés qui montent doucement vers la mer.',
    candidates: makeCandidates(15),
    ...overrides,
  };
}
