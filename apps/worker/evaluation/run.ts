// Évaluation manuelle du prompt de la forge : vrais appels à Claude et à Spotify, donc payante.
// Jamais lancée par la CI ni par `pnpm test`. Mode d'emploi : docs/GENERATION.md, « Évaluation ».
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { SessionExpiredError } from '../../mobile/src/domain/session';
import { createSpotifyGateway } from '../../mobile/src/infra/spotify/gateway';
import { createSpotifyHttp } from '../../mobile/src/infra/spotify/http';
import { createForgeGenerator } from '../src/forge/generate';
import { SYSTEM_PROMPT } from '../src/forge/prompt';
import { EVAL_CASES } from './cases';
import { runEvaluation } from './evaluate';
import { formatReport } from './report';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing (see docs/GENERATION.md, "Évaluation")`);
  return value;
}

/** Le modèle du Worker (`CLAUDE_MODEL` dans wrangler.jsonc), sauf s'il est donné dans l'environnement. */
function configuredModel(): string {
  const fromEnv = process.env.CLAUDE_MODEL?.trim();
  if (fromEnv) return fromEnv;
  const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  const model = /"CLAUDE_MODEL"\s*:\s*"([^"]+)"/.exec(config)?.[1];
  if (!model) throw new Error('CLAUDE_MODEL not found in wrangler.jsonc');
  return model;
}

async function main() {
  const apiKey = requiredEnv('ANTHROPIC_API_KEY');
  const spotifyToken = requiredEnv('SPOTIFY_ACCESS_TOKEN');
  const model = configuredModel();
  const filter = process.argv[2];
  const cases = filter ? EVAL_CASES.filter(({ id }) => id.includes(filter)) : EVAL_CASES;
  if (cases.length === 0) throw new Error(`No eval case matches "${filter}"`);

  const http = createSpotifyHttp({
    session: {
      getAccessToken: async () => spotifyToken,
      // Pas de rafraîchissement : un jeton refusé arrête l'évaluation.
      refreshAfterUnauthorized: async () => {
        throw new SessionExpiredError();
      },
    },
    fetch: (input, init) => fetch(input, init),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
  const spotify = createSpotifyGateway(http);

  const results = await runEvaluation(cases, {
    generate: createForgeGenerator({ apiKey, model }),
    searchTracks: (query) => spotify.searchTracks(query),
    onProgress: (message) => process.stderr.write(`${message}\n`),
  });

  const promptVersion = createHash('sha256').update(SYSTEM_PROMPT).digest('hex').slice(0, 8);
  process.stdout.write(formatReport(results, { model, promptVersion }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
