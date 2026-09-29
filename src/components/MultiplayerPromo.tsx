import { memo } from "react";
import { GroupIcon } from "./GroupIcon";

interface MultiplayerPromoProps {
  onOpen: () => void;
}

/** The dashed "Chercher à plusieurs" card at the bottom of the side column; opens the multiplayer dialog. Hidden while in a room. */
export const MultiplayerPromo = memo(function MultiplayerPromo({ onOpen }: MultiplayerPromoProps) {
  return (
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
  );
});
