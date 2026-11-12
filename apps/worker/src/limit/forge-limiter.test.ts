import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FORGE_LIMIT, ForgeLimiter } from './forge-limiter';

const START = Date.UTC(2026, 10, 12, 20, 0, 0);

/** Stockage simulé d'un Durable Object : API KV synchrone et alarme unique. */
function fakeState() {
  const values = new Map<string, unknown>();
  const storage = {
    alarm: null as number | null,
    kv: {
      get: (key: string) => structuredClone(values.get(key)),
      put: (key: string, value: unknown) => void values.set(key, structuredClone(value)),
    },
    setAlarm: async (time: number) => {
      storage.alarm = time;
    },
    deleteAll: async () => {
      values.clear();
      storage.alarm = null;
    },
  };
  return { values, storage, state: { storage } as unknown as DurableObjectState };
}

let fake: ReturnType<typeof fakeState>;
let limiter: ForgeLimiter;

async function takeMany(count: number) {
  for (let i = 0; i < count; i++) await limiter.take();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  fake = fakeState();
  limiter = new ForgeLimiter(fake.state, {} as Env);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ForgeLimiter', () => {
  it(`accepte ${FORGE_LIMIT.max} forges par heure, puis répond avec l’attente`, async () => {
    await takeMany(FORGE_LIMIT.max - 1);
    vi.advanceTimersByTime(10 * 60_000);
    expect(await limiter.take()).toEqual({ allowed: true });

    expect(await limiter.take()).toEqual({ allowed: false, retryAfterSeconds: 50 * 60 });
  });

  it('accepte de nouveau une fois l’heure passée', async () => {
    await takeMany(FORGE_LIMIT.max);
    vi.advanceTimersByTime(FORGE_LIMIT.windowMs);

    expect(await limiter.take()).toEqual({ allowed: true });
  });

  it('ne garde que des dates, et programme leur effacement une heure après la dernière forge', async () => {
    await limiter.take();
    vi.advanceTimersByTime(5 * 60_000);
    await limiter.take();

    expect([...fake.values.values()]).toEqual([[START, START + 5 * 60_000]]);
    expect(fake.storage.alarm).toBe(START + 5 * 60_000 + FORGE_LIMIT.windowMs);
  });

  it('ne touche ni au stockage ni à l’alarme quand il refuse', async () => {
    await takeMany(FORGE_LIMIT.max);
    const alarm = fake.storage.alarm;
    vi.advanceTimersByTime(60_000);

    await limiter.take();

    expect(fake.storage.alarm).toBe(alarm);
    expect(fake.values.get('forges')).toHaveLength(FORGE_LIMIT.max);
  });

  it('efface tout à l’alarme', async () => {
    await takeMany(3);

    await limiter.alarm();

    expect(fake.values.size).toBe(0);
    expect(fake.storage.alarm).toBeNull();
  });
});
