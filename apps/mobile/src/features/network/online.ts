import { type NetworkState, useNetworkState } from 'expo-network';

/**
 * Hors ligne seulement si le système le dit : tant que l'état est inconnu, on ne bloque rien
 * (une requête qui échoue a de toute façon son propre message).
 */
export function isOffline(state: Pick<NetworkState, 'isConnected' | 'isInternetReachable'>) {
  return state.isConnected === false || state.isInternetReachable === false;
}

/** Hors ligne, maintenant ; se met à jour quand le réseau change. */
export function useOffline(): boolean {
  return isOffline(useNetworkState());
}
