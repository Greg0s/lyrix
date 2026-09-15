/** A table's placements the readable way round: word -> { song word: score }. */
export type ReadableNear = Record<string, Record<string, number>>;

/**
 * Encodes readable placements the way a table stores them (see SimilarityTable
 * in worker/src/similarity.ts): each song word listed once in `targets`, and
 * each word's placements as flat [targetIndex, score, …] pairs.
 */
export function encodeNear(readable: ReadableNear): { targets: string[]; near: Record<string, number[]> } {
  const targets: string[] = [];
  const near: Record<string, number[]> = {};
  for (const [word, closeTo] of Object.entries(readable)) {
    near[word] = Object.entries(closeTo).flatMap(([target, score]) => {
      if (!targets.includes(target)) targets.push(target);
      return [targets.indexOf(target), score];
    });
  }
  return { targets, near };
}
