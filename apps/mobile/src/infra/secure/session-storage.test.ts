import { createSecureSessionStorage } from './session-storage';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (!/^[\w.-]+$/.test(key)) throw new Error('Invalid key');
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key);
  },
}));

const stored = {
  tokens: {
    accessToken: 'fake-access',
    refreshToken: 'fake-refresh',
    expiresAt: 1_800_000_000_000,
  },
  account: { id: 'fake-account', displayName: null },
};

beforeEach(() => {
  mockStore.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('garde puis relit la session dans le stockage sécurisé', async () => {
  const storage = createSecureSessionStorage();

  await storage.save(stored);

  expect(await storage.load()).toEqual(stored);
  expect([...mockStore.keys()]).toEqual(['spotiforge.session']);
});

it('ne renvoie rien sans session, et efface la session à la déconnexion', async () => {
  const storage = createSecureSessionStorage();
  expect(await storage.load()).toBeNull();

  await storage.save(stored);
  await storage.clear();

  expect(mockStore.size).toBe(0);
});

it.each([
  ['un JSON illisible', '{oups'],
  ['une forme inattendue', JSON.stringify({ tokens: { accessToken: '' }, account: {} })],
])('efface %s plutôt que de le garder', async (_case, raw) => {
  mockStore.set('spotiforge.session', raw);

  expect(await createSecureSessionStorage().load()).toBeNull();
  expect(mockStore.size).toBe(0);
  expect(JSON.stringify((console.warn as jest.Mock).mock.calls)).not.toContain('oups');
});
