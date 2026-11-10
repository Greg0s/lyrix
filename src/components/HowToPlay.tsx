import { FAQ, RULES_SUMMARY } from "../rules";
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
        <h1 className="lyrix-help-title">{RULES_SUMMARY.heading}</h1>
        <p className="lyrix-help-lead">{RULES_SUMMARY.lead}</p>
        <p className="lyrix-help-text">{RULES_SUMMARY.guess}</p>
        <div className="lyrix-help-example">
          <p>
            {RULES_SUMMARY.near} Pour «&nbsp;jardin&nbsp;»&nbsp;:
          </p>
          <ul className="lyrix-help-samples">
            {SAMPLE_GUESSES.map(({ word, score }) => (
              <li key={word} className="lyrix-help-sample" style={nearStyle(score)}>
                {word}
              </li>
            ))}
          </ul>
        </div>
        <p className="lyrix-help-text">{RULES_SUMMARY.letters}</p>
        <p className="lyrix-help-text">{RULES_SUMMARY.together}</p>
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
