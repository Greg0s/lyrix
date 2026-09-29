# Graph Report - lyrix  (2026-09-29)

## Corpus Check
- 105 files · ~60,638 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .example 2, (none) 2, .css 2)

## Summary
- 691 nodes · 1624 edges · 20 communities (19 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.88)
- Token cost: 90,780 input · 0 output

## Community Hubs (Navigation)
- Song Resolution & Proximity Scoring
- LRCLIB Ingestion & Catalog Audit
- Dev Tooling & Unit Tests
- Offline Similarity Build
- React UI Components
- Package Manifest
- Song Analysis & Memoization
- API Client & Game Hook
- Word Display & Heat Shading
- E2E Test Harness
- Project Rules & Conventions
- Dev Dependencies
- Learnings Log
- Frontend TS Config
- Worker TS Config
- Similarity Tuning & KV
- CI & Deployment
- HMAC Round State
- Anti-Cheat Boundary
- Vite Env Types

## God Nodes (most connected - your core abstractions)
1. `LEARNINGS log` - 30 edges
2. `vitest` - 29 edges
3. `CLAUDE.md project instructions` - 29 edges
4. `normalize()` - 21 edges
5. `SIMILARITY deep-dive` - 21 edges
6. `Song` - 19 edges
7. `RoundView` - 19 edges
8. `scripts` - 18 edges
9. `react` - 17 edges
10. `GameScreen()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Numbers compared by value (numberHint)` --references--> `numberHint()`  [EXTRACTED]
  docs/SIMILARITY.md → worker/src/similarity.ts
- `Hidden words addressed by position` --references--> `wordPositions()`  [EXTRACTED]
  docs/SIMILARITY.md → src/game/slots.ts
- `Hidden words addressed by position` --references--> `placeNearGuesses()`  [EXTRACTED]
  docs/SIMILARITY.md → src/game/slots.ts
- `LRCLIB lyrics source` --references--> `cleanLyrics()`  [EXTRACTED]
  CLAUDE.md → worker/src/lyrics.ts
- `LRCLIB lyrics source` --references--> `MIN_LYRIC_WORDS`  [EXTRACTED]
  CLAUDE.md → worker/src/resolveSong.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Offline similarity pipeline** — readme_frwac2vec, scripts_lib_embeddings, scripts_lib_similaritytable, claude_workers_kv_similarity, worker_src_similarity, src_game_slots [EXTRACTED 1.00]
- **Anti-cheat information boundary** — claude_anti_cheat, claude_hmac_signed_round_state, docs_similarity_only_numbers_cross_wire, docs_similarity_position_addressing, docs_similarity_placement_is_display [INFERRED 0.85]
- **LRCLIB lyrics ingestion and cleanup** — worker_src_lrclib, worker_src_lyrics_cleanlyrics, worker_src_resolvesong_min_lyric_words, worker_src_cache, scripts_check_catalog [INFERRED 0.85]

## Communities (20 total, 1 thin omitted)

### Community 0 - "Song Resolution & Proximity Scoring"
Cohesion: 0.05
Nodes (66): EMERGENCY_FALLBACK_SONG (le-refuge-de-novembre), resolveSong.ts split from songs.ts, main(), classifyTargets(), isFunctionWord(), clampScore(), NEAR_SCORE, wordPositions() (+58 more)

### Community 1 - "LRCLIB Ingestion & Catalog Audit"
Cohesion: 0.05
Nodes (54): LRC markup leaked as guessable words, Lrclib-Client header, LRCLIB /api/search over /api/get, @playwright/test, audit(), main(), sleep(), auditSong() (+46 more)

### Community 2 - "Dev Tooling & Unit Tests"
Cohesion: 0.06
Nodes (54): ref_node_child_process, ref_node_fs, ref_node_module, ref_node_net, ref_node_os, ref_node_path, ref_node_url, vitest (+46 more)

### Community 3 - "Offline Similarity Build"
Cohesion: 0.06
Nodes (50): Function words never count, Normalization must stay in step, .vecbin compact embedding format, ref_node_readline, ref_node_util, build(), BuildOptions, catalogEntry() (+42 more)

### Community 4 - "React UI Components"
Cohesion: 0.07
Nodes (40): Team mode placeholder (#29, #30), react, App(), AppHeader, AppHeaderProps, Dialog, feedbackMessage(), GameScreen() (+32 more)

### Community 5 - "Package Manifest"
Cohesion: 0.05
Nodes (46): author, dependencies, hono, react, react-dom, description, keywords, license (+38 more)

### Community 6 - "Song Analysis & Memoization"
Cohesion: 0.10
Nodes (30): Performance rules (memoize per isolate, no re-render on keystroke), analyze(), AnalyzedLine, AnalyzedSection, AnalyzedToken, analyzeLine(), analyzeSong(), cache (+22 more)

### Community 7 - "API Client & Game Hook"
Cohesion: 0.13
Nodes (30): ErrorBody, fetchRound(), isErrorBody(), parseJsonResponse(), submitGuess(), TriedWordsProps, parseNearSlots(), Feedback (+22 more)

### Community 8 - "Word Display & Heat Shading"
Cohesion: 0.16
Nodes (21): heatStyle(), TriedWords, Blank(), BlankProps, fitGuess(), PEEK_FADE_MS, PEEK_SHOW_MS, WordToken() (+13 more)

### Community 9 - "E2E Test Harness"
Cohesion: 0.12
Nodes (19): E2E reused another checkout's server, Playwright hasText substring match, Playwright webServer raced Wrangler cold start, similarityTableFixture, similarityWorkerUrl, workerUrl, E2E dedicated ports (15173/18787/19229), vite (+11 more)

### Community 10 - "Project Rules & Conventions"
Cohesion: 0.11
Nodes (22): CLAUDE.md project instructions, Conventional Commits + Gitmoji, Continuous improvement loop, Daily song rotation (UTC midnight), DEV_REVEAL_LYRICS dev hint, English-only repository policy, LRCLIB lyrics source, Lyrix game (+14 more)

### Community 11 - "Dev Dependencies"
Cohesion: 0.10
Nodes (21): devDependencies, @cloudflare/workers-types, concurrently, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+13 more)

### Community 12 - "Learnings Log"
Cohesion: 0.14
Nodes (20): Graphify skill pointer (.claude/CLAUDE.md), Graphify skill, French text matching (accents, elisions), LEARNINGS log, cors maxAge 86400 for preflight, Dirty LRCLIB metadata; titles from catalog, Google Fonts via <link> + preconnect instead of @import, resetSongMemo / resetSimilarityMemo in beforeEach (+12 more)

### Community 13 - "Frontend TS Config"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 14 - "Worker TS Config"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 15 - "Similarity Tuning & KV"
Cohesion: 0.16
Nodes (16): Workers KV similarity tables, KV binding shipped commented out; SIMILARITY_SAMPLE via --var, SIMILARITY deep-dive, MAX_NEAR_TARGETS (16), MIN_NEAR_COSINE (0.2), Model licensing (CC BY 3.0, never committed), NEAR_SCORE (40), Numbers compared by value (numberHint) (+8 more)

### Community 16 - "CI & Deployment"
Cohesion: 0.21
Nodes (12): CI workflow, CLOUDFLARE_API_TOKEN / ACCOUNT_ID secrets, npm run deploy:check, CI deploy job, CI test job, VITE_API_BASE_URL build env, Cloudflare Pages hosting, Cloudflare Workers + Hono backend (+4 more)

### Community 17 - "HMAC Round State"
Cohesion: 0.27
Nodes (10): decoder, encoder, fromBase64Url(), hmacKey(), isStatePayload(), keyCache, signState(), StatePayload (+2 more)

### Community 18 - "Anti-Cheat Boundary"
Cohesion: 0.25
Nodes (9): Anti-cheat: Worker-only lyrics, Config rules: gitignored file never manual; missing config names itself, HMAC-signed round state, STATE_SECRET, Missing .dev.vars HMAC DataError, songId slug leaks title (unfixed), STATE_SECRET var/secret binding conflict, Only numbers cross the wire (+1 more)

## Knowledge Gaps
- **187 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+182 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 232 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Dev Tooling & Unit Tests` to `Song Resolution & Proximity Scoring`, `LRCLIB Ingestion & Catalog Audit`, `Offline Similarity Build`, `React UI Components`, `Package Manifest`, `Song Analysis & Memoization`, `API Client & Game Hook`, `Word Display & Heat Shading`, `E2E Test Harness`, `HMAC Round State`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._
- **Why does `react` connect `React UI Components` to `Word Display & Heat Shading`, `Project Rules & Conventions`, `Package Manifest`, `API Client & Game Hook`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `CLAUDE.md project instructions` connect `Project Rules & Conventions` to `React UI Components`, `Song Analysis & Memoization`, `Learnings Log`, `Similarity Tuning & KV`, `CI & Deployment`, `Anti-Cheat Boundary`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _187 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Song Resolution & Proximity Scoring` be split into smaller, more focused modules?**
  _Cohesion score 0.05479818230419674 - nodes in this community are weakly interconnected._
- **Should `LRCLIB Ingestion & Catalog Audit` be split into smaller, more focused modules?**
  _Cohesion score 0.05462962962962963 - nodes in this community are weakly interconnected._
- **Should `Dev Tooling & Unit Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.05755693581780538 - nodes in this community are weakly interconnected._