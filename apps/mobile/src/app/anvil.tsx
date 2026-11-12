import { Redirect, useRouter } from 'expo-router';

import { AnvilScreen } from '../features/anvil/AnvilScreen';
import { useAnvilStore } from '../features/anvil/anvil-store';
import { openPlaylist, openTrack } from '../features/anvil/open-in-spotify';
import { startReforge } from '../features/anvil/reforge-controller';
import { recreatePlaylist, startSend } from '../features/anvil/send-controller';
import { forgeDependencies, sendDependencies } from '../features/forge/dependencies';
import { useOffline } from '../features/network/online';

/** « Sur l'enclume » : la pièce qui vient d'être forgée. */
export default function AnvilRoute() {
  const router = useRouter();
  const record = useAnvilStore((state) => state.record);
  const reforge = useAnvilStore((state) => state.reforge);
  const send = useAnvilStore((state) => state.send);
  const offline = useOffline();
  const toggleQuench = useAnvilStore((state) => state.toggleQuench);
  const setDetails = useAnvilStore((state) => state.setDetails);

  // Rien sur l'enclume (lien direct, redémarrage) : retour à la création.
  if (!record) return <Redirect href="/" />;

  return (
    <AnvilScreen
      record={record}
      reforge={reforge}
      send={send}
      offline={offline}
      onToggleQuench={toggleQuench}
      onRename={setDetails}
      onOpenTrack={(uri) => void openTrack(uri)}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      onReforge={() => void startReforge(forgeDependencies)}
      onSend={() => void startSend(sendDependencies)}
      onOpenPlaylist={(id) => void openPlaylist(id)}
      onRecreatePlaylist={() => void recreatePlaylist(sendDependencies)}
    />
  );
}
