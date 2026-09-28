import { useEffect, useRef, type FormEvent, type RefObject } from "react";

export interface GuessFeedback {
  text: string;
  tone: "found" | "missed" | "error";
  /** Bumped on every new guess: a new message is a new element, so its entrance replays, and the shake alternates. */
  seq: number;
  /** A guess of the player's own that missed: the input row shakes. */
  shake: boolean;
}

interface GuessFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  feedback: GuessFeedback | null;
  /** Owned by GameScreen, which puts focus back here when a dialog closes. */
  inputRef: RefObject<HTMLInputElement | null>;
}

/** The dark dock pinned to the bottom of the game column: the guess input, "Valider", and the latest feedback. */
export function GuessForm({ value, onChange, onSubmit, disabled, feedback, inputRef }: GuessFormProps) {
  const wasDisabled = useRef(disabled);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
    // Clicking "Valider" (as opposed to pressing Enter) moves focus to the
    // button; bring it back so the player can keep typing without reclicking.
    inputRef.current?.focus();
  };

  // The input is briefly disabled while a guess is in flight, which forces a
  // native blur; once it's enabled again, restore focus for the same reason.
  useEffect(() => {
    if (wasDisabled.current && !disabled) {
      inputRef.current?.focus();
    }
    wasDisabled.current = disabled;
  }, [disabled, inputRef]);

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
            disabled={disabled}
          />
          <button type="submit" className="lyrix-submit" disabled={disabled}>
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
