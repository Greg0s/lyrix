/**
 * The rules' page (/comment-jouer): its title and description, and the
 * questions it answers. Shared by the page itself (HowToPlay.tsx), the
 * tab's title (src/routes.ts), and the HTML the build serves at its address
 * (scripts/lib/rulesPage.ts), where search engines and AI crawlers, which
 * don't run the app, read the same questions as structured data.
 */

export const RULES_TITLE = "Comment jouer à Lyrix : règles et questions fréquentes";

export const RULES_DESCRIPTION =
  "Les règles de Lyrix : propose des mots pour dévoiler les paroles cachées de la chanson du jour, suis leur proximité, joue seul ou en salon.";

export interface Question {
  question: string;
  answer: string;
}

export const FAQ: readonly Question[] = [
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
