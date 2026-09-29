import { useId, useState, type FormEvent } from "react";
import type { RoomFailure } from "../api/rooms";
import { isRoomCode, normalizeRoomCodeInput, PSEUDO_MAX_LENGTH, ROOM_CODE_LENGTH } from "../game/room";
import type { RoomOutcome, RoomView } from "../hooks/useRoom";
import { CopyCodeButton } from "./CopyCodeButton";
import { Modal } from "./Modal";
import { RoomMembers } from "./RoomMembers";

interface MultiplayerModalProps {
  /** The room the player is in, if any: the dialog then shows it instead of the create/join forms. */
  room: RoomView | null;
  onCreate: (pseudo: string) => Promise<RoomOutcome>;
  onJoin: (code: string, pseudo: string) => Promise<RoomOutcome>;
  onClosed: () => void;
}

type Tab = "create" | "join";

const CODE_LENGTH_ERROR = `Le code doit contenir ${ROOM_CODE_LENGTH} caractères.`;
const UNKNOWN_ROOM_ERROR = "Aucun salon ne porte ce code, ou il a expiré.";

function failureText(tab: Tab, failure: RoomFailure): string {
  if (failure === "rate-limited") return "Trop de tentatives : réessaie dans une minute.";
  if (tab === "join" && failure === "not-found") return UNKNOWN_ROOM_ERROR;
  return tab === "create" ? "Le salon n’a pas pu être créé, réessaie." : "Impossible de rejoindre le salon, réessaie.";
}

interface FormError {
  text: string;
  /** The code field is what's wrong: it turns red and shakes. */
  onCode: boolean;
  /** Bumped on every failed attempt, so the shake replays (see global.css). */
  seq: number;
}

/**
 * "Jouer à plusieurs" (issue #29). Out of a room: the "Créer un salon" /
 * "Rejoindre" tabs. In one: its code to share and who is there. Creating a
 * room keeps the dialog open on the new room; joining one closes it, and the
 * guess dock says whose room it was (see useRoom).
 */
export function MultiplayerModal({ room, onCreate, onJoin, onClosed }: MultiplayerModalProps) {
  // After a join the dialog closes; the form stays up while it animates out,
  // rather than flashing the in-room view on the way.
  const [joined, setJoined] = useState(false);
  const inRoom = room !== null && !joined;

  return (
    <Modal title="Jouer à plusieurs" onClosed={onClosed} size="wide">
      {(requestClose) =>
        inRoom ? (
          <InRoom room={room} onDone={requestClose} />
        ) : (
          <RoomForms
            onCreate={onCreate}
            onJoin={onJoin}
            onJoined={() => {
              setJoined(true);
              requestClose();
            }}
          />
        )
      }
    </Modal>
  );
}

interface RoomFormsProps {
  onCreate: (pseudo: string) => Promise<RoomOutcome>;
  onJoin: (code: string, pseudo: string) => Promise<RoomOutcome>;
  onJoined: () => void;
}

function RoomForms({ onCreate, onJoin, onJoined }: RoomFormsProps) {
  const [tab, setTab] = useState<Tab>("create");
  const [pseudo, setPseudo] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const errorId = useId();

  const fail = (text: string, onCode: boolean) =>
    setError((previous) => ({ text, onCode, seq: (previous?.seq ?? 0) + 1 }));

  const switchTab = (next: Tab) => {
    setTab(next);
    setError(null);
  };

  // One form for both tabs, so Enter in "Ton pseudo" does what the open tab offers.
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    if (tab === "join" && code.length !== ROOM_CODE_LENGTH) return fail(CODE_LENGTH_ERROR, true);
    // A code that can't exist can't be joined: no need to ask the server.
    if (tab === "join" && !isRoomCode(code)) return fail(UNKNOWN_ROOM_ERROR, true);

    setPending(true);
    setError(null);
    const outcome = tab === "create" ? await onCreate(pseudo) : await onJoin(code, pseudo);
    setPending(false);
    if (!outcome.ok) return fail(failureText(tab, outcome.failure), tab === "join" && outcome.failure === "not-found");
    // On a create, the parent now has a room and renders it in place of this form.
    if (tab === "join") onJoined();
  };

  const shake = error?.onCode ? ` is-invalid is-shake-${error.seq % 2 ? "a" : "b"}` : "";

  return (
    <div className="lyrix-mp">
      <div className={`lyrix-tabs${tab === "join" ? " is-second" : ""}`} role="tablist">
        <span className="lyrix-tabs-indicator" aria-hidden="true" />
        <button
          type="button"
          role="tab"
          aria-selected={tab === "create"}
          className={tab === "create" ? "is-active" : undefined}
          onClick={() => switchTab("create")}
        >
          Créer un salon
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "join"}
          className={tab === "join" ? "is-active" : undefined}
          onClick={() => switchTab("join")}
        >
          Rejoindre
        </button>
      </div>

      <form className="lyrix-mp-form" onSubmit={(event) => void submit(event)} noValidate>
        <label className="lyrix-field">
          <span>Ton pseudo</span>
          <input
            type="text"
            className="lyrix-field-input"
            value={pseudo}
            onChange={(event) => setPseudo(event.target.value)}
            placeholder="Ex. Camille"
            maxLength={PSEUDO_MAX_LENGTH}
            autoComplete="nickname"
            spellCheck={false}
          />
        </label>

        {tab === "create" ? (
          <div className="lyrix-mp-pane is-create" key="create">
            <p className="lyrix-mp-text">
              Tu deviens l'hôte. Un code de salon est généré&nbsp;: partage-le aux autres joueurs pour qu'ils te
              rejoignent. Le salon n'a pas de limite de joueurs.
            </p>
            {error ? (
              <p className="lyrix-mp-error" role="alert">
                {error.text}
              </p>
            ) : null}
            <button type="submit" className="lyrix-button is-block" aria-disabled={pending}>
              {pending ? "Création du salon…" : "Créer le salon"}
            </button>
          </div>
        ) : (
          <div className="lyrix-mp-pane is-join" key="join">
            <label className="lyrix-field">
              <span>Code du salon</span>
              <input
                type="text"
                className={`lyrix-field-input is-code${shake}`}
                value={code}
                onChange={(event) => {
                  setCode(normalizeRoomCodeInput(event.target.value));
                  setError(null);
                }}
                placeholder={`${ROOM_CODE_LENGTH} caractères`}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={error?.onCode ?? false}
                aria-describedby={error ? errorId : undefined}
              />
            </label>
            {error ? (
              <p className="lyrix-mp-error" id={errorId} role="alert">
                {error.text}
              </p>
            ) : null}
            <button type="submit" className="lyrix-button is-accent is-block" aria-disabled={pending}>
              {pending ? "Connexion au salon…" : "Rejoindre le salon"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

interface InRoomProps {
  room: RoomView;
  onDone: () => void;
}

function InRoom({ room, onDone }: InRoomProps) {
  return (
    <div className="lyrix-mp">
      <div className="lyrix-room-code-block">
        <p className="lyrix-eyebrow">Code du salon</p>
        <p className="lyrix-room-code is-large">{room.code}</p>
        <CopyCodeButton code={room.code} tone="light" />
      </div>
      <p className="lyrix-mp-text">
        Partage ce code&nbsp;: chaque joueur qui le saisit dans «&nbsp;Rejoindre&nbsp;» arrive dans ce salon, jusqu'à
        minuit (heure UTC), quand la chanson du jour change.
      </p>
      <p className="lyrix-soon" role="note">
        <span className="lyrix-soon-badge">Bientôt</span>
        Chaque mot trouvé par l'un se dévoilera pour tous.
      </p>
      <section className="lyrix-mp-members" aria-label="Joueurs">
        <h3 className="lyrix-mp-members-title">Joueurs · {room.members.length}</h3>
        <RoomMembers room={room} variant="list" waiting />
      </section>
      <button type="button" className="lyrix-button is-accent is-block" onClick={onDone}>
        Chercher ensemble
      </button>
    </div>
  );
}
