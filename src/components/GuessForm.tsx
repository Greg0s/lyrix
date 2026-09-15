import { useEffect, useRef, type FormEvent } from "react";

interface GuessFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

export function GuessForm({ value, onChange, onSubmit, disabled }: GuessFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
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
  }, [disabled]);

  return (
    <form className="lyrix-form" onSubmit={handleSubmit}>
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
    </form>
  );
}
