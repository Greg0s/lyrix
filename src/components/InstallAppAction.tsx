import { useState } from "react";
import { EVENTS, SIGNALS, signal, track } from "../analytics";
import { promptInstall, useInstallMode } from "../install";
import { IosInstallSteps } from "./InstallIcons";

/**
 * The rules' page's "Installer l'appli", for anyone who comes looking, engaged
 * or not, said no before or not: wherever the browser can install Lyrix and it
 * isn't the installed app already. Safari on iOS gets its two taps instead.
 */
export function InstallAppAction() {
  const mode = useInstallMode();
  const [steps, setSteps] = useState(false);
  if (mode !== "prompt" && mode !== "ios") return null;

  const onClick = async () => {
    if (mode === "ios") {
      setSteps((open) => !open);
      return;
    }
    const outcome = await promptInstall();
    if (outcome === "accepted") signal(SIGNALS.installPromptAccepted);
    else if (outcome === "dismissed") signal(SIGNALS.installPromptDismissed);
  };

  return (
    <>
      <button
        type="button"
        className="lyrix-button is-outline"
        onClick={() => void onClick()}
        aria-expanded={mode === "ios" ? steps : undefined}
        {...track(EVENTS.installApp, { from: "rules" })}
      >
        Installer l'appli
      </button>
      {mode === "ios" && steps ? <IosInstallSteps className="is-light" /> : null}
    </>
  );
}
