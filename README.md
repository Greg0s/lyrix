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

Copy the Worker's local secret defaults (gitignored, used only by `wrangler dev`):

```bash
cp worker/.dev.vars.example worker/.dev.vars
```

Run the frontend and the API together:

```bash
npm run dev:all
```

This starts the Vite dev server (frontend) and `wrangler dev` (API) side by side. The frontend proxies `/api/*` requests to the local Worker, so just open the Vite URL printed in the terminal (usually [http://localhost:5173](http://localhost:5173)).

You can also run each side on its own:

```bash
npm run dev         # frontend only (Vite)
npm run dev:worker  # API only (wrangler dev)
```

## Testing

```bash
npm test        # lint + typecheck + unit tests (Vitest)
npm run test:e2e  # end-to-end tests (Playwright)
```

## Semantic Proximity Scoring

A guess that isn't in the lyrics still comes back with a 0-100 score saying how semantically close it is, Cemantix-style. The scoring is precomputed offline — the Worker only ever does a key lookup — so it needs a one-time setup before it does anything in production:

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

Without that namespace the game runs exactly as before, with no scores. Local development doesn't need any of it: `npm run dev:worker` serves hand-written placeholder scores so the coloured chips are visible right away.

> **Licence note — unresolved.** The default model, [frWac2Vec](https://fauconnier.github.io/#data), has reuse terms that nobody has verified yet. Nothing is downloaded or committed automatically, and `data/` is gitignored, but **check the licence before uploading derived tables to production**. Any word2vec-format model works — see the "Semantic Proximity Scoring" section of [CLAUDE.md](CLAUDE.md).

## Project Structure

See [CLAUDE.md](CLAUDE.md) for the full project layout, architecture notes, and contribution rules.
