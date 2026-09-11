import type { FormEvent } from "react";

interface GuessFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

export function GuessForm({ value, onChange, onSubmit, disabled }: GuessFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="lyrix-form" onSubmit={handleSubmit}>
      <input
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
