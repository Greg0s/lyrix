# Semantic Proximity Scoring

Deep-dive on the Cemantix/Pedantix-style hinting system. Read this when touching anything under `src/game/similarity.ts`, `worker/src/similarity.ts`, `src/game/slots.ts`, `scripts/lib/similarityTable.ts`, or `scripts/dev-similarity.ts` — CLAUDE.md only covers the invariants that apply everywhere else.

Every guess that is *not* in the lyrics comes back with a 0-100 proximity score: 80 means it's among a hidden word's 10 nearest neighbours in the embedding model, 60 its top 100, 40 its top 1000 (`scoreFromRank`, `100 − 20·log10(rank)`, in `src/game/similarity.ts`). A guess's overall score is its best against any word of the song. A guess close enough also shows up in place of the hidden words it's close to, shaded by score, until a closer guess or the word itself takes the slot back.

Scores are ranks, not cosines: a fixed cosine cut-off means something different for every hidden word (a word's 1000th neighbour sits anywhere between 0.29 and 0.46 in frWac2Vec — see `docs/LEARNINGS.md`, 2026-09-15), so any single threshold is always too loose for some words and too strict for others. Ranks are counted among the `RANK_VOCABULARY_SIZE` (50,000) most frequent reference words, with `MIN_NEAR_COSINE` (0.2) as a safety floor below which a pair is never placed regardless of rank.

## Pipeline

1. **Model** — [frWac2Vec](https://fauconnier.github.io/#data) by Jean-Philippe Fauconnier, `frWac_non_lem_no_postag_no_phrase_200_skip_cut100.bin` (120 MB, 200-dim, skip-gram, not lemmatized — lyrics are full of conjugated verbs and plurals a lemmatized model wouldn't have). Lowercased, keeps accents, no digit tokens. Not committed; fetched by hand (see "Model licensing" below).
2. **Convert** — `npm run similarity:convert` rewrites the model into the compact `.vecbin` format (`scripts/lib/embeddings.ts`): L2-normalized rows, one indexable vocabulary block, `--max-words` to drop the rare tail. Scoring is then a plain dot product.
3. **Build** — `npm run similarity:build` resolves a song's lyrics (same LRCLIB path the Worker uses), tokenizes/normalizes them, and for every song word worth pointing at (not a function word, not a number, known to the model) ranks the reference vocabulary by cosine and scores every reference word from its rank (`scripts/lib/similarityTable.ts`). A word's `scores` entry is its best score against any song word; `near` keeps the song words it scores at least `NEAR_SCORE` against, closest first, at most `MAX_NEAR_TARGETS` (16). Output: one `data/similarity/<songId>.json` per song (~1.3 MB).
4. **Check** — `npm run similarity:inspect -- --song <id> <guess…>` prints what a built table answers for a few guesses: score plus the song words it would show up on.
5. **Upload** — `wrangler kv bulk put` into the `SIMILARITY` namespace, keyed by song id.
6. **Serve** — `worker/src/similarity.ts` reads the table for the song in play and answers each guess with its score plus `near` (positions of hidden words it's close to, each with its own score). A guessed number is answered from the song's own numbers instead (`numberProximityScore` — no vector exists for digits). The frontend places each hidden word's closest guess so far (`src/game/slots.ts`), shaded on a cold-to-hot ramp.

```bash
npm run similarity:convert -- --input data/models/frWac_non_lem_no_postag_no_phrase_200_skip_cut100.bin \
                              --output data/models/frwac.vecbin --max-words 200000

npm run similarity:build -- --model data/models/frwac.vecbin --song papaoutai
npm run similarity:build -- --model data/models/frwac.vecbin --all --bulk

npm run similarity:inspect -- --song papaoutai amour papa

npx wrangler kv bulk put data/similarity/bulk.json --binding SIMILARITY --remote --config worker/wrangler.toml

# play today's song against a real table: builds it, loads it into a local-only
# KV namespace, starts Vite and the Worker on it
npm run dev:similarity
```

`npm run similarity:build -- --help` lists the rest (`--vocabulary` for a Lexique383-style common-word list, `--max-vocabulary`, `--lyrics` to build from a local file without calling LRCLIB); `npm run dev:similarity -- --help` its own (`--model`, `--table` to play one already built, `--reveal`).

## Rules

- **Only numbers cross the wire.** A missed guess gets its score plus the positions of the hidden words it's close to, each with a score — never the text at a position, a vector, a rank, or any slice of the table beyond the typed word's own entry. A guess that *is* in the lyrics scores 100 without a lookup and is placed nowhere, leaking nothing the `found` flag didn't already.
- **Hidden words are addressed by position, never by an id.** `src/game/slots.ts` counts every word of the round, title first, then lyrics in reading order; `wordPositions` (Worker side) and `placeNearGuesses` (frontend side) must count the same way — a unit test runs them against each other. Stamping an id on every masked token instead would tell the player which blanks hide the same word before they'd come close to either.
- **Placement is display, not progress.** Which guess sits on which hidden word is derived client-side from the tried-word list (closest guess wins, ties keep the earlier one, a revealed word always shows itself) and saved alongside it by `roundStorage.ts`. It never enters the signed round state — a forged placement only fools the player who forged it.
- **`NEAR_SCORE` is pegged to the warm tier** (40: a hidden word's 1000 nearest neighbours), so a guess whose chip is warm or hot always lands somewhere, unless everything it's close to is already revealed. The build drops pairs below it, so lowering it means rebuilding tables; the Worker checks it again on every read, so raising it doesn't. Any change to the table's shape, or to what its scores mean, bumps `SIMILARITY_TABLE_VERSION` (currently 3): older tables are then ignored rather than half-read, and have to be rebuilt.
- **Function words never count.** Articles, pronouns, prepositions, conjunctions, être/avoir, interjections (`src/game/functionWords.ts`) sit close to nearly every word in an embedding model and would take most placements if left in. The build never points at them and gives them no score; guessing one still reveals it.
- **Numbers are compared by value**, not embedding: `numberHint` (`worker/src/similarity.ts`) scores a guessed number against the song's own numbers, where a 10% gap sits right on `NEAR_SCORE`.
- **The feature is optional at runtime.** With no `SIMILARITY` namespace bound, every score is `null` (numbers included), nothing is placed, and the game behaves exactly as before scoring existed. A missing table is never an error.
- **Reference vocabulary**: the model's vocabulary intersected with a common-word list (default: the model's own frequency order, capped at 50,000), proper nouns included ("france" is a fine hint for "allemagne"), function words and digits excluded, plus the song's own words forced in however rare they are.
- **Normalization must stay in step.** Table keys go through the same `normalize()` as a player's guess (lowercase, accents stripped, œ/æ spelled out), so one key can cover several model forms — the best-scoring one wins. Changing `normalize.ts`, or the letters `tokenize.ts` accepts, invalidates every stored table; rebuild them.
- **Local development uses placeholder scores, and one command swaps them for real ones.** `npm run dev:worker` passes `--var SIMILARITY_SAMPLE:1`, serving the hand-written table in `worker/src/sampleSimilarity.ts` so the UI and e2e suite work without the model or a KV namespace. Never set in production; a real KV table always wins over it. Its placements are arbitrary but stable: each sample word scoring `NEAR_SCORE` or more lands on up to four song words (never function words or numbers), picked by hashing it, 8 points lower each further one — so e2e tests assert on *how* a close word shows up, never *where*. `npm run dev:similarity` (`scripts/dev-similarity.ts`) is the other half: it builds the day's table and loads it with `wrangler kv bulk put --local` into the namespace `worker/wrangler.similarity.toml` binds, deliberately *without* `SIMILARITY_SAMPLE`, so a table that failed to load reads as no scores rather than placeholder ones. What the loader and the Worker must agree on (configuration, binding, state directory) lives in `scripts/lib/localSimilarity.ts`.
- **A bound namespace with nothing usable in it says so.** `worker/src/similarity.ts` logs, once per song per isolate, when the namespace holds no table for the song in play or one from an older format. A stale table is never quietly replaced by the placeholder — a wrong score is worse than none.
- **The deployed Worker never gains a local-only binding.** `worker/wrangler.toml` (what the deploy job passes) binds no namespace at all; `worker/wrangler.similarity.toml` binds the local-only one and nothing deploys it. The two files are otherwise identical, and `tests/unit/ci/localSimilarity.test.ts` fails on any other difference. `npm run deploy:check` builds the deployed configuration on every CI run.
- **Calibrate against the real model, never the placeholder.** Everything seen in dev comes from the sample table above, and it once hid that no real table had ever been built (`docs/LEARNINGS.md`, 2026-09-15). Before tuning a threshold, build a table with the model and read it with `similarity:inspect`.

## Model licensing

frWac2Vec is published under **CC BY 3.0** ([fauconnier.github.io](https://fauconnier.github.io/#data)): free to copy, redistribute and adapt with attribution. The game credits it (name, author, licence, link) under the tried-word list whenever a score is shown (`TriedWords.tsx`, checked by the e2e suite) — keep that credit if the display changes, and update it if the model is swapped.

- The model is **not** committed, **not** vendored, and **never** downloaded automatically — fetch it by hand.
- `data/models/` and `data/similarity/` are gitignored: neither the model nor its derived tables enter git.
- Only derived numbers (word → score) ever reach Cloudflare KV, never the vectors themselves.
- A word list passed with `--vocabulary` (e.g. Lexique383) carries its own licence, unchecked here — check it before building production tables with one.
