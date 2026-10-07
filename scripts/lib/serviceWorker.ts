import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Plugin, type Rolldown } from "vite";
import { SERVICE_WORKER_PATH, SHELL_URL, type Precache } from "../../src/serviceWorker/routes";
import { PNG_ICONS } from "./favicon";

/**
 * Builds the service worker (src/serviceWorker/sw.ts, #79) into /sw.js,
 * with the list of files it keeps: this build's own, which only exists
 * once the app is bundled.
 *
 * It is bundled on its own, as a classic script: a service worker loaded as
 * a module isn't supported everywhere yet, and bundled with the app it would
 * share chunks with it, imported by `import` statements a classic script
 * can't run.
 */

const ENTRY = fileURLToPath(new URL("../../src/serviceWorker/sw.ts", import.meta.url));

/**
 * The files of public/ the app shell uses: the manifest and every icon. Not
 * the link previews, robots.txt, the sitemap or the Pages rules, which no
 * player's browser asks for.
 */
export const PRECACHED_PUBLIC_FILES: readonly string[] = [
  "manifest.webmanifest",
  "favicon.svg",
  ...PNG_ICONS.map((icon) => icon.file),
];

export interface BuiltFile {
  /** As the build names it, relative to its output directory. */
  fileName: string;
  content: string | Uint8Array;
}

/**
 * What the worker keeps of a build: the app shell (`index`, served at
 * SHELL_URL), the bundled scripts and styles (`assets/`, named after their
 * content), and the public files the shell uses. Its version changes with
 * any of them, so a deploy that changes anything installs a new worker.
 */
export function precacheFor(index: BuiltFile, built: readonly BuiltFile[], publicFiles: readonly BuiltFile[]): Precache {
  const assets = built.filter((file) => file.fileName.startsWith("assets/"));
  const kept = [...assets, ...publicFiles].sort((a, b) => a.fileName.localeCompare(b.fileName));
  const hash = createHash("sha256").update(index.content);
  for (const file of kept) hash.update(`\0${file.fileName}\0`).update(file.content);
  return {
    version: hash.digest("hex").slice(0, 16),
    urls: [SHELL_URL, ...kept.map((file) => `/${file.fileName}`)],
  };
}

/** The worker's script, its file list written in. */
export async function buildServiceWorker(precache: Precache, mode: string): Promise<string> {
  const result = await build({
    configFile: false,
    mode,
    logLevel: "warn",
    publicDir: false,
    define: { __LYRIX_PRECACHE__: JSON.stringify(precache) },
    build: {
      write: false,
      emptyOutDir: false,
      modulePreload: false,
      rolldownOptions: {
        input: ENTRY,
        output: { format: "iife", entryFileNames: SERVICE_WORKER_PATH.slice(1) },
        // Only constants are imported from the game's modules (INVITE_PATH):
        // the rest of their top-level code has no business in the worker.
        treeshake: { moduleSideEffects: false },
      },
    },
  });
  if (Array.isArray(result) || !("output" in result)) throw new Error("service worker: expected a single, unwatched build");
  const chunks = result.output.filter((file): file is Rolldown.OutputChunk => file.type === "chunk");
  if (chunks.length !== 1) throw new Error(`service worker: expected one script, the build made ${chunks.length}`);
  return chunks[0].code;
}

/** Emits /sw.js with the build. Nothing in dev, where src/pwa.ts registers no worker. */
export function serviceWorkerPlugin(): Plugin {
  let publicDir = "";
  let mode = "production";
  return {
    name: "lyrix:service-worker",
    apply: "build",
    // After Vite's own HTML plugin has written index.html into the bundle.
    enforce: "post",
    configResolved(config) {
      publicDir = config.publicDir;
      mode = config.mode;
    },
    async generateBundle(_options, bundle) {
      const files: BuiltFile[] = Object.values(bundle).map((file) => ({
        fileName: file.fileName,
        content: file.type === "chunk" ? file.code : file.source,
      }));
      const index = files.find((file) => file.fileName === "index.html");
      if (!index) throw new Error("service worker: the build has no index.html to keep as the app shell");
      const publicFiles = PRECACHED_PUBLIC_FILES.map((fileName) => ({
        fileName,
        content: readFileSync(join(publicDir, fileName)),
      }));
      const precache = precacheFor(index, files, publicFiles);
      this.emitFile({
        type: "asset",
        fileName: SERVICE_WORKER_PATH.slice(1),
        source: await buildServiceWorker(precache, mode),
      });
    },
  };
}
