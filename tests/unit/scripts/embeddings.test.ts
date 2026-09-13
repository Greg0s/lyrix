import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  dotProduct,
  l2NormalizeRows,
  loadEmbeddings,
  readCompact,
  readWord2VecBinary,
  readWord2VecText,
  writeCompact,
  type EmbeddingModel,
} from "../../../scripts/lib/embeddings";

let dir = "";

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "lyrix-embeddings-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** word2vec's binary layout: "<count> <dim>\n", then "word " followed by dim little-endian float32s. */
function word2vecBinary(entries: [string, number[]][]): Buffer {
  const dim = entries[0][1].length;
  const parts = [Buffer.from(`${entries.length} ${dim}\n`, "utf8")];
  for (const [word, values] of entries) {
    const vector = Buffer.alloc(values.length * 4);
    values.forEach((value, i) => vector.writeFloatLE(value, i * 4));
    parts.push(Buffer.from(`${word} `, "utf8"), vector, Buffer.from("\n", "utf8"));
  }
  return Buffer.concat(parts);
}

function vectorOf(model: EmbeddingModel, word: string): number[] {
  const row = model.words.indexOf(word);
  return [...model.vectors.subarray(row * model.dim, (row + 1) * model.dim)];
}

/** Vectors are stored as float32, so 0.6 comes back as 0.6000000238418579. */
function expectVector(actual: number[], expected: number[]): void {
  expect(actual.length).toBe(expected.length);
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 6));
}

describe("l2NormalizeRows", () => {
  it("scales every row to unit length so a dot product is a cosine", () => {
    const vectors = new Float32Array([3, 4, 0, 0, 6, 8]);
    l2NormalizeRows(vectors, 2);
    expectVector([...vectors], [0.6, 0.8, 0, 0, 0.6, 0.8]);
    expect(dotProduct(vectors, 0, vectors, 4, 2)).toBeCloseTo(1, 6);
  });

  it("leaves a zero row alone instead of producing NaN", () => {
    const vectors = new Float32Array([0, 0]);
    l2NormalizeRows(vectors, 2);
    expect([...vectors]).toEqual([0, 0]);
  });
});

describe("readWord2VecText", () => {
  it("reads the header, the vocabulary and unit-normalized vectors", async () => {
    const path = join(dir, "model.vec");
    await writeFile(path, "3 2\nchanson 3 4\norage 0 5\npluie 1 0\n");

    const model = await readWord2VecText(path);
    expect(model.dim).toBe(2);
    expect(model.words).toEqual(["chanson", "orage", "pluie"]);
    expectVector(vectorOf(model, "chanson"), [0.6, 0.8]);
    expectVector(vectorOf(model, "orage"), [0, 1]);
  });

  it("reads a headerless file, inferring the dimension from the first row", async () => {
    const path = join(dir, "headerless.vec");
    await writeFile(path, "chanson 1 0 0\norage 0 1 0\n");

    const model = await readWord2VecText(path);
    expect(model.dim).toBe(3);
    expect(model.words).toEqual(["chanson", "orage"]);
  });

  it("keeps only the first N words, which are the most frequent ones", async () => {
    const path = join(dir, "capped.vec");
    await writeFile(path, "3 2\nchanson 1 0\norage 0 1\npluie 1 1\n");

    const model = await readWord2VecText(path, { maxWords: 2 });
    expect(model.words).toEqual(["chanson", "orage"]);
    expect(model.vectors.length).toBe(4);
  });

  it("skips rows whose width doesn't match the model", async () => {
    const path = join(dir, "ragged.vec");
    await writeFile(path, "3 2\nchanson 1 0\ntronque 1\norage 0 1\n");

    expect((await readWord2VecText(path)).words).toEqual(["chanson", "orage"]);
  });
});

describe("readWord2VecBinary", () => {
  it("reads the binary layout frWac2Vec ships", async () => {
    const path = join(dir, "model.bin");
    await writeFile(
      path,
      word2vecBinary([
        ["chanson", [3, 4]],
        ["orage", [0, 5]],
      ])
    );

    const model = await readWord2VecBinary(path);
    expect(model.dim).toBe(2);
    expect(model.words).toEqual(["chanson", "orage"]);
    expectVector(vectorOf(model, "chanson"), [0.6, 0.8]);
  });

  it("keeps accented French words intact", async () => {
    const path = join(dir, "accents.bin");
    await writeFile(path, word2vecBinary([["été", [1, 0]]]));
    expect((await readWord2VecBinary(path)).words).toEqual(["été"]);
  });

  it("stops at maxWords without reading the rest of the file", async () => {
    const path = join(dir, "capped.bin");
    await writeFile(
      path,
      word2vecBinary([
        ["chanson", [1, 0]],
        ["orage", [0, 1]],
        ["pluie", [1, 1]],
      ])
    );
    expect((await readWord2VecBinary(path, { maxWords: 1 })).words).toEqual(["chanson"]);
  });

  it("reports a truncated file rather than returning garbage vectors", async () => {
    const path = join(dir, "truncated.bin");
    await writeFile(path, word2vecBinary([["chanson", [1, 0]]]).subarray(0, 14));
    await expect(readWord2VecBinary(path)).rejects.toThrow(/ended early/);
  });
});

describe("the compact format", () => {
  it("round-trips a model unchanged", async () => {
    const path = join(dir, "model.vecbin");
    const source = join(dir, "source.vec");
    await writeFile(source, "3 2\nchanson 1 0\norage 0 1\nété 1 1\n");
    const model = await readWord2VecText(source);

    await writeCompact(path, model);
    const reloaded = await readCompact(path);

    expect(reloaded.dim).toBe(model.dim);
    expect(reloaded.words).toEqual(model.words);
    expect([...reloaded.vectors]).toEqual([...model.vectors]);
  });

  it("pads the vocabulary block so vectors stay readable whatever the word lengths", async () => {
    for (const word of ["a", "ab", "abc", "abcd"]) {
      const path = join(dir, `align-${word}.vecbin`);
      await writeCompact(path, { dim: 2, words: [word], vectors: new Float32Array([0.6, 0.8]) });
      expectVector([...(await readCompact(path)).vectors], [0.6, 0.8]);
    }
  });

  it("refuses a file that isn't a compact model", async () => {
    const path = join(dir, "not-a-model.vecbin");
    await writeFile(path, "just some text, definitely not a model");
    await expect(readCompact(path)).rejects.toThrow(/LYRXVEC1/);
  });

  it("caps a compact model to maxWords too", async () => {
    const path = join(dir, "capped.vecbin");
    await writeCompact(path, { dim: 2, words: ["chanson", "orage"], vectors: new Float32Array([1, 0, 0, 1]) });
    expect((await readCompact(path, { maxWords: 1 })).words).toEqual(["chanson"]);
  });
});

describe("loadEmbeddings", () => {
  it("picks the reader from the file extension", async () => {
    const text = join(dir, "pick.vec");
    const binary = join(dir, "pick.bin");
    const compact = join(dir, "pick.vecbin");
    await writeFile(text, "1 2\nchanson 1 0\n");
    await writeFile(binary, word2vecBinary([["orage", [0, 1]]]));
    await writeCompact(compact, { dim: 2, words: ["pluie"], vectors: new Float32Array([1, 0]) });

    expect((await loadEmbeddings(text)).words).toEqual(["chanson"]);
    expect((await loadEmbeddings(binary)).words).toEqual(["orage"]);
    expect((await loadEmbeddings(compact)).words).toEqual(["pluie"]);
  });
});
