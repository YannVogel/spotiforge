import { Linking } from 'react-native';

import { trackLinks } from '../../domain/spotify-links';

/**
 * Ouvre un titre dans l'app Spotify ; si elle n'est pas installée (le système refuse l'URI),
 * ouvre sa page web. Renvoie `false` si rien n'a pu s'ouvrir.
 */
export async function openTrack(
  spotifyUri: string,
  openURL: (url: string) => Promise<unknown> = (url) => Linking.openURL(url),
): Promise<boolean> {
  const links = trackLinks(spotifyUri);
  if (!links) return false;
  try {
    await openURL(links.app);
    return true;
  } catch {
    try {
      await openURL(links.web);
      return true;
    } catch {
      console.warn('Could not open the track in Spotify or in the browser');
      return false;
    }
  }
}
