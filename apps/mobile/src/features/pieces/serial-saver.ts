/**
 * Enregistre la dernière valeur reçue, une écriture à la fois : les valeurs arrivées pendant une
 * écriture sont fusionnées, seule la plus récente part ensuite. Évite deux transactions SQLite
 * simultanées quand la personne trempe plusieurs titres d'affilée.
 */
export function createSerialSaver<T>(
  save: (value: T) => Promise<void>,
  onError: (error: unknown) => void,
) {
  let pending: { value: T } | null = null;
  let running: Promise<void> | null = null;

  async function drain() {
    while (pending) {
      const { value } = pending;
      pending = null;
      try {
        await save(value);
      } catch (error) {
        onError(error);
      }
    }
    running = null;
  }

  return {
    save(value: T): void {
      pending = { value };
      running ??= drain();
    },
    /** Attend la fin des écritures en cours (tests, fermeture). */
    idle(): Promise<void> {
      return running ?? Promise.resolve();
    },
  };
}
