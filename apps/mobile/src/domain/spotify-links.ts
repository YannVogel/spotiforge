const TRACK_URI = /^spotify:track:([A-Za-z0-9]+)$/;

export type SpotifyLinks = { app: string; web: string };

/** Liens d'un titre : l'URI qu'ouvre l'app Spotify, et la page web de repli. */
export function trackLinks(spotifyUri: string): SpotifyLinks | null {
  const id = TRACK_URI.exec(spotifyUri)?.[1];
  if (!id) return null;
  return { app: spotifyUri, web: `https://open.spotify.com/track/${id}` };
}

const PLAYLIST_ID = /^[A-Za-z0-9]+$/;

/** Liens d'une playlist : l'URI qu'ouvre l'app Spotify, et la page web de repli. */
export function playlistLinks(playlistId: string): SpotifyLinks | null {
  if (!PLAYLIST_ID.test(playlistId)) return null;
  return {
    app: `spotify:playlist:${playlistId}`,
    web: `https://open.spotify.com/playlist/${playlistId}`,
  };
}
