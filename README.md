# Lyrix

A free web game inspired by [Pedantix](https://cemantix.certitudes.org/pedantix), built around song lyrics instead of Wikipedia articles. Type words to progressively reveal a song's lyrics — the round is won once the title is fully uncovered.

Currently in **MVP** phase: plain, functional UI, no 3D or animations yet.

## Tech Stack

- **Frontend**: Vite + React (TypeScript, strict mode)
- **Backend**: Cloudflare Workers (Hono) — keeps the target lyrics secret and only ever sends masked words to the client
- **Lyrics source**: [LRCLIB](https://lrclib.net)

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

## Project Structure

See [CLAUDE.md](CLAUDE.md) for the full project layout, architecture notes, and contribution rules.
