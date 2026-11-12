import { Redirect, useRouter } from 'expo-router';

import { AnvilScreen } from '../features/anvil/AnvilScreen';
import { useAnvilStore } from '../features/anvil/anvil-store';

/** « Sur l'enclume » : la pièce qui vient d'être forgée. */
export default function AnvilRoute() {
  const router = useRouter();
  const record = useAnvilStore((state) => state.record);
  const toggleQuench = useAnvilStore((state) => state.toggleQuench);

  // Rien sur l'enclume (lien direct, redémarrage) : retour à la création.
  if (!record) return <Redirect href="/" />;

  return (
    <AnvilScreen
      record={record}
      onToggleQuench={toggleQuench}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      // Branché par la reforge (#37).
      onReforge={() => {}}
      // Branché par l'envoi (#40).
      onSend={() => {}}
    />
  );
}
