// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ROOM_CLOSE_EXPIRED,
  ROOM_CLOSE_LEFT,
  ROOM_CLOSE_UNKNOWN,
  ROOM_PING,
  type RoomEntry,
  type RoomGuess,
  type RoomGuessResult,
  type RoomMember,
  type RoomMessage,
  type RoomRoundMessage,
  type RoomSnapshot,
} from "../../../src/game/room";
import { utcDay } from "../../../src/game/daily";
import type { RoundView } from "../../../src/game/types";

/**
 * Rooms (issue #29) as the player meets them: the dialog, the Salon card, the
 * header, and the dock's feedback line, over a fake WebSocket the tests play
 * the room's side of. Like gameScreen.test.tsx, it counts lyrics tokens: a
 * player arriving in the room has nothing to do with the lyrics.
 *
 * In a room the page plays the room's round (#30), which the room sends on
 * connection: mountGame plays that part too when a room was saved.
 */

const wordTokenRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock("../../../src/components/WordToken", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/components/WordToken")>();
  const Counted: typeof actual.WordToken = (props) => {
    wordTokenRenders.count += 1;
    return actual.WordToken(props);
  };
  return { ...actual, WordToken: Counted };
});

const fetchRound = vi.hoisted(() => vi.fn());
const submitGuess = vi.hoisted(() => vi.fn());
vi.mock("../../../src/api/client", () => ({ fetchRound, submitGuess }));

const { GameScreen } = await import("../../../src/components/GameScreen");
const { KEEPALIVE_MS, RECONNECT_DELAYS_MS } = await import("../../../src/hooks/useRoom");

const SOCKET_OPEN = 1;
const SOCKET_CLOSED = 3;

/** Stands in for the browser's WebSocket; the tests drive the room's end of it. */
class FakeWebSocket extends EventTarget {
  static readonly instances: FakeWebSocket[] = [];
  readyState = 0;
  readonly sent: string[] = [];

  constructor(readonly url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }
  close(code = 1000): void {
    this.#closed(code);
  }

  // The room's side.
  open(): void {
    if (this.readyState === SOCKET_OPEN) return;
    act(() => {
      this.readyState = SOCKET_OPEN;
      this.dispatchEvent(new Event("open"));
    });
  }
  receive(message: RoomMessage | RoomRoundMessage): void {
    act(() => {
      this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) }));
    });
  }
  drop(code: number): void {
    act(() => this.#closed(code));
  }

  #closed(code: number): void {
    if (this.readyState === SOCKET_CLOSED) return;
    this.readyState = SOCKET_CLOSED;
    this.dispatchEvent(new CloseEvent("close", { code }));
  }
}

function latestSocket(): FakeWebSocket {
  const socket = FakeWebSocket.instances.at(-1);
  if (!socket) throw new Error("no WebSocket was opened");
  return socket;
}

const camille: RoomMember = { id: "m1", name: "Camille", number: 1 };
const leo: RoomMember = { id: "m2", name: "Léo", number: 2 };

function snapshot(members: RoomMember[] = [camille]): RoomSnapshot {
  return { code: "ABC234", host: camille, members, expiresAt: Date.now() + 3_600_000 };
}

function entry(you: string = camille.id, members?: RoomMember[]): RoomEntry {
  return { you, token: `token-${you}`, room: snapshot(members) };
}

/** A room saved by an earlier visit: the page reconnects to it on load. */
function seedRoom(saved: RoomEntry = entry()): void {
  window.localStorage.setItem("lyrix:room", JSON.stringify(saved));
}

/** `found`: the words shown revealed, as the Worker would after they were found. */
function tokens(text: string, found: readonly string[] = []) {
  return text.split(" ").flatMap((word, index) => {
    const revealed = found.includes(word.toLowerCase());
    const token = { text: revealed ? word : "_".repeat(word.length), isWord: true, revealed };
    return index === 0 ? [token] : [{ text: " ", isWord: false, revealed: true }, token];
  });
}

function round(state = "state-0", found: readonly string[] = []): RoundView {
  const victory = ["le", "refuge", "de", "novembre"].every((word) => found.includes(word));
  return {
    state,
    day: utcDay(),
    title: { tokens: tokens("Le refuge de novembre", found) },
    sections: [{ label: "Couplet 1", lines: [{ tokens: tokens("Le vent referme la porte du jardin", found) }] }],
    victory,
    ...(victory ? { artist: "Anaïs Verger" } : {}),
  };
}

function roomGuess(display: string, by: RoomMember, found: boolean): RoomGuess {
  return { key: display.toLowerCase(), display, found, score: found ? 100 : null, near: [], by };
}

/** The room's round, `guesses` newest first, revealing the ones found. */
function roomRound(guesses: RoomGuess[] = []): { round: RoundView; guesses: RoomGuess[] } {
  const found = guesses.filter((guess) => guess.found).map((guess) => guess.key);
  return { round: round(`room-${guesses.length}`, found), guesses };
}

function roundMessage(guesses: RoomGuess[] = [], latest?: string, winningKey?: string): RoomRoundMessage {
  return { type: "round", ...roomRound(guesses), ...(latest ? { latest } : {}), ...(winningKey ? { winningKey } : {}) };
}

function guessResult(guesses: RoomGuess[], duplicate = false): RoomGuessResult {
  return { ...roomRound(guesses), guess: guesses[0], duplicate };
}

const fetchMock = vi.fn<typeof fetch>();

function answer(status: number, body: unknown = null): void {
  fetchMock.mockResolvedValueOnce(new Response(body === null ? null : JSON.stringify(body), { status }));
}

function sentBody(call = 0): Record<string, unknown> {
  return JSON.parse(String(fetchMock.mock.calls[call]?.[1]?.body)) as Record<string, unknown>;
}

const PLACEHOLDER = /^Propose un mot/;

/** Renders the game; in a saved room, the room sends its round, as it does on every connection. */
async function mountGame(guesses: RoomGuess[] = []): Promise<HTMLInputElement> {
  render(<GameScreen />);
  if (FakeWebSocket.instances.length > 0) latestSocket().receive(roundMessage(guesses));
  await waitFor(() => expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeTruthy());
  wordTokenRenders.count = 0;
  return screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
}

function feedbackText(): string | null {
  return document.querySelector(".lyrix-feedback")?.textContent ?? null;
}

function roomCard(): HTMLElement | null {
  return screen.queryByRole("region", { name: "Salon" });
}

beforeEach(() => {
  wordTokenRenders.count = 0;
  FakeWebSocket.instances.length = 0;
  window.localStorage.clear();
  fetchRound.mockReset().mockResolvedValue(round());
  submitGuess.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("navigator", { ...window.navigator, clipboard: { writeText: vi.fn(async () => {}) } });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a room saved by an earlier visit", () => {
  it("is reconnected to on load, and shows in the side column and the header", async () => {
    seedRoom();
    await mountGame();

    const url = new URL(latestSocket().url);
    expect(url.protocol).toBe("ws:");
    expect(url.pathname).toBe("/api/rooms/ABC234/ws");
    expect(url.searchParams.get("token")).toBe("token-m1");
    expect(within(roomCard() as HTMLElement).getByText("ABC234")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salon · 1 joueur" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Chercher à plusieurs/ })).toBeNull();
  });

  it("is dropped without a connection once it has expired", async () => {
    seedRoom({ ...entry(), room: { ...snapshot(), expiresAt: Date.now() - 1 } });
    await mountGame();

    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(roomCard()).toBeNull();
    expect(window.localStorage.getItem("lyrix:room")).toBeNull();
  });
});

describe("a player arriving in the room", () => {
  it("is announced in the dock and listed everywhere, without re-rendering a single lyrics token", async () => {
    seedRoom();
    await mountGame();
    latestSocket().open();

    latestSocket().receive({ type: "room", room: snapshot([camille, leo]), event: { kind: "joined", member: leo } });

    expect(feedbackText()).toBe("Léo a rejoint le salon.");
    expect(screen.getByRole("button", { name: "Salon · 2 joueurs" })).toBeTruthy();
    expect(within(roomCard() as HTMLElement).getByText("Léo")).toBeTruthy();
    expect(wordTokenRenders.count).toBe(0);
  });

  it("gives way to the outcome of the player's next guess, and never shakes the input", async () => {
    answer(200, guessResult([roomGuess("vent", camille, false)]));
    seedRoom();
    const input = await mountGame();
    latestSocket().open();
    latestSocket().receive({ type: "room", room: snapshot([camille, leo]), event: { kind: "joined", member: leo } });
    expect((input.parentElement as HTMLElement).className).not.toMatch(/is-shake/);

    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);

    await waitFor(() => expect(feedbackText()).toBe("« vent » n’y est pas."));
  });

  it("is saved, so a reload shows the room as it last was", async () => {
    seedRoom();
    await mountGame();
    latestSocket().open();
    latestSocket().receive({ type: "room", room: snapshot([camille, leo]), event: { kind: "joined", member: leo } });

    const saved = JSON.parse(window.localStorage.getItem("lyrix:room") ?? "null") as RoomEntry;
    expect(saved.room.members).toEqual([camille, leo]);
    expect(saved.token).toBe("token-m1");
  });

  it("tells the others by name when a player leaves", async () => {
    seedRoom(entry(camille.id, [camille, leo]));
    await mountGame();
    latestSocket().open();

    latestSocket().receive({ type: "room", room: snapshot([camille]), event: { kind: "left", member: leo } });

    expect(feedbackText()).toBe("Léo a quitté le salon.");
    expect(screen.getByRole("button", { name: "Salon · 1 joueur" })).toBeTruthy();
  });
});

describe("the room's connection", () => {
  it("is retried after a drop, a little later each time, and says so meanwhile", async () => {
    seedRoom();
    await mountGame();
    latestSocket().open();
    vi.useFakeTimers();

    latestSocket().drop(1006);
    expect(roomCard()?.textContent).toContain("Connexion au salon perdue");
    act(() => vi.advanceTimersByTime(RECONNECT_DELAYS_MS[0] - 1));
    expect(FakeWebSocket.instances).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(FakeWebSocket.instances).toHaveLength(2);

    latestSocket().drop(1006);
    act(() => vi.advanceTimersByTime(RECONNECT_DELAYS_MS[1] - 1));
    expect(FakeWebSocket.instances).toHaveLength(2);
    act(() => vi.advanceTimersByTime(1));
    expect(FakeWebSocket.instances).toHaveLength(3);

    latestSocket().open();
    expect(roomCard()?.textContent).toContain("En attente de joueurs…");
    // Still the same room: nothing was lost on the way.
    expect(window.localStorage.getItem("lyrix:room")).toContain("ABC234");
  });

  it("sends a keep-alive while idle", async () => {
    seedRoom();
    await mountGame();
    vi.useFakeTimers();
    latestSocket().open();

    act(() => vi.advanceTimersByTime(KEEPALIVE_MS));

    expect(latestSocket().sent).toEqual([ROOM_PING]);
  });

  it("ends the room for good once it has expired, and says so", async () => {
    seedRoom();
    await mountGame();
    latestSocket().open();
    vi.useFakeTimers();

    latestSocket().drop(ROOM_CLOSE_EXPIRED);
    act(() => vi.advanceTimersByTime(60_000));

    expect(roomCard()).toBeNull();
    expect(feedbackText()).toBe("Le salon a expiré avec la chanson du jour.");
    expect(window.localStorage.getItem("lyrix:room")).toBeNull();
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Jouer à plusieurs" })).toBeTruthy();
  });

  it("gives up on a room that no longer knows the player", async () => {
    seedRoom();
    await mountGame();

    latestSocket().drop(ROOM_CLOSE_UNKNOWN);

    expect(roomCard()).toBeNull();
    expect(feedbackText()).toBe("Ce salon n’existe plus.");
  });

  it("follows another tab out of the room, silently", async () => {
    seedRoom();
    await mountGame();
    latestSocket().open();

    latestSocket().drop(ROOM_CLOSE_LEFT);

    expect(roomCard()).toBeNull();
    expect(feedbackText()).toBeNull();
  });
});

describe("leaving the room", () => {
  it("tells the room with the member's token, hangs up, and brings the promo card back", async () => {
    answer(204);
    seedRoom();
    await mountGame();
    const socket = latestSocket();
    socket.open();

    fireEvent.click(within(roomCard() as HTMLElement).getByRole("button", { name: "Quitter le salon" }));

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://localhost:3000/api/rooms/ABC234/leave");
    expect(sentBody()).toEqual({ token: "token-m1" });
    expect(socket.readyState).toBe(SOCKET_CLOSED);
    expect(roomCard()).toBeNull();
    expect(screen.getByRole("button", { name: /Chercher à plusieurs/ })).toBeTruthy();
    expect(window.localStorage.getItem("lyrix:room")).toBeNull();
  });
});

describe("the multiplayer dialog", () => {
  function openDialog(): HTMLElement {
    fireEvent.click(screen.getByRole("button", { name: "Jouer à plusieurs" }));
    return screen.getByRole("dialog", { name: "Jouer à plusieurs" });
  }

  it("creates a room and stays open on it, the player as host", async () => {
    answer(201, entry());
    await mountGame();
    const dialog = openDialog();

    fireEvent.change(within(dialog).getByLabelText("Ton pseudo"), { target: { value: "  Camille 🎤 " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Créer le salon" }));

    await waitFor(() => expect(within(dialog).getByText("ABC234")).toBeTruthy());
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://localhost:3000/api/rooms");
    // Sanitized before it leaves, exactly as the room would store it.
    expect(sentBody()).toEqual({ pseudo: "Camille" });
    expect(within(dialog).getByRole("heading", { name: "Joueurs · 1" })).toBeTruthy();
    const me = within(dialog).getByText("Camille").closest("li") as HTMLElement;
    expect(within(me).getByText("toi")).toBeTruthy();
    expect(within(me).getByText("hôte")).toBeTruthy();
    expect(FakeWebSocket.instances).toHaveLength(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Chercher ensemble" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("joins a room: closes, and the dock says whose room it is", async () => {
    answer(201, entry(leo.id, [camille, leo]));
    await mountGame();
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Rejoindre" }));

    const code = within(dialog).getByLabelText("Code du salon") as HTMLInputElement;
    fireEvent.change(code, { target: { value: "abc 234" } });
    expect(code.value).toBe("ABC234");
    fireEvent.change(within(dialog).getByLabelText("Ton pseudo"), { target: { value: "Léo" } });
    fireEvent.submit(code);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://localhost:3000/api/rooms/ABC234/members");
    expect(sentBody()).toEqual({ pseudo: "Léo" });
    // The dock is back with the room's round, which the room sends on connection.
    latestSocket().receive(roundMessage());
    expect(feedbackText()).toBe("Tu as rejoint le salon de Camille.");
    expect(screen.getByRole("button", { name: "Salon · 2 joueurs" })).toBeTruthy();
  });

  it("flags a code that is too short without asking the server, and shakes on every attempt", async () => {
    await mountGame();
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Rejoindre" }));
    const code = within(dialog).getByLabelText("Code du salon") as HTMLInputElement;
    fireEvent.change(code, { target: { value: "abc" } });

    fireEvent.submit(code);
    expect(within(dialog).getByRole("alert").textContent).toBe("Le code doit contenir 6 caractères.");
    expect(code.getAttribute("aria-invalid")).toBe("true");
    expect(code.getAttribute("aria-describedby")).toBe(within(dialog).getByRole("alert").id);
    const firstShake = code.className;
    expect(firstShake).toMatch(/is-invalid is-shake-/);

    fireEvent.submit(code);
    expect(code.className).toMatch(/is-shake-/);
    expect(code.className).not.toBe(firstShake);
    expect(fetchMock).not.toHaveBeenCalled();

    // Editing the code clears the error.
    fireEvent.change(code, { target: { value: "abcd" } });
    expect(within(dialog).queryByRole("alert")).toBeNull();
    expect(code.getAttribute("aria-invalid")).toBe("false");
  });

  it("tells an unknown code apart from too many attempts", async () => {
    answer(404, { error: "no such room" });
    answer(429, { error: "too many attempts" });
    await mountGame();
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Rejoindre" }));
    const code = within(dialog).getByLabelText("Code du salon") as HTMLInputElement;
    fireEvent.change(code, { target: { value: "ZZZZZZ" } });

    fireEvent.submit(code);
    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toBe("Aucun salon ne porte ce code, ou il a expiré.")
    );
    expect(code.getAttribute("aria-invalid")).toBe("true");

    fireEvent.submit(code);
    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toBe("Trop de tentatives : réessaie dans une minute.")
    );
    // Nothing wrong with the code itself this time.
    expect(code.getAttribute("aria-invalid")).toBe("false");
    expect(roomCard()).toBeNull();
  });

  it("treats a code with a character no code has as unknown, without asking the server", async () => {
    await mountGame();
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Rejoindre" }));
    const code = within(dialog).getByLabelText("Code du salon") as HTMLInputElement;
    fireEvent.change(code, { target: { value: "ABC10O" } });

    fireEvent.submit(code);

    expect(within(dialog).getByRole("alert").textContent).toBe("Aucun salon ne porte ce code, ou il a expiré.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says so when the room can't be created", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await mountGame();
    const dialog = openDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "Créer le salon" }));

    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toBe("Le salon n’a pas pu être créé, réessaie.")
    );
    expect(roomCard()).toBeNull();
  });

  it("shows the room, not the forms, when opened from inside one", async () => {
    seedRoom(entry(leo.id, [camille, leo]));
    await mountGame();

    fireEvent.click(screen.getByRole("button", { name: "Salon · 2 joueurs" }));
    const dialog = screen.getByRole("dialog", { name: "Jouer à plusieurs" });

    expect(within(dialog).queryByRole("tab")).toBeNull();
    expect(within(dialog).getByText("ABC234")).toBeTruthy();
    const host = within(dialog).getByText("Camille").closest("li") as HTMLElement;
    expect(within(host).getByText("hôte")).toBeTruthy();
    expect(within(host).queryByText("toi")).toBeNull();
  });

  it("copies the code, and says so for a moment", async () => {
    seedRoom();
    await mountGame();
    const card = roomCard() as HTMLElement;

    fireEvent.click(within(card).getByRole("button", { name: "Copier le code" }));

    await waitFor(() => expect(within(card).getByRole("button", { name: "Copié !" })).toBeTruthy());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("ABC234");
    await waitFor(() => expect(within(card).getByRole("button", { name: "Copier le code" })).toBeTruthy(), {
      timeout: 2500,
    });
  });
});

describe("an invite link", () => {
  const INVITE_URL = "http://localhost:3000/salon/ABC234";

  function inviteTo(code: string): void {
    window.history.replaceState(null, "", `/salon/${code}`);
  }

  function dialog(): HTMLElement {
    return screen.getByRole("dialog", { name: "Jouer à plusieurs" });
  }

  afterEach(() => window.history.replaceState(null, "", "/"));

  it("opens the dialog on « Rejoindre », the code typed in, and asks nothing of the server until the player joins", async () => {
    inviteTo("ABC234");
    await mountGame();

    const code = within(dialog()).getByLabelText("Code du salon") as HTMLInputElement;
    expect(code.value).toBe("ABC234");
    expect(within(dialog()).getByRole("tab", { name: "Rejoindre" }).getAttribute("aria-selected")).toBe("true");
    expect(dialog().textContent).toContain("On t’invite dans ce salon");
    // Once opened, the address is the game's again: a reload doesn't offer the room twice.
    expect(window.location.pathname).toBe("/");
    expect(fetchMock).not.toHaveBeenCalled();

    answer(201, entry(leo.id, [camille, leo]));
    fireEvent.change(within(dialog()).getByLabelText("Ton pseudo"), { target: { value: "Léo" } });
    fireEvent.submit(code);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://localhost:3000/api/rooms/ABC234/members");
    latestSocket().receive(roundMessage());
    expect(feedbackText()).toBe("Tu as rejoint le salon de Camille.");
  });

  it("is only offered once: closing the dialog drops it", async () => {
    inviteTo("ABC234");
    await mountGame();

    fireEvent.keyDown(dialog(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Jouer à plusieurs" }));

    expect(within(dialog()).getByRole("tab", { name: "Créer un salon" }).getAttribute("aria-selected")).toBe("true");
  });

  it("does nothing for the room the player is already in", async () => {
    seedRoom();
    inviteTo("ABC234");
    await mountGame();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.pathname).toBe("/");
  });

  it("ignores a path that can't be a room's", async () => {
    inviteTo("ABC0I1");
    await mountGame();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("from inside another room, says joining leaves it, and leaves it only once in the new one", async () => {
    seedRoom();
    inviteTo("XYZ789");
    await mountGame();
    const oldSocket = latestSocket();
    oldSocket.open();

    expect(within(dialog()).getByLabelText<HTMLInputElement>("Code du salon").value).toBe("XYZ789");
    expect(dialog().textContent).toContain("Le rejoindre te fera quitter le salon ABC234.");

    const next: RoomEntry = { you: "m9", token: "token-m9", room: { ...snapshot([camille]), code: "XYZ789" } };
    answer(201, next);
    answer(204);
    fireEvent.submit(within(dialog()).getByLabelText("Code du salon"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://localhost:3000/api/rooms/XYZ789/members");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("http://localhost:3000/api/rooms/ABC234/leave");
    expect(sentBody(1)).toEqual({ token: "token-m1" });
    expect(oldSocket.readyState).toBe(SOCKET_CLOSED);
    expect(latestSocket().url).toContain("/api/rooms/XYZ789/ws");
  });

  it("keeps a player in their room when the invited one turns them away", async () => {
    seedRoom();
    inviteTo("XYZ789");
    await mountGame();

    answer(404);
    fireEvent.submit(within(dialog()).getByLabelText("Code du salon"));

    await waitFor(() => expect(within(dialog()).getByRole("alert").textContent).toMatch(/Aucun salon/));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("lyrix:room")).toContain("ABC234");
  });

  it("is copied from the Salon card and from the dialog", async () => {
    seedRoom();
    await mountGame();
    const card = roomCard() as HTMLElement;

    fireEvent.click(within(card).getByRole("button", { name: "Copier le lien d’invitation" }));
    await waitFor(() => expect(within(card).getByRole("button", { name: "Copié !" })).toBeTruthy());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(INVITE_URL);

    fireEvent.click(screen.getByRole("button", { name: "Salon · 1 joueur" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Copier le lien" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2));
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(INVITE_URL);
  });

  it("goes to the share sheet on a phone, and to the clipboard only if sharing fails", async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, share });
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: query === "(pointer: coarse)",
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList
    );
    seedRoom();
    await mountGame();
    const card = roomCard() as HTMLElement;

    fireEvent.click(within(card).getByRole("button", { name: "Partager le lien d’invitation" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ url: INVITE_URL }));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();

    share.mockRejectedValueOnce(new DOMException("closed", "AbortError"));
    fireEvent.click(within(card).getByRole("button", { name: "Partager le lien d’invitation" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();

    share.mockRejectedValueOnce(new DOMException("not allowed", "NotAllowedError"));
    fireEvent.click(within(card).getByRole("button", { name: "Partager le lien d’invitation" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(INVITE_URL));
  });
});

function lyricsText(): string {
  return document.querySelector(".lyrix-song")?.textContent ?? "";
}

function wordsCard(): HTMLElement {
  return screen.getByRole("region", { name: "Mots du groupe" });
}

function dockRow(input: HTMLInputElement): HTMLElement {
  return input.parentElement as HTMLElement;
}

function feedbackDotColor(): string | null {
  const dot = document.querySelector<HTMLElement>(".lyrix-feedback .lyrix-player-dot");
  return dot ? dot.style.getPropertyValue("--player") : null;
}

/** The win's confetti (#42), while it falls. */
function confetti(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".lyrix-confetti");
}

describe("the room's round (#30)", () => {
  it("takes the solo round's place, and shows nothing until the room has sent it", async () => {
    seedRoom();
    render(<GameScreen />);

    await waitFor(() => expect(fetchRound).toHaveBeenCalled());
    expect(screen.getByText("Chargement de la partie…")).toBeTruthy();
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();

    latestSocket().receive(roundMessage([roomGuess("vent", leo, true)]));

    expect(screen.getByPlaceholderText("Propose un mot au groupe…")).toBeTruthy();
    expect(lyricsText()).toContain("vent");
    expect(within(wordsCard()).getByText("vent")).toBeTruthy();
  });

  it("says whose words the card will hold while it is empty", async () => {
    seedRoom();
    await mountGame();

    expect(within(wordsCard()).getByText("Les mots proposés par le groupe s'afficheront ici.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Tes mots" })).toBeNull();
  });

  it("sends a guess to the room with the member's token, never to the solo route", async () => {
    answer(200, guessResult([roomGuess("vent", camille, true)]));
    seedRoom();
    const input = await mountGame();

    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);

    await waitFor(() => expect(feedbackText()).toBe("« vent » trouvé !"));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://localhost:3000/api/rooms/ABC234/guess");
    expect(sentBody()).toEqual({ token: "token-m1", word: "vent" });
    expect(submitGuess).not.toHaveBeenCalled();
    expect(lyricsText()).toContain("vent");
    // The player's own colour is the accent.
    expect(feedbackDotColor()).toBe("var(--accent-solid)");
    expect(within(wordsCard()).getByText("vent").querySelector(".lyrix-player-dot")).toBeTruthy();
  });

  it("reveals a teammate's find live, in their colour, without shaking the player's input", async () => {
    seedRoom(entry(camille.id, [camille, leo]));
    const input = await mountGame();

    latestSocket().receive(roundMessage([roomGuess("vent", leo, true)], "vent"));

    expect(feedbackText()).toBe("Léo a trouvé « vent » !");
    expect(document.querySelector(".lyrix-feedback")?.className).toContain("is-found");
    expect(feedbackDotColor()).toBe("oklch(74% 0.13 150)");
    expect(dockRow(input).className).not.toMatch(/is-shake/);
    expect(lyricsText()).toContain("vent");
    // Highlighted like the player's own latest find.
    expect(document.querySelector(".token-word-found.is-last")?.textContent).toBe("vent");
  });

  it("tells a teammate's miss, still without shaking", async () => {
    seedRoom(entry(camille.id, [camille, leo]));
    const input = await mountGame();

    latestSocket().receive(roundMessage([roomGuess("guitare", leo, false)], "guitare"));

    expect(feedbackText()).toBe("Léo a proposé « guitare », sans succès.");
    expect(dockRow(input).className).not.toMatch(/is-shake/);
  });

  it("refuses a word anyone in the room already proposed, without asking the room", async () => {
    seedRoom(entry(camille.id, [camille, leo]));
    const input = await mountGame([roomGuess("guitare", leo, false)]);

    fireEvent.change(input, { target: { value: "Guitare" } });
    fireEvent.submit(input);

    expect(feedbackText()).toBe("« Guitare » a déjà été proposé.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says so when the room had it already, from a guess that crossed the player's", async () => {
    const leos = roomGuess("guitare", leo, false);
    answer(200, guessResult([leos], true));
    seedRoom(entry(camille.id, [camille, leo]));
    const input = await mountGame();

    fireEvent.change(input, { target: { value: "guitare" } });
    fireEvent.submit(input);

    await waitFor(() => expect(feedbackText()).toBe("« guitare » a déjà été proposé."));
    expect(within(wordsCard()).getAllByText("guitare")).toHaveLength(1);
  });

  it("counts the room's progress, not the player's own", async () => {
    seedRoom(entry(camille.id, [camille, leo]));
    await mountGame([roomGuess("guitare", camille, false), roomGuess("vent", leo, true)]);

    const progress = screen.getByRole("region", { name: "Progression" });
    expect(within(progress).getByText("mot trouvé").previousElementSibling?.textContent).toBe("1");
    expect(within(progress).getByText("essais").previousElementSibling?.textContent).toBe("2");
  });

  it("is won by the group, for every member at once", async () => {
    seedRoom(entry(camille.id, [camille, leo]));
    await mountGame();

    const title = ["le", "refuge", "de", "novembre"].map((word, index) => roomGuess(word, index % 2 ? leo : camille, true));
    latestSocket().receive(roundMessage(title.reverse(), "le"));

    expect(screen.getByText("Bravo, le groupe l'a trouvée !")).toBeTruthy();
  });

  it("celebrates the member whose guess completes the title, the moment its answer lands (#42)", async () => {
    const found = ["le", "refuge", "de"].map((word) => roomGuess(word, leo, true));
    answer(200, { ...guessResult([roomGuess("novembre", camille, true), ...found]), winningKey: "novembre" });
    seedRoom(entry(camille.id, [camille, leo]));
    const input = await mountGame(found);

    fireEvent.change(input, { target: { value: "novembre" } });
    fireEvent.submit(input);

    await waitFor(() => expect(screen.getByText("Bravo, le groupe l'a trouvée !")).toBeTruthy());
    expect(confetti()).toBeTruthy();
  });

  it("never goes back to an older view when a guess's answer arrives after a newer broadcast", async () => {
    let resolveAnswer: (response: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (resolveAnswer = resolve)));
    seedRoom(entry(camille.id, [camille, leo]));
    const input = await mountGame();
    const mine = roomGuess("vent", camille, true);
    const leos = roomGuess("jardin", leo, true);

    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);
    latestSocket().receive(roundMessage([mine], "vent"));
    latestSocket().receive(roundMessage([leos, mine], "jardin"));
    await act(async () => resolveAnswer(new Response(JSON.stringify(guessResult([mine])), { status: 200 })));

    await waitFor(() => expect(feedbackText()).toBe("« vent » trouvé !"));
    expect(lyricsText()).toContain("jardin");
    expect(within(wordsCard()).getByText("jardin")).toBeTruthy();
  });

  it("gives the solo round back, untouched, once the player leaves", async () => {
    answer(204);
    seedRoom();
    await mountGame([roomGuess("vent", leo, true)]);
    expect(lyricsText()).toContain("vent");

    fireEvent.click(within(roomCard() as HTMLElement).getByRole("button", { name: "Quitter le salon" }));

    expect(screen.getByPlaceholderText("Propose un mot…")).toBeTruthy();
    expect(lyricsText()).not.toContain("vent");
    expect(screen.getByRole("region", { name: "Tes mots" })).toBeTruthy();
  });

  it("re-renders no lyrics token while the player types", async () => {
    seedRoom();
    const input = await mountGame([roomGuess("vent", leo, true)]);

    fireEvent.change(input, { target: { value: "jar" } });
    fireEvent.change(input, { target: { value: "jardin" } });

    expect(wordTokenRenders.count).toBe(0);
  });
});

describe("when the group finds the song without the player (#30)", () => {
  /** The title found by the room, Léo completing it with « novembre ». */
  const titleFound = [
    roomGuess("novembre", leo, true),
    roomGuess("de", camille, true),
    roomGuess("refuge", leo, true),
    roomGuess("le", camille, true),
  ];
  /** What the room signs for Camille: everything but « novembre ». */
  const aloneRound = round("alone-state", ["le", "refuge", "de"]);

  function aloneCalls() {
    return fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/alone"));
  }

  it("keeps the answer hidden and lets the player look on alone, from the group's progress", async () => {
    answer(200, aloneRound);
    seedRoom(entry(camille.id, [camille, leo]));
    await mountGame(titleFound.slice(1));

    latestSocket().receive(roundMessage(titleFound, "novembre", "novembre"));

    expect(feedbackText()).toBe("Léo a trouvé la chanson !");
    const banner = screen.getByRole("region", { name: "Le groupe a trouvé" });
    expect(banner.textContent).toContain("Léo a trouvé la chanson pour le groupe");
    expect(screen.queryByText(/Bravo/)).toBeNull();
    // Léo's win, not hers: nothing to celebrate yet.
    expect(confetti()).toBeNull();
    expect(lyricsText()).not.toContain("novembre");
    expect(screen.getByPlaceholderText("Propose un mot…")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Tes mots" })).toBeTruthy();

    await waitFor(() => expect(lyricsText()).toContain("refuge"));
    expect(aloneCalls()).toHaveLength(1);
    expect(JSON.parse(String(aloneCalls()[0]?.[1]?.body))).toEqual({ token: "token-m1", state: "state-0" });
    expect(lyricsText()).not.toContain("novembre");
  });

  it("does not celebrate a guess of the player's that crossed the teammate's winning one (#42)", async () => {
    answer(200, { ...guessResult([roomGuess("guitare", camille, false), ...titleFound]), winningKey: "novembre" });
    answer(200, aloneRound);
    seedRoom(entry(camille.id, [camille, leo]));
    const input = await mountGame(titleFound.slice(1));

    fireEvent.change(input, { target: { value: "guitare" } });
    fireEvent.submit(input);

    await waitFor(() => expect(screen.getByRole("region", { name: "Le groupe a trouvé" })).toBeTruthy());
    expect(confetti()).toBeNull();
  });

  it("sends the player's guesses to their own round while they look alone", async () => {
    answer(200, aloneRound);
    submitGuess.mockResolvedValue({ ...round("won", ["le", "refuge", "de", "novembre"]), found: true, key: "novembre", score: 100, near: [] });
    seedRoom(entry(camille.id, [camille, leo]));
    await mountGame(titleFound.slice(1));
    latestSocket().receive(roundMessage(titleFound, "novembre", "novembre"));
    await waitFor(() => expect(aloneCalls()).toHaveLength(1));
    await waitFor(() => expect(lyricsText()).toContain("refuge"));
    const input = screen.getByPlaceholderText("Propose un mot…");

    fireEvent.change(input, { target: { value: "novembre" } });
    fireEvent.submit(input);

    await waitFor(() => expect(screen.getByText("Bravo, tu l'as trouvée !")).toBeTruthy());
    // Found on her own: a win of her own (#42).
    expect(confetti()).toBeTruthy();
    expect(submitGuess).toHaveBeenCalledWith("alone-state", "novembre");
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/guess"))).toBe(false);
    expect(screen.queryByRole("region", { name: "Le groupe a trouvé" })).toBeNull();
  });

  it("shows the group's answer on request, and remembers it across a reload", async () => {
    answer(200, aloneRound);
    seedRoom(entry(camille.id, [camille, leo]));
    await mountGame(titleFound.slice(1));
    latestSocket().receive(roundMessage(titleFound, "novembre", "novembre"));
    await waitFor(() => expect(aloneCalls()).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "Afficher la réponse" }));

    expect(screen.getByText("Bravo, le groupe l'a trouvée !")).toBeTruthy();
    expect(lyricsText()).toContain("novembre");
    expect(screen.queryByRole("region", { name: "Le groupe a trouvé" })).toBeNull();
    // An answer shown is not a win (#42).
    expect(confetti()).toBeNull();

    cleanup();
    FakeWebSocket.instances.length = 0;
    render(<GameScreen />);
    latestSocket().receive(roundMessage(titleFound, undefined, "novembre"));
    await waitFor(() => expect(screen.getByText("Bravo, le groupe l'a trouvée !")).toBeTruthy());
    expect(aloneCalls()).toHaveLength(1);
    expect(confetti()).toBeNull();
  });

  it("gives the player who completed the title the victory straight away", async () => {
    seedRoom(entry(leo.id, [camille, leo]));
    await mountGame(titleFound);

    expect(screen.getByText("Bravo, le groupe l'a trouvée !")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Le groupe a trouvé" })).toBeNull();
    expect(aloneCalls()).toHaveLength(0);
    // Won before this connection: shown, not celebrated again (#42).
    expect(confetti()).toBeNull();
  });

  it("offers the same choice to a player arriving after the group won", async () => {
    answer(200, aloneRound);
    seedRoom(entry(camille.id, [camille, leo]));
    render(<GameScreen />);

    latestSocket().receive(roundMessage(titleFound, undefined, "novembre"));

    await waitFor(() => expect(screen.getByRole("button", { name: "Afficher la réponse" })).toBeTruthy());
    expect(lyricsText()).not.toContain("novembre");
  });

  it("stays quiet about the room's later finds while the player looks alone", async () => {
    answer(200, aloneRound);
    seedRoom(entry(camille.id, [camille, leo]));
    await mountGame(titleFound.slice(1));
    latestSocket().receive(roundMessage(titleFound, "novembre", "novembre"));
    await waitFor(() => expect(aloneCalls()).toHaveLength(1));

    latestSocket().receive(roundMessage([roomGuess("jardin", leo, true), ...titleFound], "jardin", "novembre"));

    expect(feedbackText()).toBe("Léo a trouvé la chanson !");
    expect(lyricsText()).not.toContain("jardin");
  });
});
