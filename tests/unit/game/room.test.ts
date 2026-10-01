import { describe, expect, it } from "vitest";
import {
  generateRoomCode,
  inviteUrl,
  isRoomCode,
  memberName,
  normalizeRoomCodeInput,
  parseInvitePath,
  parseRoomDaySummary,
  parseRoomEntry,
  parseRoomMessage,
  parseRoomRoundMessage,
  parseRoomSnapshot,
  playerCountLabel,
  PSEUDO_MAX_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  roomExpiresAt,
  sanitizePseudo,
  type RoomSnapshot,
} from "../../../src/game/room";

describe("the room code alphabet", () => {
  it("has no character that reads like another", () => {
    for (const ambiguous of ["0", "O", "1", "I", "L"]) expect(ROOM_CODE_ALPHABET).not.toContain(ambiguous);
    expect(ROOM_CODE_ALPHABET).toBe("ABCDEFGHJKMNPQRSTUVWXYZ23456789");
  });
});

describe("generateRoomCode", () => {
  it("draws six characters from the alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(isRoomCode(code)).toBe(true);
    }
  });

  it("maps bytes onto the alphabet in order", () => {
    expect(generateRoomCode(() => Uint8Array.from([0, 1, 2, 3, 4, 30]))).toBe("ABCDE9");
  });

  // 256 isn't a multiple of 31: without redrawing, the first 8 characters
  // would come up more often than the rest.
  it("redraws the bytes that would bias the first characters", () => {
    const batches = [Uint8Array.from([248, 255, 0, 250, 1, 2]), Uint8Array.from([3, 4, 5, 6, 7, 8])];
    expect(generateRoomCode(() => batches.shift() ?? new Uint8Array(6))).toBe("ABCDEF");
  });
});

describe("normalizeRoomCodeInput", () => {
  it("uppercases as the player types", () => {
    expect(normalizeRoomCodeInput("abc")).toBe("ABC");
  });

  it("ignores whitespace, including pasted in the middle", () => {
    expect(normalizeRoomCodeInput(" ab c1\t23 ")).toBe("ABC123");
  });

  it("stops at six characters, counted after the whitespace is gone", () => {
    expect(normalizeRoomCodeInput("ABC 234 XYZ")).toBe("ABC234");
  });
});

describe("isRoomCode", () => {
  it("accepts exactly six characters of the alphabet", () => {
    expect(isRoomCode("ABC234")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isRoomCode("ABC23")).toBe(false);
    expect(isRoomCode("ABC2345")).toBe(false);
    expect(isRoomCode("abc234")).toBe(false);
    expect(isRoomCode("ABC10O")).toBe(false);
    expect(isRoomCode("ABC 23")).toBe(false);
  });
});

describe("sanitizePseudo", () => {
  it("keeps an ordinary French pseudo as typed", () => {
    expect(sanitizePseudo("Camille")).toBe("Camille");
    expect(sanitizePseudo("Zoé d’Arc-42")).toBe("Zoé d’Arc-42");
  });

  it("composes accents typed as separate marks", () => {
    expect(sanitizePseudo("Zoe\u0301")).toBe("Zoé");
  });

  it("drops control characters, bidi overrides, zero-width characters and emoji", () => {
    expect(sanitizePseudo("Ca\u0000mi\u202Ell\u200Be \u{1F3A4}")).toBe("Camille");
  });

  it("drops the stacked combining marks of zalgo text", () => {
    // None of these marks composes with its letter, so NFC leaves them all to be dropped.
    expect(sanitizePseudo("Z\u0336\u0353\u0317\u035Ca\u0489")).toBe("Za");
  });

  it("collapses whitespace and trims it", () => {
    expect(sanitizePseudo("  Jean \t\n  Luc  ")).toBe("Jean Luc");
  });

  it("caps the length, counted in characters", () => {
    expect(sanitizePseudo("Maximilienne-Éléonore")).toHaveLength(PSEUDO_MAX_LENGTH);
    expect(sanitizePseudo("Maximilienne-Éléonore")).toBe("Maximilienne-Élé");
  });

  it("doesn't end on a space when the cap cuts after one", () => {
    expect(sanitizePseudo("Abcdefghijklmno pqr")).toBe("Abcdefghijklmno");
  });

  it("is empty when nothing usable was typed", () => {
    expect(sanitizePseudo("")).toBe("");
    expect(sanitizePseudo("  \u{1F3A4}\u{1F3B6} ")).toBe("");
  });
});

describe("memberName", () => {
  const unnamed = { id: "m2", name: null, number: 2 };

  it("is the pseudo when there is one", () => {
    expect(memberName({ id: "m1", name: "Camille", number: 1 }, "m2")).toBe("Camille");
  });

  it("falls back to « Toi » for the local player", () => {
    expect(memberName(unnamed, "m2")).toBe("Toi");
  });

  it("falls back to « Joueur N » for anyone else", () => {
    expect(memberName(unnamed, "m1")).toBe("Joueur 2");
    expect(memberName(unnamed, null)).toBe("Joueur 2");
  });
});

describe("playerCountLabel", () => {
  it("agrees in number, French-style", () => {
    expect(playerCountLabel(1)).toBe("1 joueur");
    expect(playerCountLabel(2)).toBe("2 joueurs");
  });
});

describe("roomExpiresAt", () => {
  it("is the next UTC midnight, when the day's song changes", () => {
    expect(roomExpiresAt(Date.UTC(2026, 8, 29, 22, 30))).toBe(Date.UTC(2026, 8, 30));
  });
});

describe("parsing what comes off the network", () => {
  const snapshot: RoomSnapshot = {
    code: "ABC234",
    host: { id: "m1", name: "Camille", number: 1 },
    members: [
      { id: "m1", name: "Camille", number: 1 },
      { id: "m2", name: null, number: 2 },
    ],
    expiresAt: Date.UTC(2026, 8, 30),
  };

  it("reads back a well-formed snapshot, entry and message", () => {
    expect(parseRoomSnapshot(snapshot)).toEqual(snapshot);
    expect(parseRoomEntry({ you: "m2", token: "t", room: snapshot })).toEqual({ you: "m2", token: "t", room: snapshot });
    const message = { type: "room", room: snapshot, event: { kind: "joined", member: snapshot.members[1] } };
    expect(parseRoomMessage(message)).toEqual(message);
    expect(parseRoomMessage({ type: "room", room: snapshot })).toEqual({ type: "room", room: snapshot });
  });

  it("rejects a malformed one rather than throwing", () => {
    expect(parseRoomSnapshot({ ...snapshot, code: "abc" })).toBeNull();
    expect(parseRoomSnapshot({ ...snapshot, members: [{ id: "m1" }] })).toBeNull();
    expect(parseRoomSnapshot({ ...snapshot, host: null })).toBeNull();
    expect(parseRoomEntry({ you: "m2", room: snapshot })).toBeNull();
    expect(parseRoomMessage({ type: "chat", room: snapshot })).toBeNull();
    expect(parseRoomMessage({ type: "room", room: snapshot, event: { kind: "kicked", member: snapshot.host } })).toBeNull();
    expect(parseRoomMessage("pong")).toBeNull();
    expect(parseRoomMessage(null)).toBeNull();
  });

  it("reads the day a room plays, and a member taking it to another", () => {
    expect(parseRoomSnapshot({ ...snapshot, day: "2026-09-20" })?.day).toBe("2026-09-20");
    expect(parseRoomSnapshot({ ...snapshot, day: "2026-02-30" })).toBeNull();
    const moved = { type: "room", room: snapshot, event: { kind: "day", member: snapshot.host, day: "2026-09-20" } };
    expect(parseRoomMessage(moved)).toEqual(moved);
    expect(parseRoomMessage({ ...moved, event: { kind: "day", member: snapshot.host } })).toBeNull();
  });

  it("reads a day's summary, keeping no hidden word's text, and drops a malformed one alone", () => {
    const hidden = { text: "______", isWord: true, revealed: false, devHint: "refuge", revealHint: "refuge" };
    const summary = { day: "2026-09-20", title: [hidden], percent: 12, victory: false, guesses: 3 };
    expect(parseRoomDaySummary(summary)).toEqual({
      ...summary,
      title: [{ text: "______", isWord: true, revealed: false }],
    });
    expect(parseRoomDaySummary({ ...summary, guesses: -1 })).toBeNull();

    const round = { state: "s", day: "2026-09-20", title: { tokens: [] }, sections: [], victory: false };
    const message = parseRoomRoundMessage({ type: "round", round, guesses: [], days: [summary, { day: "nope" }] });
    expect(message?.days?.map((day) => day.day)).toEqual(["2026-09-20"]);
  });

  it("reads an empty pseudo as unnamed", () => {
    const parsed = parseRoomSnapshot({ ...snapshot, host: { id: "m1", name: "", number: 1 } });
    expect(parsed?.host.name).toBeNull();
  });
});

describe("invite links", () => {
  it("puts the code under /salon/ on the site's own origin", () => {
    expect(inviteUrl("ABC234", "https://lyrix-eyg.pages.dev")).toBe("https://lyrix-eyg.pages.dev/salon/ABC234");
    expect(inviteUrl("ABC234", "http://localhost:5173")).toBe("http://localhost:5173/salon/ABC234");
  });

  it("reads the code back, forgiving case and a trailing slash", () => {
    expect(parseInvitePath(new URL(inviteUrl("ABC234", "https://example.test")).pathname)).toBe("ABC234");
    expect(parseInvitePath("/salon/abc234")).toBe("ABC234");
    expect(parseInvitePath("/salon/ABC234/")).toBe("ABC234");
  });

  it("is no invite for any other path, or a code that can't exist", () => {
    for (const path of ["/", "/salon/", "/salon", "/ABC234", "/salon/ABC23", "/salon/ABC0I1", "/salon/ABC234/x"]) {
      expect(parseInvitePath(path)).toBeNull();
    }
  });
});
