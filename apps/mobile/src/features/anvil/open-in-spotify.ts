import { Linking } from 'react-native';

import { playlistLinks, type SpotifyLinks, trackLinks } from '../../domain/spotify-links';

type OpenURL = (url: string) => Promise<unknown>;

const systemOpenURL: OpenURL = (url) => Linking.openURL(url);

/**
 * Ouvre un lien dans l'app Spotify ; si elle n'est pas installée (le système refuse l'URI), ouvre
 * la page web. Renvoie `false` si rien n'a pu s'ouvrir.
 */
async function openLinks(links: SpotifyLinks | null, openURL: OpenURL): Promise<boolean> {
  if (!links) return false;
  try {
    await openURL(links.app);
    return true;
  } catch {
    try {
      await openURL(links.web);
      return true;
    } catch {
      console.warn('Could not open the link in Spotify or in the browser');
      return false;
    }
  }
}

export function openTrack(spotifyUri: string, openURL: OpenURL = systemOpenURL) {
  return openLinks(trackLinks(spotifyUri), openURL);
}

export function openPlaylist(playlistId: string, openURL: OpenURL = systemOpenURL) {
  return openLinks(playlistLinks(playlistId), openURL);
}
