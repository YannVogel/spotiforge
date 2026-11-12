import { CreateScreen } from '../features/create/CreateScreen';

/** Premier écran : la création. */
export default function CreateRoute() {
  return (
    <CreateScreen
      // Branché par l'orchestration de la forge (#34) : la requête est prête.
      onForge={() => {}}
      // Branché par l'écran « Mes pièces » (#43).
      onOpenPieces={() => {}}
    />
  );
}
