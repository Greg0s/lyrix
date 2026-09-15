import { memo } from "react";

// Static text: memoized so it is rendered once and never again.
export const HowToPlay = memo(function HowToPlay() {
  return (
    <p className="lyrix-explain-body">
      Propose un mot&nbsp;: s'il se cache dans les paroles, il apparaît d'un coup, partout où il se trouve. Sinon, s'il
      a un sens proche d'un mot caché, il s'affiche en couleur à sa place, en attendant mieux. Devine tous les mots du
      titre pour révéler la chanson en entier.
    </p>
  );
});
