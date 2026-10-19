import { afterEach, describe, expect, it, vi } from "vitest";
import type { Song } from "../../../src/game/types";
import { catalog, type CatalogEntry } from "../../../worker/src/catalog";
import {
  auditEntry,
  auditSong,
  duplicateCatalogIds,
  failureAdvice,
  formatAudit,
  SHORT_SONG_WORDS,
  summarizeAudits,
  type CatalogAudit,
} from "../../../scripts/lib/catalogAudit";

const entry: CatalogEntry = { id: "papaoutai", artist: "Stromae", title: "Papaoutai" };

/** A song whose lyrics comfortably clear the "looks like an excerpt" threshold. */
function song(lines: string[] = []): Song {
  const filler = Array.from({ length: SHORT_SONG_WORDS }, () => "mot").join(" ");
  return { id: entry.id, title: entry.title, artist: entry.artist, sections: [{ label: "Couplet 1", lines: [filler, ...lines] }] };
}

describe("auditSong", () => {
  it("counts the sections and words of a resolved song", () => {
    const resolved: Song = {
      ...song(),
      sections: [
        { label: "Couplet 1", lines: ["Dites-moi d'ou il vient"] },
        { label: "Couplet 2", lines: ["Enfin je saurais ou je vais"] },
      ],
    };
    const audit = auditSong(entry, resolved);
    expect(audit.resolved).toBe(true);
    expect(audit.sections).toBe(2);
    // Counted the way the game counts blanks: an elision splits into two ("d'ou" -> "d", "ou").
    expect(audit.words).toBe(12);
  });

  it("marks an entry LRCLIB could not serve", () => {
    const audit = auditSong(entry, null);
    expect(audit).toEqual({ id: entry.id, label: "Stromae - Papaoutai", resolved: false, sections: 0, words: 0, warnings: [] });
  });

  it("stays quiet about a healthy song", () => {
    expect(auditSong(entry, song()).warnings).toEqual([]);
  });

  // The point of the script: surface LRCLIB formatting the Worker's cleanup
  // doesn't know about yet, rather than letting it reach a player as a blank.
  it("flags annotations that survived the cleanup", () => {
    const warnings = auditSong(entry, song(["[Refrain]"])).warnings;
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("bracketed annotation");
    expect(warnings[0]).toContain("[Refrain]");
  });

  it("flags leftover musical-note filler and timestamps", () => {
    expect(auditSong(entry, song(["♪"])).warnings[0]).toContain("musical-note filler");
    expect(auditSong(entry, song(["00:12 une ligne"])).warnings[0]).toContain("timestamp");
  });

  it("flags a song short enough to look like an excerpt", () => {
    const audit = auditSong(entry, { ...song(), sections: [{ label: "Couplet 1", lines: ["Une ligne bien courte"] }] });
    expect(audit.resolved).toBe(true);
    expect(audit.warnings[0]).toContain("excerpt");
  });
});

describe("auditEntry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Runs the Worker's real LRCLIB path against a stubbed fetch, skipping its waits between attempts. */
  async function auditAgainst(respond: () => Response): Promise<{ audit: CatalogAudit; calls: number }> {
    const fetchMock = vi.fn(async () => respond());
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    const pending = auditEntry(entry);
    await vi.runAllTimersAsync();
    return { audit: await pending, calls: fetchMock.mock.calls.length };
  }

  // 2026-10-19: an overloaded LRCLIB answered 503 to 24 of 61 entries, which
  // must read as "retry later", never as songs to replace.
  it("reports an LRCLIB that answered 503 as unavailable, after trying again", async () => {
    const { audit, calls } = await auditAgainst(() => new Response("ServerOverloaded", { status: 503 }));
    expect(calls).toBe(3);
    expect(audit).toMatchObject({ resolved: false, unavailable: "HTTP 503" });
    expect(formatAudit(audit)).toContain("LRCLIB didn't answer (HTTP 503), retry later");
    expect(formatAudit(audit)).not.toContain("no usable lyrics");
  });

  it("reports a network failure as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    vi.useFakeTimers();
    const pending = auditEntry(entry);
    await vi.runAllTimersAsync();
    expect(await pending).toMatchObject({ resolved: false, unavailable: "network error" });
  });

  it("reports an empty answer as missing lyrics, not as unavailable", async () => {
    const { audit, calls } = await auditAgainst(() => Response.json([]));
    expect(calls).toBe(1);
    expect(audit.resolved).toBe(false);
    expect(audit.unavailable).toBeUndefined();
    expect(formatAudit(audit)).toContain("no usable lyrics on LRCLIB");
  });

  it("reports a too-thin answer as missing lyrics, not as unavailable", async () => {
    const stub = [{ artistName: "Stromae", instrumental: false, plainLyrics: "Paroles non disponibles", syncedLyrics: null }];
    const { audit } = await auditAgainst(() => Response.json(stub));
    expect(audit.resolved).toBe(false);
    expect(audit.unavailable).toBeUndefined();
  });

  it("audits a song LRCLIB served", async () => {
    const audit = await auditEntry(entry, async () => song());
    expect(audit).toMatchObject({ resolved: true, words: SHORT_SONG_WORDS });
  });

  it("lets any other error through", async () => {
    await expect(auditEntry(entry, async () => Promise.reject(new TypeError("bug")))).rejects.toThrow("bug");
  });
});

describe("formatAudit", () => {
  it("tells a failure apart from a success at a glance", () => {
    expect(formatAudit(auditSong(entry, null))).toContain("FAIL");
    expect(formatAudit(auditSong(entry, song()))).toContain("ok");
  });

  it("prints each warning under its entry", () => {
    const lines = formatAudit(auditSong(entry, song(["[Refrain]"]))).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("bracketed annotation");
  });
});

describe("summarizeAudits", () => {
  it("counts resolved, failed and warned entries", () => {
    const audits = [auditSong(entry, song()), auditSong(entry, song(["[Refrain]"])), auditSong(entry, null)];
    expect(summarizeAudits(audits)).toEqual({ resolved: 2, failed: 1, warned: 1 });
  });
});

describe("failureAdvice", () => {
  it("says nothing when everything resolved", () => {
    expect(failureAdvice([auditSong(entry, song())])).toBeNull();
  });

  it("points at the catalog when one entry among several failed", () => {
    const advice = failureAdvice([auditSong(entry, song()), auditSong(entry, null)]);
    expect(advice).toContain("worker/src/catalog.ts");
    expect(advice).not.toContain("unreachable");
  });

  // A blocked or down LRCLIB turns every lookup into "no results", which reads
  // exactly like 30 wrong artist/title pairs unless the report says otherwise.
  it("points at the network when every entry failed at once", () => {
    const advice = failureAdvice([auditSong(entry, null), auditSong(entry, null)]);
    expect(advice).toContain("unreachable");
  });

  it("still blames the entry when it is the only one checked", () => {
    expect(failureAdvice([auditSong(entry, null)])).toContain("worker/src/catalog.ts");
  });

  it("says to retry entries LRCLIB didn't answer for, rather than replace them", () => {
    const advice = failureAdvice([auditSong(entry, song()), auditSong(entry, null, "HTTP 503")]);
    expect(advice).toContain("didn't answer for 1 entry");
    expect(advice).toContain("--song");
    expect(advice).not.toContain("replacing the entry");
  });
});

describe("duplicateCatalogIds", () => {
  it("reports an id used twice", () => {
    expect(duplicateCatalogIds([entry, { ...entry, title: "Autre" }, { ...entry, id: "je-veux" }])).toEqual([entry.id]);
  });

  // A duplicate id would make two catalog entries share one cached song, one
  // KV similarity table and one day of the rotation.
  it("holds for the catalog actually shipped", () => {
    expect(duplicateCatalogIds(catalog)).toEqual([]);
  });
});
