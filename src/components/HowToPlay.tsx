import { FAQ } from "../rules";
import { nearStyle } from "./heatStyle";

interface HowToPlayProps {
  /** Leaves the page for today's song. */
  onClose: () => void;
}

/**
 * Three guesses for a hidden "jardin", as their bars would show them: shaded
 * along the close-guess ramp (proximityNearHeat), from just close enough to
 * be shown to as close as a missed word gets.
 */
const SAMPLE_GUESSES: readonly { word: string; score: number }[] = [
  { word: "arbre", score: 44 },
  { word: "parc", score: 70 },
  { word: "potager", score: 96 },
];

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
          <p>
            Un mot au sens proche s'inscrit dans la barre du mot caché, coloré du rouge (à peine proche) au vert (tout
            proche). Pour «&nbsp;jardin&nbsp;»&nbsp;:
          </p>
          <ul className="lyrix-help-samples">
            {SAMPLE_GUESSES.map(({ word, score }) => (
              <li key={word} className="lyrix-help-sample" style={nearStyle(score)}>
                {word}
              </li>
            ))}
          </ul>
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

      <section className="lyrix-card lyrix-faq" aria-labelledby="lyrix-faq-title">
        <h2 id="lyrix-faq-title" className="lyrix-faq-title">
          Questions fréquentes
        </h2>
        {FAQ.map(({ question, answer }) => (
          <details key={question} className="lyrix-faq-item">
            <summary>
              {question}
              <span className="lyrix-faq-chevron" aria-hidden="true">
                ▾
              </span>
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>
    </main>
  );
}
