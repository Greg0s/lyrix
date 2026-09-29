import { Modal } from "./Modal";

interface HowToPlayProps {
  onClosed: () => void;
}

/** The rules, opened from the header's "Comment jouer" button. */
export function HowToPlay({ onClosed }: HowToPlayProps) {
  return (
    <Modal title="Comment on joue ?" onClosed={onClosed}>
      {(close) => (
        <>
          <p className="lyrix-help-lead">
            Le but&nbsp;: retrouver le titre d'une chanson à partir de ses paroles cachées. Une nouvelle chanson chaque
            jour, la même pour tout le monde.
          </p>
          <p className="lyrix-help-text">
            Propose un mot&nbsp;: s'il se cache dans les paroles, il apparaît d'un coup, partout où il se trouve. Devine
            tous les mots du titre pour révéler la chanson en entier.
          </p>
          <div className="lyrix-help-example">
            <span className="lyrix-help-sample" aria-hidden="true">
              jardin
              <span className="lyrix-help-sample-guess">parc</span>
            </span>
            <p>
              Un mot au sens proche s'inscrit en blanc dans la barre, d'autant plus net qu'il est proche du mot caché.
              Les nombres comptent aussi&nbsp;: 2000 est proche de 2015.
            </p>
          </div>
          <p className="lyrix-help-text">Touche une barre pour savoir combien de lettres compte le mot qu'elle cache.</p>
          <p className="lyrix-help-text">
            À plusieurs&nbsp;: crée un salon ou rejoins celui d'un ami avec son code. Bientôt, les mots trouvés par
            chacun se dévoileront pour tout le groupe.
          </p>
          <button type="button" className="lyrix-button" onClick={close}>
            C'est parti
          </button>
        </>
      )}
    </Modal>
  );
}
