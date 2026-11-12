import {
  type Account,
  NotSignedInError,
  SessionExpiredError,
  type SessionStorage,
  SessionUnavailableError,
  type SpotifyTokens,
  type StoredSession,
} from '../../domain/session';
import type { AccountResult } from '../../infra/spotify/account';
import type { RefreshResult } from '../../infra/spotify/token-refresh';
import { useDraftStore } from '../draft/draft-store';
import { createSessionManager, REFRESH_MARGIN_MS, SignInRejectedError } from './session-manager';
import { useSessionStore } from './session-store';

const NOW = 1_800_000_000_000;
const account: Account = { id: 'fake-account', displayName: 'Nom inventé' };
const tokens = (n: number, expiresAt = NOW + 3_600_000): SpotifyTokens => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  expiresAt,
});

/** Stockage en mémoire qui survit aux « redémarrages » (nouveaux gestionnaires). */
function memoryStorage(initial: StoredSession | null = null) {
  let stored = initial;
  const storage: SessionStorage = {
    load: jest.fn(async () => stored),
    save: jest.fn(async (session: StoredSession) => {
      stored = session;
    }),
    clear: jest.fn(async () => {
      stored = null;
    }),
  };
  return { storage, stored: () => stored };
}

function setup(initial: StoredSession | null = null) {
  const memory = memoryStorage(initial);
  const refreshTokens = jest.fn(async (current: SpotifyTokens): Promise<RefreshResult> => ({
    ok: true,
    tokens: {
      ...tokens(Number(current.accessToken.split('-')[1]) + 1),
      expiresAt: NOW + 3_600_000,
    },
  }));
  const fetchAccount = jest.fn(async (_accessToken: string): Promise<AccountResult> => ({
    ok: true,
    account,
  }));
  const manager = createSessionManager({
    storage: memory.storage,
    refreshTokens,
    fetchAccount,
    now: () => NOW,
  });
  return { manager, refreshTokens, fetchAccount, ...memory };
}

const session = () => useSessionStore.getState().session;

beforeEach(() => {
  useSessionStore.setState(useSessionStore.getInitialState(), true);
  useDraftStore.setState(useDraftStore.getInitialState(), true);
});

describe('connexion et redémarrage', () => {
  it('garde jetons et compte après la connexion', async () => {
    const { manager, stored, fetchAccount } = setup();

    await manager.signIn(tokens(1));

    expect(fetchAccount).toHaveBeenCalledWith('access-1');
    expect(stored()).toEqual({ tokens: tokens(1), account });
    expect(session()).toEqual({ status: 'signedIn', account });
  });

  it('est toujours connecté après un redémarrage, sans appel réseau', async () => {
    const first = setup();
    await first.manager.signIn(tokens(1));

    const restarted = setup(first.stored());
    await restarted.manager.restore();

    expect(session()).toEqual({ status: 'signedIn', account });
    expect(await restarted.manager.getAccessToken()).toBe('access-1');
    expect(restarted.refreshTokens).not.toHaveBeenCalled();
    expect(restarted.fetchAccount).not.toHaveBeenCalled();
  });

  it('démarre déconnecté sans session gardée', async () => {
    const { manager } = setup();

    await manager.restore();

    expect(session()).toEqual({ status: 'signedOut', reason: null });
    await expect(manager.getAccessToken()).rejects.toThrow(NotSignedInError);
  });

  it('refuse un compte non autorisé sans rien garder', async () => {
    const { manager, fetchAccount, stored } = setup();
    fetchAccount.mockResolvedValueOnce({ ok: false, reason: 'forbidden' });

    await expect(manager.signIn(tokens(1))).rejects.toThrow(new SignInRejectedError('forbidden'));

    expect(stored()).toBeNull();
    expect(session()).toEqual({ status: 'signedOut', reason: 'forbidden' });
  });

  it('ne garde rien si Spotify est injoignable pendant la connexion', async () => {
    const { manager, fetchAccount, stored } = setup();
    fetchAccount.mockResolvedValueOnce({ ok: false, reason: 'unavailable' });

    await expect(manager.signIn(tokens(1))).rejects.toThrow(new SignInRejectedError('unavailable'));
    expect(stored()).toBeNull();
  });
});

describe('expiration et rafraîchissement', () => {
  it('renvoie le jeton tant qu’il reste plus d’une minute', async () => {
    const { manager, refreshTokens } = setup({
      tokens: tokens(1, NOW + REFRESH_MARGIN_MS + 1),
      account,
    });
    await manager.restore();

    expect(await manager.getAccessToken()).toBe('access-1');
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it('renouvelle un jeton expiré sans action de la personne, et garde le nouveau', async () => {
    const { manager, refreshTokens, stored } = setup({ tokens: tokens(1, NOW - 1), account });
    await manager.restore();

    expect(await manager.getAccessToken()).toBe('access-2');
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(stored()?.tokens.accessToken).toBe('access-2');
  });

  it('ne rafraîchit qu’une fois sous appels concurrents', async () => {
    const { manager, refreshTokens } = setup({ tokens: tokens(1, NOW + 1000), account });
    await manager.restore();

    const results = await Promise.all(Array.from({ length: 5 }, () => manager.getAccessToken()));

    expect(results).toEqual(Array(5).fill('access-2'));
    expect(refreshTokens).toHaveBeenCalledTimes(1);
  });

  it('après un 401, rafraîchit une seule fois même si plusieurs requêtes ont été refusées', async () => {
    const { manager, refreshTokens } = setup({ tokens: tokens(1), account });
    await manager.restore();

    const first = await Promise.all([
      manager.refreshAfterUnauthorized('access-1'),
      manager.refreshAfterUnauthorized('access-1'),
    ]);
    const late = await manager.refreshAfterUnauthorized('access-1');

    expect(first).toEqual(['access-2', 'access-2']);
    expect(late).toBe('access-2');
    expect(refreshTokens).toHaveBeenCalledTimes(1);
  });

  it('si Spotify refuse le rafraîchissement : retour à la connexion, brouillon conservé', async () => {
    const { manager, refreshTokens, stored } = setup({ tokens: tokens(1, NOW - 1), account });
    await manager.restore();
    useDraftStore.getState().setPrompt('Mon brouillon en cours');
    refreshTokens.mockResolvedValueOnce({ ok: false, reason: 'revoked' });

    await expect(manager.getAccessToken()).rejects.toThrow(SessionExpiredError);

    expect(session()).toEqual({ status: 'signedOut', reason: 'expired' });
    expect(stored()).toBeNull();
    expect(useDraftStore.getState().draft.prompt).toBe('Mon brouillon en cours');
    await expect(manager.getAccessToken()).rejects.toThrow(NotSignedInError);
  });

  it('si Spotify est injoignable : la session reste, un nouvel essai rafraîchit', async () => {
    const { manager, refreshTokens, stored } = setup({ tokens: tokens(1, NOW - 1), account });
    await manager.restore();
    refreshTokens.mockResolvedValueOnce({ ok: false, reason: 'network' });

    await expect(manager.getAccessToken()).rejects.toThrow(SessionUnavailableError);
    expect(session()).toEqual({ status: 'signedIn', account });
    expect(stored()?.tokens.accessToken).toBe('access-1');

    expect(await manager.getAccessToken()).toBe('access-2');
  });
});

describe('déconnexion', () => {
  it('supprime les jetons de l’appareil et de la mémoire', async () => {
    const { manager, stored, storage } = setup();
    await manager.signIn(tokens(1));

    await manager.signOut();

    expect(storage.clear).toHaveBeenCalled();
    expect(stored()).toBeNull();
    expect(session()).toEqual({ status: 'signedOut', reason: 'signedOut' });
    await expect(manager.getAccessToken()).rejects.toThrow(NotSignedInError);
    await expect(manager.refreshAfterUnauthorized('access-1')).rejects.toThrow(NotSignedInError);
  });
});
