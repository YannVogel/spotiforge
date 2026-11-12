import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';
import { z } from 'zod';

import type { SessionStorage, StoredSession } from '../../domain/session';

const KEY = 'spotiforge.session';

const storedSessionSchema = z.object({
  tokens: z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresAt: z.number(),
    scope: z.string().optional(),
  }),
  account: z.object({ id: z.string().min(1), displayName: z.string().nullable() }),
});

/** Session dans le stockage chiffré du système (expo-secure-store), jamais ailleurs. */
export function createSecureSessionStorage(): SessionStorage {
  return {
    async load() {
      const raw = await getItemAsync(KEY);
      if (raw === null) return null;
      let parsed: ReturnType<typeof storedSessionSchema.safeParse>;
      try {
        parsed = storedSessionSchema.safeParse(JSON.parse(raw));
      } catch {
        parsed = storedSessionSchema.safeParse(null);
      }
      if (parsed.success) return parsed.data;
      // Illisible : on l'efface plutôt que de garder un secret corrompu ; il faudra se reconnecter.
      console.warn('Stored session was unreadable and has been removed');
      await deleteItemAsync(KEY);
      return null;
    },
    async save(session: StoredSession) {
      await setItemAsync(KEY, JSON.stringify(session));
    },
    async clear() {
      await deleteItemAsync(KEY);
    },
  };
}
