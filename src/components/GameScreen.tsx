import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { daysToFind, groupEntry, nextDayToFind, type ArchiveEntry } from "../game/archive";
import { revealedPercent } from "../game/progress";
import { parseInvitePath } from "../game/room";
import { closestGuessBySlot, placeNearGuesses } from "../game/slots";
import { useGame, type Feedback } from "../hooks/useGame";
import { useRoom } from "../hooks/useRoom";
import { useRoute } from "../hooks/useRoute";
import { isAnswerRevealed } from "../roomStorage";
import { loadArchive } from "../roundStorage";
import { utcDay } from "../game/daily";
import { ARCHIVES, TODAY } from "../routes";
import { AppHeader } from "./AppHeader";
import { ArchivesScreen } from "./ArchivesScreen";
import { DayBar } from "./DayBar";
import { playerColor } from "./playerColor";
import { GroupFoundBanner } from "./GroupFoundBanner";
import { GuessForm, type GuessFeedback } from "./GuessForm";
import { HowToPlay } from "./HowToPlay";
import { LyricsBody } from "./LyricsBody";
import { MultiplayerModal } from "./MultiplayerModal";
import { MultiplayerPromo } from "./MultiplayerPromo";
import { ProgressCard } from "./ProgressCard";
import { RoomCard } from "./RoomCard";
import { TitleGuess } from "./TitleGuess";
import { TriedWords } from "./TriedWords";

function feedbackMessage({ word, found, duplicate, nearCount }: Feedback): string {
  if (duplicate) return `« ${word} » a déjà été proposé.`;
  if (found) return `« ${word} » trouvé !`;
  if (nearCount === 0) return `« ${word} » n’y est pas.`;
  // A close word can land far down the lyrics, out of sight: say so, or the hint goes unnoticed.
  const where = nearCount === 1 ? "d’un mot caché" : `de ${nearCount} mots cachés`;
  return `« ${word} » n’y est pas, mais il est proche ${where}.`;
}

type Dialog = "help" | "multiplayer" | null;

/** A phone or tablet: its primary pointer is a finger, and focusing a text input opens its keyboard. */
function isTouchScreen(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

export function GameScreen() {
  // `day`: the round played, null for today's song (see useRoute's gameDay).
  const { route, gameDay: day, navigate } = useRoute();
  const game = useGame(day);
  // Room events ("X a rejoint le salon.", a teammate's guess) go to the guess
  // dock's feedback line; the room's round replaces the solo one (#30).
  const room = useRoom(game.announce, game.receiveRoomRound, game.setRoomSession);

  // A room plays one day's song at a time, and everyone in it follows (#B).
  // When the room's day changes, the screen goes there; a player browsing the
  // archives when the room first says where it is stays where they are.
  const { roomDay } = game;
  const lastRoomDay = useRef<string | null>(null);
  useEffect(() => {
    const previous = lastRoomDay.current;
    lastRoomDay.current = roomDay;
    if (roomDay === null || previous === roomDay) return;
    if (route.name === "archives" ? previous === null : (day ?? utcDay()) === roomDay) return;
    navigate(roomDay === utcDay() ? TODAY : { name: "day", day: roomDay });
  }, [roomDay, route.name, day, navigate]);
  // And when the player goes to another day themselves (a cover, the day
  // bar, "Jouer", Back), the whole room goes with them.
  const { moveTo } = room;
  const inRoom = room.view !== null;
  const lastDay = useRef(day);
  useEffect(() => {
    const moved = lastDay.current !== day;
    lastDay.current = day;
    if (!moved || !inRoom || roomDay === null || route.name === "archives") return;
    const target = day ?? utcDay();
    if (target !== roomDay) moveTo(target);
  }, [day, inRoom, roomDay, route.name, moveTo]);
  const inputRef = useRef<HTMLInputElement>(null);
  // An invite link (/salon/<code>) opens the dialog on that room, unless the
  // player is in it already. It is only offered once: closing the dialog drops it.
  const [invite, setInvite] = useState(() => parseInvitePath(window.location.pathname));
  const [dialog, setDialog] = useState<Dialog>(() =>
    invite !== null && invite !== room.view?.code ? "multiplayer" : null
  );
  // The address goes back to the home page, so a reload doesn't offer the room
  // again, and what the player copies from the address bar is the game's URL.
  useEffect(() => {
    if (parseInvitePath(window.location.pathname) === null) return;
    window.history.replaceState(window.history.state, "", `/${window.location.search}${window.location.hash}`);
  }, []);
  // Checked for one round: another day, another song, whose lyrics start hidden again.
  const [revealedDay, setRevealedDay] = useState<string | null | undefined>(undefined);
  const revealAllLyrics = revealedDay !== undefined && revealedDay === day;
  const openArchives = useCallback(() => navigate(ARCHIVES), [navigate]);
  const playDay = useCallback((target: string) => navigate({ name: "day", day: target }), [navigate]);
  // What had focus when a dialog opened (its button), to hand it back on a touch screen.
  const openerRef = useRef<HTMLElement | null>(null);
  const openDialog = useCallback((which: Exclude<Dialog, null>) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDialog(which);
  }, []);
  const openHelp = useCallback(() => openDialog("help"), [openDialog]);
  const openMultiplayer = useCallback(() => openDialog("multiplayer"), [openDialog]);
  // Once a dialog is gone, the player is back to guessing: give them the input.
  // Not on a touch screen, where focusing the input pops the on-screen keyboard
  // up over the page the player just came back to: focus goes back to the
  // button that opened the dialog, and the player taps the input when ready.
  const closeDialog = useCallback(() => {
    setDialog(null);
    setInvite(null);
    const opener = openerRef.current;
    openerRef.current = null;
    if (!isTouchScreen()) inputRef.current?.focus();
    else if (opener?.isConnected) opener.focus();
  }, []);
  const toggleRevealAllLyrics = useCallback(
    () => setRevealedDay((revealed) => (revealed === day ? undefined : day)),
    [day]
  );
  const { submit } = game;
  const onSubmit = useCallback(() => void submit(), [submit]);

  // Derived above the early returns below, so the hooks run on every render.
  // Each walks the whole round or the whole guess list, and each is memoized
  // on what it reads rather than recomputed per render: that is what keeps a
  // keystroke from re-rendering the lyrics, which have nothing to do with the
  // word being typed.
  const { round, triedWords } = game;
  // Every hidden word shows the closest miss so far; a revealed word always shows itself.
  const slots = useMemo(
    () => (round ? placeNearGuesses(round, closestGuessBySlot(triedWords)) : null),
    [round, triedWords]
  );
  const percent = useMemo(() => (round ? revealedPercent(round) : 0), [round]);
  const foundCount = useMemo(() => triedWords.filter((word) => word.found).length, [triedWords]);
  // Where the victory panel points next: read from storage once the round is
  // won, never per keystroke. The round on screen counts for neither, so a
  // write of it still pending makes no difference.
  const won = round?.victory === true;
  const archivesAhead = useMemo(() => {
    if (!won) return { daysLeft: 0, nextDay: null };
    const archive = loadArchive();
    return { daysLeft: daysToFind(archive).length, nextDay: day === null ? null : nextDayToFind(archive, day) };
  }, [won, day]);

  // In a room, its days as this player may see them, for the archives screen.
  const { roomDays, roomRevealed } = game;
  const roomCode = room.view?.code ?? null;
  const member = room.view?.you ?? null;
  const groupDays = useMemo(() => {
    if (roomCode === null || member === null || roomDays.length === 0) return null;
    const days: Record<string, ArchiveEntry> = {};
    for (const summary of roomDays) {
      // The room's day: the answer may have just been shown, before storage is read again.
      const revealed = (summary.day === roomDay && roomRevealed) || isAnswerRevealed(roomCode, summary.day);
      days[summary.day] = groupEntry(summary, member, revealed);
    }
    return days;
  }, [roomDays, roomCode, member, roomDay, roomRevealed]);

  const header = (
    <AppHeader
      roomPlayers={room.view ? room.view.members.length : null}
      onOpenMultiplayer={openMultiplayer}
      archivesOpen={route.name === "archives"}
      onOpenArchives={openArchives}
      onOpenHelp={openHelp}
      onNavigate={navigate}
    />
  );
  const dialogs = (
    <>
      {dialog === "help" ? <HowToPlay onClosed={closeDialog} /> : null}
      {dialog === "multiplayer" ? (
        <MultiplayerModal
          room={room.view}
          invite={invite}
          onCreate={room.create}
          onJoin={room.join}
          onClosed={closeDialog}
        />
      ) : null}
    </>
  );
  const shell = (content: ReactNode) => (
    <div className="lyrix-app">
      {header}
      {content}
      {dialogs}
    </div>
  );

  if (route.name === "archives") return shell(<ArchivesScreen onNavigate={navigate} group={groupDays} />);

  if (game.error && !round) {
    return shell(
      <main className="lyrix-main is-message">
        <div className="lyrix-card lyrix-message">
          <p role="alert">Impossible de charger la partie.</p>
          <button type="button" className="lyrix-button" onClick={() => void game.loadRound()}>
            Réessayer
          </button>
        </div>
      </main>
    );
  }

  if (!round || !slots) {
    return shell(
      <main className="lyrix-main is-message">
        <div className="lyrix-card lyrix-message">
          <p>Chargement de la partie…</p>
        </div>
      </main>
    );
  }

  const { feedback, notice } = game;
  // In a room, the dock's line carries the colour of whoever proposed the word.
  const you = room.view?.you ?? null;
  const group = game.playingRoom && you !== null ? { you } : null;
  // A teammate's find is highlighted like the player's own, while it is the latest news.
  const lastFoundKey = notice ? (notice.foundKey ?? null) : feedback?.found ? feedback.key : null;
  let guessFeedback: GuessFeedback | null = null;
  // Whatever happened last: a notice is cleared by the next guess's outcome
  // (useGame), so while there is one, it is the newest thing to say. Only the
  // player's own misses shake the input: a teammate's is just news.
  if (notice) {
    guessFeedback = {
      text: notice.text,
      tone: notice.outcome ?? "info",
      seq: notice.seq,
      shake: false,
      color: notice.by ? playerColor(notice.by, you) : undefined,
    };
  } else if (game.error) {
    guessFeedback = {
      text: "Le mot n'a pas pu être envoyé, réessaie.",
      tone: "error",
      seq: feedback?.seq ?? 0,
      shake: false,
    };
  } else if (feedback) {
    guessFeedback = {
      text: feedbackMessage(feedback),
      tone: feedback.found ? "found" : "missed",
      seq: feedback.seq,
      shake: !feedback.found,
      color: group && feedback.by ? playerColor(feedback.by, you) : undefined,
    };
  }

  return shell(
    <main className={day !== null ? "lyrix-main has-day-bar" : "lyrix-main"}>
      {day !== null ? <DayBar day={day} onNavigate={navigate} /> : null}
      <div className="lyrix-game-col">
        {game.aloneAfter && !round.victory ? (
          <GroupFoundBanner winner={game.aloneAfter} you={you} onReveal={game.revealAnswer} />
        ) : null}
        <article className="lyrix-card lyrix-song">
          <TitleGuess
            titleTokens={slots.title}
            victory={round.victory}
            group={group !== null}
            artist={round.artist}
            lastFoundKey={lastFoundKey}
            revealAllLyrics={revealAllLyrics}
            onToggleRevealAllLyrics={toggleRevealAllLyrics}
            celebration={game.celebration}
            archiveDay={day}
            tries={triedWords.length}
            daysLeft={archivesAhead.daysLeft}
            nextDay={archivesAhead.nextDay}
            onOpenArchives={openArchives}
            onPlayDay={playDay}
          />
          <LyricsBody sections={slots.sections} revealAll={revealAllLyrics} lastFoundKey={lastFoundKey} />
        </article>

        <GuessForm
          value={game.inputValue}
          onChange={game.setInputValue}
          onSubmit={onSubmit}
          submitting={game.submitting}
          feedback={guessFeedback}
          inputRef={inputRef}
          placeholder={group ? "Propose un mot au groupe…" : "Propose un mot…"}
        />
      </div>

      <aside className="lyrix-aside">
        {/* The room's card goes with the room's day; another day is played alone meanwhile. */}
        {room.view && (roomDay === null ? day === null : (day ?? utcDay()) === roomDay) ? (
          <RoomCard room={room.view} onLeave={room.leave} />
        ) : null}
        <ProgressCard percent={percent} foundCount={foundCount} triedCount={triedWords.length} />
        <TriedWords triedWords={triedWords} group={group} />
        {room.view || day !== null ? null : <MultiplayerPromo onOpen={openMultiplayer} />}
      </aside>
    </main>
  );
}
