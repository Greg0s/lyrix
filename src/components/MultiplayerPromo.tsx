import { memo, useState } from "react";
import { dismissPromo, isPromoDismissed } from "../promoStorage";
import { GroupIcon } from "./GroupIcon";

interface MultiplayerPromoProps {
  onOpen: () => void;
}

/**
 * The dashed "Chercher à plusieurs" card at the bottom of the side column; opens the multiplayer dialog.
 * Hidden while in a room, and once the player closes it: for the day, or for the month after five times (promoStorage).
 * That is its own state: closing it re-renders nothing else.
 */
export const MultiplayerPromo = memo(function MultiplayerPromo({ onOpen }: MultiplayerPromoProps) {
  const [dismissed, setDismissed] = useState(() => isPromoDismissed());
  if (dismissed) return null;

  const dismiss = () => {
    dismissPromo();
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
