import { memo, useState } from "react";
import { GroupIcon } from "./GroupIcon";

/** Set once the player closes the card: the header's button still opens the multiplayer dialog. */
export const PROMO_DISMISSED_KEY = "lyrix:promo-dismissed";

function isDismissed(storage: Storage | undefined = globalThis.localStorage): boolean {
  try {
    return storage?.getItem(PROMO_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveDismissed(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(PROMO_DISMISSED_KEY, "1");
  } catch {
    // Persistence is a nice-to-have (private browsing, quota): never fatal.
  }
}

interface MultiplayerPromoProps {
  onOpen: () => void;
}

/**
 * The dashed "Chercher à plusieurs" card at the bottom of the side column; opens the multiplayer dialog.
 * Hidden while in a room, and for good once the player closes it (its own state: closing it re-renders nothing else).
 */
export const MultiplayerPromo = memo(function MultiplayerPromo({ onOpen }: MultiplayerPromoProps) {
  const [dismissed, setDismissed] = useState(isDismissed);
  if (dismissed) return null;

  const dismiss = () => {
    saveDismissed();
    setDismissed(true);
  };

  return (
    <div className="lyrix-promo-wrap">
      <button type="button" className="lyrix-promo" onClick={onOpen}>
        <span className="lyrix-promo-icon">
          <GroupIcon />
        </span>
        <span className="lyrix-promo-body">
          <span className="lyrix-promo-title">Chercher à plusieurs</span>
          <span className="lyrix-promo-text">
            Crée un salon et partage le code avec tes amis&nbsp;: chaque mot trouvé par l'un se dévoile pour tous.
          </span>
        </span>
      </button>
      <button type="button" className="lyrix-promo-close" onClick={dismiss} aria-label="Masquer cette suggestion">
        ✕
      </button>
    </div>
  );
});
