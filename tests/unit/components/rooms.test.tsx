// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ROOM_CLOSE_EXPIRED,
  ROOM_CLOSE_LEFT,
  ROOM_CLOSE_UNKNOWN,
  ROOM_PING,
  type RoomEntry,
  type RoomMember,
  type RoomMessage,
  type RoomSnapshot,
} from "../../../src/game/room";
import type { GuessResult, RoundView } from "../../../src/game/types";

/**
 * Rooms (issue #29) as the player meets them: the dialog, the Salon card, the
 * header, and the dock's feedback line, over a fake WebSocket the tests play
 * the room's side of. Like gameScreen.test.tsx, it counts lyrics tokens: a
 * player arriving in the room has nothing to do with the lyrics.
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
    act(() => {
      this.readyState = SOCKET_OPEN;
      this.dispatchEvent(new Event("open"));
    });
  }
  receive(message: RoomMessage): void {
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

function tokens(text: string) {
  return text.split(" ").flatMap((word, index) => {
    const token = { text: "_".repeat(word.length), isWord: true, revealed: false };
    return index === 0 ? [token] : [{ text: " ", isWord: false, revealed: true }, token];
  });
}

function round(state = "state-0"): RoundView {
  return {
    songId: "fixture",
    state,
    title: { tokens: tokens("Le refuge de novembre") },
    sections: [{ label: "Couplet 1", lines: [{ tokens: tokens("Le vent referme la porte du jardin") }] }],
    victory: false,
  };
}

const fetchMock = vi.fn<typeof fetch>();

function answer(status: number, body: unknown = null): void {
  fetchMock.mockResolvedValueOnce(new Response(body === null ? null : JSON.stringify(body), { status }));
}

function sentBody(call = 0): Record<string, unknown> {
  return JSON.parse(String(fetchMock.mock.calls[call]?.[1]?.body)) as Record<string, unknown>;
}

async function mountGame(): Promise<HTMLInputElement> {
  render(<GameScreen />);
  await waitFor(() => expect(screen.getByPlaceholderText("Propose un mot…")).toBeTruthy());
  wordTokenRenders.count = 0;
  return screen.getByPlaceholderText("Propose un mot…") as HTMLInputElement;
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
    submitGuess.mockResolvedValue({ ...round("state-1"), found: false, key: "vent", score: null, near: [] } as GuessResult);
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
    expect(wordTokenRenders.count).toBe(0);
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
    expect(wordTokenRenders.count).toBe(0);
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
