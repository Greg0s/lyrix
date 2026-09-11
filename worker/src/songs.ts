import type { Song } from "../../src/game/types";

// Secret game data. Never import this module from frontend (`src/`) code —
// only the Worker may see unmasked lyrics.
export const songs: Song[] = [
  {
    id: "le-refuge-de-novembre",
    title: "Le refuge de novembre",
    artist: "Anaïs Verger",
    sections: [
      {
        label: "Couplet 1",
        lines: [
          "Le vent referme la porte du jardin,",
          "Les feuilles tombent, doucement, sans bruit.",
          "Je rentre à pas lents dans la maison,",
          "La lampe s'allume au bout du couloir.",
        ],
      },
      {
        label: "Refrain",
        lines: [
          "On est bien, on est là,",
          "Le monde attendra demain.",
          "Le refuge de novembre",
          "Nous garde jusqu'au matin.",
        ],
      },
      {
        label: "Couplet 2",
        lines: [
          "Le thé fume encore sur la table basse,",
          "Les mots se posent, tranquilles, sans façon.",
          "Dehors la ville s'endort sous la pluie,",
          "Ici dedans, rien ne presse, rien ne casse.",
        ],
      },
    ],
  },
  {
    id: "les-rues-sont-calmes",
    title: "Les rues sont calmes",
    artist: "Le Bureau des Saisons",
    sections: [
      {
        label: "Couplet 1",
        lines: [
          "La chaleur retombe avec la nuit,",
          "Un vélo passe, personne ne parle.",
          "Les fenêtres s'ouvrent sur la cour,",
          "On entend rire un poste de radio.",
        ],
      },
      {
        label: "Refrain",
        lines: ["Les rues sont calmes,", "Le ciel est doux,", "Rien ne nous presse", "Jusqu'au bout d'août."],
      },
      {
        label: "Couplet 2",
        lines: [
          "Sur le balcon, deux verres, un silence,",
          "La ville respire, lente, satisfaite.",
          "Demain reviendra bien assez tôt,",
          "Ce soir, on reste, on ne bouge pas.",
        ],
      },
    ],
  },
];

export function getSongById(id: string): Song | undefined {
  return songs.find((song) => song.id === id);
}

export function pickRandomSong(excludeId?: string): Song {
  const pool = songs.filter((song) => song.id !== excludeId);
  const candidates = pool.length > 0 ? pool : songs;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
