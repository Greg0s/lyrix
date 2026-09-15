import { memo } from "react";

// Static text: memoized so it is rendered once and never again.
export const HowToPlay = memo(function HowToPlay() {
  return (
    <p className="lyrix-explain-body">
      Propose un mot&nbsp;: s'il se cache dans les paroles, il apparaît d'un coup, partout où il se trouve. Sinon, s'il
      a un sens proche d'un mot caché, il s'affiche à sa place en attendant mieux, d'autant plus vert qu'il en est
      proche. Les nombres comptent aussi&nbsp;: 2000 est proche de 2015. Devine tous les mots du titre pour révéler la
      chanson en entier.
    </p>
  );
});
