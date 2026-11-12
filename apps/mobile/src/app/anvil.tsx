import { Redirect, useRouter } from 'expo-router';

import { AnvilScreen } from '../features/anvil/AnvilScreen';
import { useAnvilStore } from '../features/anvil/anvil-store';
import { openTrack } from '../features/anvil/open-track';
import { startReforge } from '../features/anvil/reforge-controller';
import { forgeDependencies } from '../features/forge/dependencies';

/** « Sur l'enclume » : la pièce qui vient d'être forgée. */
export default function AnvilRoute() {
  const router = useRouter();
  const record = useAnvilStore((state) => state.record);
  const reforge = useAnvilStore((state) => state.reforge);
  const toggleQuench = useAnvilStore((state) => state.toggleQuench);
  const setDetails = useAnvilStore((state) => state.setDetails);

  // Rien sur l'enclume (lien direct, redémarrage) : retour à la création.
  if (!record) return <Redirect href="/" />;

  return (
    <AnvilScreen
      record={record}
      reforge={reforge}
      onToggleQuench={toggleQuench}
      onRename={setDetails}
      onOpenTrack={(uri) => void openTrack(uri)}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      onReforge={() => void startReforge(forgeDependencies)}
      // Branché par l'envoi (#40).
      onSend={() => {}}
    />
  );
}
