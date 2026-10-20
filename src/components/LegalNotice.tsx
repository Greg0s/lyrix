import { dayStart } from "../game/daily";
import { CONTACT_EMAIL, HOST, LEGAL_UPDATED } from "../legal";

interface LegalNoticeProps {
  /** Leaves the page for today's song. */
  onClose: () => void;
}

const updatedLabel = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(
  dayStart(LEGAL_UPDATED)
);

function Contact() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}

/**
 * The legal notice and the privacy policy, a page of their own
 * (/mentions-legales), linked from every screen's footer. Every word of it
 * must stay true of the code: a change to what the game keeps, sends or
 * loads changes this page in the same commit (src/legal.ts).
 */
export function LegalNotice({ onClose }: LegalNoticeProps) {
  return (
    <main className="lyrix-legal-page">
      <article className="lyrix-card lyrix-legal">
        <h1 className="lyrix-help-title">Mentions légales et confidentialité</h1>
        <p className="lyrix-help-lead">
          Lyrix est un jeu gratuit, sans compte, sans publicité, sans cookie et sans mesure d'audience.
        </p>

        <section aria-labelledby="lyrix-legal-publisher">
          <h2 id="lyrix-legal-publisher">Éditeur</h2>
          <p>
            Lyrix est édité à titre non professionnel par un particulier, qui a communiqué son identité à l'hébergeur
            ci-dessous (article 6 de la loi pour la confiance dans l'économie numérique). Pour le joindre&nbsp;:{" "}
            <Contact />.
          </p>
        </section>

        <section aria-labelledby="lyrix-legal-host">
          <h2 id="lyrix-legal-host">Hébergement</h2>
          <p>
            Le site et le serveur du jeu sont hébergés par {HOST.name}, {HOST.address}, {HOST.phone},{" "}
            <a href={HOST.url}>{HOST.url.replace(/^https:\/\/(www\.)?/, "")}</a>.
          </p>
        </section>

        <section aria-labelledby="lyrix-legal-rights">
          <h2 id="lyrix-legal-rights">Paroles et droits d'auteur</h2>
          <p>
            Les paroles appartiennent à leurs auteurs, compositeurs et éditeurs. Elles proviennent de{" "}
            <a href="https://lrclib.net">LRCLIB</a>, une base de paroles collaborative, et ne servent qu'au jeu. Un ayant
            droit qui souhaite le retrait d'une chanson peut écrire à <Contact />&nbsp;: elle sera retirée sans délai.
          </p>
          <p>Les polices Bricolage Grotesque et Figtree sont diffusées sous licence SIL Open Font License&nbsp;1.1.</p>
        </section>

        <section aria-labelledby="lyrix-legal-privacy">
          <h2 id="lyrix-legal-privacy">Tes données</h2>
          <p>Lyrix ne te demande rien sur toi. Voici tout ce que le jeu traite, et pourquoi.</p>
          <dl className="lyrix-legal-list">
            <dt>Ta partie, sur ton appareil</dt>
            <dd>
              Ta progression, tes archives, ton thème et le salon où tu joues sont enregistrés dans le stockage local de
              ton navigateur, pour que tu retrouves ta partie. Ce stockage est indispensable au jeu que tu demandes, il
              ne sert à rien d'autre et ne demande donc pas de consentement. Tu l'effaces en effaçant les données du site
              dans ton navigateur.
            </dd>
            <dt>Les mots que tu proposes</dt>
            <dd>
              En solo, ils sont envoyés au serveur du jeu, qui les vérifie sans les garder&nbsp;: ta progression te
              revient chiffrée, et c'est ton navigateur qui la conserve.
            </dd>
            <dt>Les salons</dt>
            <dd>
              Pour jouer à plusieurs, tu choisis un pseudo. Seuls les membres du salon le voient. Il est conservé, avec
              les mots proposés, dans le salon lui-même, jusqu'à ce que tout le monde en parte ou qu'il expire avec la
              chanson du jour, à minuit UTC. Il n'est jamais inscrit dans les journaux du serveur. Rien ne t'oblige à
              choisir un pseudo qui permette de t'identifier.
            </dd>
            <dt>Ton adresse IP</dt>
            <dd>
              Comme tout site, Lyrix la reçoit à chaque requête. Elle sert à t'envoyer les pages, à protéger le site des
              abus et à limiter le nombre de salons créés ou rejoints par minute&nbsp;; Lyrix ne la conserve pas. Les
              journaux techniques du serveur, qui servent à diagnostiquer une panne, sont effacés au bout de quelques
              jours.
            </dd>
            <dt>Aucun service tiers</dt>
            <dd>
              Le site ne charge rien depuis un autre service&nbsp;: ni police, ni script, ni traceur. Aucune donnée
              n'est vendue, partagée à des fins publicitaires ni utilisée pour te profiler.
            </dd>
          </dl>
          <p>
            Le responsable de ces traitements est l'éditeur. Ils reposent sur son intérêt légitime à faire fonctionner
            le jeu que tu utilises et à le protéger des abus (article 6.1.f du RGPD). Son seul sous-traitant,{" "}
            {HOST.name}, est établi aux États-Unis et adhère au Data Privacy Framework UE–États-Unis, qui encadre ce
            transfert.
          </p>
        </section>

        <section aria-labelledby="lyrix-legal-requests">
          <h2 id="lyrix-legal-requests">Tes droits</h2>
          <p>
            Tu peux demander l'accès à tes données, leur rectification ou leur effacement, en limiter le traitement ou
            t'y opposer, en écrivant à <Contact />. Sans compte, Lyrix ne sait pas relier une donnée à toi&nbsp;: il te
            sera peut-être demandé de quoi la retrouver, comme le code d'un salon. Tu peux aussi adresser une
            réclamation à la <a href="https://www.cnil.fr">CNIL</a>.
          </p>
        </section>

        <p className="lyrix-legal-updated">Dernière mise à jour&nbsp;: {updatedLabel}.</p>
        <button type="button" className="lyrix-button" onClick={onClose}>
          Retour au jeu
        </button>
      </article>
    </main>
  );
}
