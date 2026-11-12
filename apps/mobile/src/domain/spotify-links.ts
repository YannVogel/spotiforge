const TRACK_URI = /^spotify:track:([A-Za-z0-9]+)$/;

/** Liens d'un titre : l'URI qu'ouvre l'app Spotify, et la page web de repli. */
export function trackLinks(spotifyUri: string): { app: string; web: string } | null {
  const id = TRACK_URI.exec(spotifyUri)?.[1];
  if (!id) return null;
  return { app: spotifyUri, web: `https://open.spotify.com/track/${id}` };
}
