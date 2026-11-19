import { memo, useEffect, useState } from "react";
import { EVENTS, track } from "../analytics";
import { applyTheme, forgetTheme, saveTheme, storedTheme, systemTheme, watchSystemTheme, type Theme } from "../theme";
import { MoonIcon, SunIcon } from "./ThemeToggle";

type Choice = Theme | "system";

const CHOICES: readonly { value: Choice; label: string }[] = [
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
  { value: "system", label: "Auto" },
];

/**
 * The theme's own card, below 880px only (game.css), where the header has no
 * room for its button: light, dark, or "Auto", which follows the phone's
 * setting again (the header's button can only pick one of the two). Its
 * choice is its own local state, as the header's button's is.
 */
export const ThemePicker = memo(function ThemePicker() {
  const [choice, setChoice] = useState<Choice>(() => storedTheme() ?? "system");

  // Following the system, the page follows it live (watchSystemTheme only calls back then).
  useEffect(() => watchSystemTheme(applyTheme), []);

  const pick = (next: Choice) => {
    if (next === "system") {
      forgetTheme();
      applyTheme(systemTheme());
    } else {
      saveTheme(next);
      applyTheme(next);
    }
    setChoice(next);
  };

  return (
    <fieldset className="lyrix-card lyrix-theme-picker">
      <legend className="lyrix-card-title">Apparence</legend>
      <div className="lyrix-theme-choices">
        {CHOICES.map(({ value, label }) => (
          <label key={value} className={choice === value ? "lyrix-theme-choice is-active" : "lyrix-theme-choice"}>
            <input
              type="radio"
              name="lyrix-theme"
              value={value}
              checked={choice === value}
              onChange={() => pick(value)}
              {...track(EVENTS.toggleTheme, { to: value, from: "picker" })}
            />
            {value === "light" ? <SunIcon /> : value === "dark" ? <MoonIcon /> : null}
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
});
