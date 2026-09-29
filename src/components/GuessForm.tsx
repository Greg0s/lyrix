import type { FormEvent, MouseEvent, RefObject } from "react";

export interface GuessFeedback {
  text: string;
  /** "info": something from outside the round, e.g. a player joining the room. */
  tone: "found" | "missed" | "error" | "info";
  /** Bumped on every new guess: a new message is a new element, so its entrance replays, and the shake alternates. */
  seq: number;
  /** A guess of the player's own that missed: the input row shakes. */
  shake: boolean;
}

interface GuessFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** A guess is in flight: "Valider" is inert until it lands. */
  submitting: boolean;
  feedback: GuessFeedback | null;
  /** Owned by GameScreen, which puts focus back here when a dialog closes. */
  inputRef: RefObject<HTMLInputElement | null>;
}

/** The dark dock pinned to the bottom of the game column: the guess input, "Valider", and the latest feedback. */
export function GuessForm({ value, onChange, onSubmit, submitting, feedback, inputRef }: GuessFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submitting) onSubmit();
    // Activating "Valider" from the keyboard moves focus to the button;
    // bring it back so the player can keep typing without reclicking.
    inputRef.current?.focus();
  };

  // A tap or click on "Valider" must never take focus from the input: on a
  // phone, the input losing focus closes the on-screen keyboard, and handing
  // focus back in handleSubmit reopens it — a flicker on every guess.
  const keepInputFocus = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();

  // Two identical shake animations, alternated, so two misses in a row both shake (see global.css).
  const parity = feedback && feedback.seq % 2 ? "a" : "b";

  return (
    <div className="lyrix-dock">
      <form className="lyrix-form" onSubmit={handleSubmit}>
        <div className={`lyrix-form-row${feedback?.shake ? ` is-shake-${parity}` : ""}`}>
          <input
            ref={inputRef}
            type="text"
            className="lyrix-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Propose un mot…"
            autoComplete="off"
            spellCheck={false}
          />
          {/* Never `disabled`, on the input or the button: disabling the
              focused input blurs it (closing a phone's keyboard), and a
              disabled button can't cancel the mousedown that moves focus. */}
          <button
            type="submit"
            className="lyrix-submit"
            aria-disabled={submitting}
            onMouseDown={keepInputFocus}
          >
            Valider
          </button>
        </div>
        {feedback ? (
          <p
            key={`${feedback.tone}-${feedback.seq}`}
            className={`lyrix-feedback is-${feedback.tone}`}
            role={feedback.tone === "error" ? "alert" : "status"}
          >
            {feedback.text}
          </p>
        ) : null}
      </form>
    </div>
  );
}
