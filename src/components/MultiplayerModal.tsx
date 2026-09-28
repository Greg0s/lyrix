import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";

interface MultiplayerModalProps {
  onClosed: () => void;
}

type Tab = "create" | "join";

/**
 * PLACEHOLDER. The v3 mockup's "Jouer à plusieurs" dialog, laid out in full so
 * the entry points exist, but rooms themselves don't yet: the create and join
 * actions stay disabled behind a "Bientôt disponible" notice. Real rooms are
 * tracked in GitHub issues #29 (create/join) and #30 (shared progress). Team
 * mode is still out of scope per CLAUDE.md until those are green-lit.
 */
export function MultiplayerModal({ onClosed }: MultiplayerModalProps) {
  const [tab, setTab] = useState<Tab>("create");
  const [pseudo, setPseudo] = useState("");
  const [code, setCode] = useState("");

  const onJoin = (event: FormEvent<HTMLFormElement>) => event.preventDefault();

  return (
    <Modal title="Jouer à plusieurs" onClosed={onClosed} size="wide">
      {() => (
        <div className="lyrix-mp">
          <p className="lyrix-soon" role="note">
            <span className="lyrix-soon-badge">Bientôt disponible</span>
            Le jeu à plusieurs arrive prochainement&nbsp;: en attendant, la chanson du jour se cherche en solo.
          </p>

          <div className={`lyrix-tabs${tab === "join" ? " is-second" : ""}`} role="tablist">
            <span className="lyrix-tabs-indicator" aria-hidden="true" />
            <button
              type="button"
              role="tab"
              aria-selected={tab === "create"}
              className={tab === "create" ? "is-active" : undefined}
              onClick={() => setTab("create")}
            >
              Créer un salon
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "join"}
              className={tab === "join" ? "is-active" : undefined}
              onClick={() => setTab("join")}
            >
              Rejoindre
            </button>
          </div>

          <label className="lyrix-field">
            <span>Ton pseudo</span>
            <input
              type="text"
              className="lyrix-field-input"
              value={pseudo}
              onChange={(event) => setPseudo(event.target.value)}
              placeholder="Ex. Camille"
              maxLength={16}
            />
          </label>

          {tab === "create" ? (
            <div className="lyrix-mp-pane is-create">
              <p className="lyrix-mp-text">
                Tu deviens l'hôte. Un code de salon est généré&nbsp;: partage-le aux autres joueurs pour qu'ils te
                rejoignent. Le salon n'a pas de limite de joueurs.
              </p>
              <button type="button" className="lyrix-button is-block" disabled>
                Créer le salon
              </button>
            </div>
          ) : (
            <form className="lyrix-mp-pane is-join" onSubmit={onJoin}>
              <label className="lyrix-field">
                <span>Code du salon</span>
                <input
                  type="text"
                  className="lyrix-field-input is-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="6 caractères"
                  maxLength={6}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <button type="submit" className="lyrix-button is-accent is-block" disabled>
                Rejoindre le salon
              </button>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}
