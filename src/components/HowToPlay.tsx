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

interface Question {
  question: string;
  answer: string;
}

const FAQ: readonly Question[] = [
  {
    question: "Comment la proximité est-elle calculée ?",
    answer:
      "Par un modèle de langue entraîné sur des textes en français : deux mots employés dans les mêmes contextes sont proches. Pour chaque mot caché, tous les mots du vocabulaire sont classés du plus proche au plus lointain, et ton mot reçoit un score selon sa place : 99 pour le plus proche voisin, 80 s'il est parmi les 10 premiers, 60 parmi les 100, 40 parmi les 1 000. Le score affiché est le meilleur obtenu contre tous les mots de la chanson.",
  },
  {
    question: "Que veulent dire les couleurs ?",
    answer:
      "Elles vont du rouge (loin) à l'orange puis au vert (tout proche). Dans « Tes mots », chaque mot prend la couleur de son score sur toute l'échelle : rouge sous 40, orange autour de 50, vert à partir de 60. Dans les paroles, une barre ne reçoit que des mots déjà proches (40 ou plus) : sa couleur va du rouge, à peine assez proche pour s'afficher, au vert, presque le bon mot.",
  },
  {
    question: "Pourquoi mon mot s'affiche-t-il dans une barre ?",
    answer:
      "Parce qu'il est proche du mot caché à cet endroit (score de 40 ou plus). Il y reste jusqu'à ce qu'un mot plus proche prenne sa place, ou que le mot caché soit trouvé. Si la barre est loin dans les paroles, le message sous le champ te prévient qu'il est proche d'un mot caché.",
  },
  {
    question: "Pourquoi mon mot n'a-t-il pas de score ?",
    answer:
      "Le modèle ne le connaît pas : un mot très rare, une faute de frappe, une forme que le modèle n'a jamais vue. Essaie un synonyme plus courant.",
  },
  {
    question: "Et les nombres ?",
    answer:
      "Ils sont comparés par leur valeur : 2000 est proche de 2015, 1789 encore plus de 1790. Les petits nombres demandent plus de précision : 3 et 4 sont tout juste proches.",
  },
  {
    question: "Les petits mots (le, de, et…) ont-ils un score ?",
    answer:
      "Non : ils sont proches de presque tous les mots et n'aideraient pas à deviner. Les proposer les dévoile quand même dans les paroles, comme n'importe quel mot.",
  },
  {
    question: "Les accents et les majuscules comptent-ils ?",
    answer:
      "Non : « ETE », « été » et « Été » se valent, tout comme « coeur » et « cœur ». Une élision compte pour deux mots : « l'amour » se trouve avec « l » et « amour ».",
  },
  {
    question: "J'ai raté un jour, je peux encore le jouer ?",
    answer:
      "Oui, les 30 derniers jours sont dans les Archives. Tes parties y sont enregistrées sur cet appareil.",
  },
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
