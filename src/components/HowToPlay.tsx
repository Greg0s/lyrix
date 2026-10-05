interface HowToPlayProps {
  /** Leaves the page for where the player was (useRoute's closePage). */
  onClose: () => void;
}

/** The rules, a page of their own (/comment-jouer), opened from the header's "Comment jouer" button. */
export function HowToPlay({ onClose }: HowToPlayProps) {
  return (
    <main className="lyrix-help-page">
      <article className="lyrix-card lyrix-help">
        <h1 className="lyrix-help-title">Comment on joue&nbsp;?</h1>
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
            Un mot au sens proche s'inscrit dans la barre, d'autant plus net qu'il est proche du mot caché.
            Les nombres comptent aussi&nbsp;: 2000 est proche de 2015.
          </p>
        </div>
        <p className="lyrix-help-text">Touche une barre pour savoir combien de lettres compte le mot qu'elle cache.</p>
        <p className="lyrix-help-text">
          À plusieurs&nbsp;: crée un salon ou rejoins celui d'un ami avec son code. Les mots trouvés par chacun se
          dévoilent pour tout le groupe.
        </p>
        <button type="button" className="lyrix-button" onClick={onClose}>
          C'est parti
        </button>
      </article>
    </main>
  );
}
