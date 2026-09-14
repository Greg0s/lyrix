# Lyrix

A free web game inspired by [Pedantix](https://cemantix.certitudes.org/pedantix), built around song lyrics instead of Wikipedia articles. Type words to progressively reveal a song's lyrics — the round is won once the title is fully uncovered.

Currently in **MVP** phase: plain, functional UI, no 3D or animations yet.

## Tech Stack

- **Frontend**: Vite + React (TypeScript, strict mode)
- **Backend**: Cloudflare Workers (Hono) — keeps the target lyrics secret and only ever sends masked words to the client
- **Lyrics source**: [LRCLIB](https://lrclib.net)
- **Proximity hints**: French word embeddings, precomputed offline into a per-song word → score table stored in Cloudflare Workers KV

## Requirements

- Node.js 20+
- npm

## Getting Started

Install dependencies:

```bash
npm install
```

Run the frontend and the API together:

```bash
npm run dev:all
```

This starts the Vite dev server (frontend) and `wrangler dev` (API) side by side. The frontend proxies `/api/*` requests to the local Worker, so just open the Vite URL printed in the terminal (usually [http://localhost:5173](http://localhost:5173)).

The first run creates `worker/.dev.vars` from `worker/.dev.vars.example` — the Worker's local secrets, gitignored and used only by `wrangler dev`. Nothing to copy by hand; edit that file if you want your own `STATE_SECRET`, and it will never be overwritten.

You can also run each side on its own:

```bash
npm run dev         # frontend only (Vite)
npm run dev:worker  # API only (wrangler dev)
```

## Testing

Neither command needs anything running first. `npm run test:e2e` starts its own frontend and Worker on dedicated ports (15173 and 18787, inspector 19229) and never reuses a server that's already running, so it always tests this clone's code, even with `npm run dev:all` up here or in another clone. If a run stops with "… is already used", something still holds one of those ports — most likely an interrupted e2e run.

```bash
npm test        # lint + typecheck + unit tests (Vitest)
npm run test:e2e  # end-to-end tests (Playwright)
```

## Semantic Proximity Scoring

A guess that isn't in the lyrics still comes back with a 0-100 score saying how semantically close it is, Cemantix-style — and when it is close to hidden words, it shows up in their place in the lyrics, Pedantix-style (the Worker only ever says *where*, never which word is there). The scoring is precomputed offline — the Worker only ever does a key lookup — so it needs a one-time setup before it does anything in production:

```bash
# 1. download a French word2vec model by hand into data/models/ (see the licence note below)
# 2. compact it
npm run similarity:convert -- --input data/models/<model>.bin --output data/models/frwac.vecbin --max-words 200000
# 3. build the per-song tables
npm run similarity:build -- --model data/models/frwac.vecbin --all --bulk
# 4. create the KV namespace, uncomment the binding in worker/wrangler.toml, and upload
npx wrangler kv namespace create SIMILARITY
npx wrangler kv bulk put data/similarity/bulk.json --binding SIMILARITY --remote --config worker/wrangler.toml
```

Without that namespace the game runs exactly as before, with no scores and no close words in the lyrics. Local development doesn't need any of it: `npm run dev:worker` serves hand-written placeholder scores so the coloured chips, and the close words shown in the lyrics, are visible right away. Only a few dozen words carry one — the API log lists them all on the first guess (any other word scores nothing, and a word that is in the lyrics is revealed instead of scored). Where a placeholder word lands in the lyrics is arbitrary: real neighbours only come from the embedding model.

> **Licence note — unresolved.** The default model, [frWac2Vec](https://fauconnier.github.io/#data), has reuse terms that nobody has verified yet. Nothing is downloaded or committed automatically, and `data/` is gitignored, but **check the licence before uploading derived tables to production**. Any word2vec-format model works — see the "Semantic Proximity Scoring" section of [CLAUDE.md](CLAUDE.md).

## Project Structure

See [CLAUDE.md](CLAUDE.md) for the full project layout, architecture notes, and contribution rules.
