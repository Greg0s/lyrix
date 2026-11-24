import { memo, useEffect, useId, useState } from "react";
import { EVENTS, SIGNALS, signal, track } from "../analytics";
import { promptInstall, useInstallMode } from "../install";
import { dismissInstallOffer, isInstallOfferDue, markInstallDone, songsFound } from "../installStorage";
import { loadArchive } from "../roundStorage";
import { IosInstallSteps } from "./InstallIcons";

interface InstallOfferProps {
  /** The day of the round just won: counted whether its save has landed yet or not. */
  wonDay: string;
}

/**
 * The offer to install Lyrix, a row of the victory panel (decided with the
 * developer: proposition A), the moment a player is pleased with the game.
 * Only to a player who found songs on two days or more, in a browser that can
 * install it and isn't the installed app already, and not if they said no lately
 * (installStorage.ts). Where the browser has its own dialog, "Installer Lyrix"
 * opens it; Safari on iOS has none, so the row shows its two taps.
 *
 * Whether it is due is read once, as the panel mounts: a player who
 * answers sees it go, and nothing else on the page re-renders for it.
 */
export const InstallOffer = memo(function InstallOffer({ wonDay }: InstallOfferProps) {
  const mode = useInstallMode();
  const titleId = useId();
  const [found] = useState(() => songsFound(loadArchive(), wonDay));
  const [due, setDue] = useState(() => isInstallOfferDue(found));
  const shown = due && (mode === "prompt" || mode === "ios");

  useEffect(() => {
    if (shown) signal(SIGNALS.installOfferShown, { platform: mode ?? "" });
  }, [shown, mode]);

  if (!shown) return null;

  const later = () => {
    dismissInstallOffer();
    setDue(false);
  };

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      signal(SIGNALS.installPromptAccepted);
      setDue(false);
    } else if (outcome === "dismissed") {
      // Said no in the browser's own dialog: the same as "Plus tard".
      signal(SIGNALS.installPromptDismissed);
      later();
    }
  };

  const done = () => {
    markInstallDone();
    setDue(false);
  };

  return (
    <section className="lyrix-install" aria-labelledby={titleId}>
      <div className="lyrix-install-head">
        <span className="lyrix-install-tile" aria-hidden="true">
          <span className="lyrix-logo-mark">
            <span className="lyrix-logo-row">
              <span className="is-word is-short" />
              <span className="is-bar is-fill" />
            </span>
            <span className="lyrix-logo-row">
              <span className="is-bar is-medium" />
              <span className="is-word is-fill" />
            </span>
            <span className="lyrix-logo-row">
              <span className="is-word is-long" />
            </span>
          </span>
        </span>
        <div className="lyrix-install-text">
          <h2 className="lyrix-install-title" id={titleId}>
            Lyrix sur ton écran d'accueil
          </h2>
          <p>
            Tu as trouvé {found} chansons&nbsp;: retrouve celle de demain en un geste, comme une appli.
          </p>
        </div>
      </div>
      {mode === "ios" ? <IosInstallSteps /> : null}
      <div className="lyrix-victory-actions lyrix-install-actions">
        <button
          type="button"
          className="lyrix-button is-ghost"
          onClick={later}
          {...track(EVENTS.dismissInstall, { platform: mode })}
        >
          Plus tard
        </button>
        {mode === "ios" ? (
          <button
            type="button"
            className="lyrix-button is-accent"
            onClick={done}
            {...track(EVENTS.installedAlready, { from: "victory" })}
          >
            C'est fait
          </button>
        ) : (
          <button
            type="button"
            className="lyrix-button is-accent"
            onClick={() => void install()}
            {...track(EVENTS.installApp, { from: "victory" })}
          >
            Installer Lyrix
          </button>
        )}
      </div>
    </section>
  );
});
