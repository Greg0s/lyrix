import { createReadStream } from "node:fs";
import { open, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";

/**
 * Reading, converting and writing word-embedding models, for the offline
 * similarity-table build. None of this ever runs in the Worker: the request
 * path only ever reads a precomputed word -> score table (see
 * worker/src/similarity.ts).
 *
 * Three formats are handled:
 *  - word2vec text (`.vec` / `.txt`): "<count> <dim>" header, then "word f1 f2 …" per line.
 *  - word2vec binary (`.bin`, what frWac2Vec ships): same header line, then
 *    "word " followed by `dim` little-endian float32s, per entry.
 *  - our own compact format (`.vecbin`), written by scripts/convert-embeddings.ts.
 *
 * Everything below assumes a little-endian host, as word2vec's own binary
 * format does.
 */

export interface EmbeddingModel {
  dim: number;
  /** Model vocabulary, in the source file's order (word2vec sorts it by descending frequency). */
  words: string[];
  /** Row-major `words.length * dim` values. Rows are L2-normalized, so a cosine similarity is a plain dot product. */
  vectors: Float32Array;
}

export interface LoadOptions {
  /** Keep only the first N entries. Source files are frequency-ordered, so this trims the rare tail. */
  maxWords?: number;
}

export const COMPACT_MAGIC = "LYRXVEC1";
const COMPACT_HEADER_BYTES = 20;

class VectorBuffer {
  private data: Float32Array;
  private rows = 0;

  constructor(
    private readonly dim: number,
    capacityRows: number
  ) {
    this.data = new Float32Array(Math.max(1, capacityRows) * dim);
  }

  push(values: ArrayLike<number>): void {
    const needed = (this.rows + 1) * this.dim;
    if (needed > this.data.length) {
      const grown = new Float32Array(Math.max(needed, this.data.length * 2));
      grown.set(this.data);
      this.data = grown;
    }
    this.data.set(values, this.rows * this.dim);
    this.rows += 1;
  }

  finish(): Float32Array {
    return this.data.subarray(0, this.rows * this.dim);
  }
}

/** In place, so a 200k-word model isn't duplicated in memory. A zero vector is left as is. */
export function l2NormalizeRows(vectors: Float32Array, dim: number): void {
  for (let offset = 0; offset + dim <= vectors.length; offset += dim) {
    let sum = 0;
    for (let i = 0; i < dim; i += 1) sum += vectors[offset + i] * vectors[offset + i];
    if (sum === 0) continue;
    const inverse = 1 / Math.sqrt(sum);
    for (let i = 0; i < dim; i += 1) vectors[offset + i] *= inverse;
  }
}

export function dotProduct(a: Float32Array, aOffset: number, b: Float32Array, bOffset: number, dim: number): number {
  let sum = 0;
  for (let i = 0; i < dim; i += 1) sum += a[aOffset + i] * b[bOffset + i];
  return sum;
}

function parseHeader(line: string): { count: number; dim: number } | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const count = Number(parts[0]);
  const dim = Number(parts[1]);
  if (!Number.isInteger(count) || !Number.isInteger(dim) || dim <= 0) return null;
  return { count, dim };
}

/** Streamed line by line: a full word2vec text model is several GB, far past what readFile can hold. */
export async function readWord2VecText(path: string, options: LoadOptions = {}): Promise<EmbeddingModel> {
  const maxWords = options.maxWords ?? Number.POSITIVE_INFINITY;
  const reader = createInterface({ input: createReadStream(path), crlfDelay: Infinity });

  let dim = 0;
  let buffer: VectorBuffer | null = null;
  const words: string[] = [];
  let header: { count: number; dim: number } | null = null;
  let first = true;

  for await (const line of reader) {
    if (first) {
      first = false;
      header = parseHeader(line);
      if (header) continue;
    }
    if (line.trim().length === 0) continue;

    const parts = line.split(" ");
    const word = parts[0];
    const values = parts.slice(1).filter((part) => part.length > 0).map(Number);
    if (dim === 0) {
      dim = header?.dim ?? values.length;
      buffer = new VectorBuffer(dim, Math.min(header?.count ?? 1024, maxWords === Infinity ? 1024 : maxWords));
    }
    if (values.length !== dim || !word) continue;

    words.push(word);
    buffer?.push(values);
    if (words.length >= maxWords) break;
  }
  reader.close();

  if (!buffer || dim === 0) throw new Error(`no vectors found in ${path}`);
  const vectors = buffer.finish();
  l2NormalizeRows(vectors, dim);
  return { dim, words, vectors };
}

/** word2vec's own binary layout. Read whole (frWac2Vec's 200-dimension models are a few hundred MB). */
export async function readWord2VecBinary(path: string, options: LoadOptions = {}): Promise<EmbeddingModel> {
  const maxWords = options.maxWords ?? Number.POSITIVE_INFINITY;
  const handle = await open(path, "r");
  let raw: Buffer;
  try {
    raw = await handle.readFile();
  } finally {
    await handle.close();
  }

  const newline = raw.indexOf(0x0a);
  if (newline < 0) throw new Error(`${path} is not a word2vec binary file (no header line)`);
  const header = parseHeader(raw.subarray(0, newline).toString("utf8"));
  if (!header) throw new Error(`${path} has an unreadable word2vec header`);

  const { dim } = header;
  const count = Math.min(header.count, maxWords === Infinity ? header.count : maxWords);
  const words: string[] = [];
  const vectors = new Float32Array(count * dim);

  let cursor = newline + 1;
  for (let row = 0; row < count; row += 1) {
    // word2vec separates the word from its vector with a single space, and
    // may (or may not) put a newline after each vector.
    while (cursor < raw.length && (raw[cursor] === 0x0a || raw[cursor] === 0x0d)) cursor += 1;
    const space = raw.indexOf(0x20, cursor);
    if (space < 0) throw new Error(`${path} ended early, at entry ${row}`);
    words.push(raw.subarray(cursor, space).toString("utf8"));
    cursor = space + 1;
    if (cursor + dim * 4 > raw.length) throw new Error(`${path} ended early, at entry ${row}`);
    for (let i = 0; i < dim; i += 1) vectors[row * dim + i] = raw.readFloatLE(cursor + i * 4);
    cursor += dim * 4;
  }

  l2NormalizeRows(vectors, dim);
  return { dim, words, vectors };
}

function float32View(buffer: Buffer, byteOffset: number, length: number): Float32Array {
  const absolute = buffer.byteOffset + byteOffset;
  if (absolute % Float32Array.BYTES_PER_ELEMENT === 0) {
    return new Float32Array(buffer.buffer, absolute, length);
  }
  const copy = new Float32Array(length);
  for (let i = 0; i < length; i += 1) copy[i] = buffer.readFloatLE(byteOffset + i * 4);
  return copy;
}

/**
 * Compact layout:
 *   "LYRXVEC1" | uint32 dim | uint32 count | uint32 vocabBytes | vocab ("\n"-joined, zero-padded to 4 bytes) | float32 rows
 * The padding keeps the vector block 4-byte aligned, so it can be read as a
 * Float32Array view instead of float by float.
 */
export async function writeCompact(path: string, model: EmbeddingModel): Promise<void> {
  const vocab = Buffer.from(model.words.join("\n"), "utf8");
  const padding = (4 - (vocab.length % 4)) % 4;
  const header = Buffer.alloc(COMPACT_HEADER_BYTES);
  header.write(COMPACT_MAGIC, 0, "ascii");
  header.writeUInt32LE(model.dim, 8);
  header.writeUInt32LE(model.words.length, 12);
  header.writeUInt32LE(vocab.length, 16);

  const vectors = Buffer.from(model.vectors.buffer, model.vectors.byteOffset, model.vectors.byteLength);
  await writeFile(path, Buffer.concat([header, vocab, Buffer.alloc(padding), vectors]));
}

export async function readCompact(path: string, options: LoadOptions = {}): Promise<EmbeddingModel> {
  const handle = await open(path, "r");
  let raw: Buffer;
  try {
    raw = await handle.readFile();
  } finally {
    await handle.close();
  }

  if (raw.subarray(0, 8).toString("ascii") !== COMPACT_MAGIC) {
    throw new Error(`${path} is not a ${COMPACT_MAGIC} file`);
  }
  const dim = raw.readUInt32LE(8);
  const count = raw.readUInt32LE(12);
  const vocabBytes = raw.readUInt32LE(16);
  const vocabEnd = COMPACT_HEADER_BYTES + vocabBytes;
  const words = vocabBytes === 0 ? [] : raw.subarray(COMPACT_HEADER_BYTES, vocabEnd).toString("utf8").split("\n");
  if (words.length !== count) throw new Error(`${path} declares ${count} words but holds ${words.length}`);

  const vectorsStart = vocabEnd + ((4 - (vocabBytes % 4)) % 4);
  const kept = Math.min(count, options.maxWords ?? count);
  return { dim, words: words.slice(0, kept), vectors: float32View(raw, vectorsStart, kept * dim) };
}

export async function loadEmbeddings(path: string, options: LoadOptions = {}): Promise<EmbeddingModel> {
  if (path.endsWith(".vecbin")) return readCompact(path, options);
  if (path.endsWith(".bin")) return readWord2VecBinary(path, options);
  return readWord2VecText(path, options);
}
