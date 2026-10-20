import { CONTACT_EMAIL, isPublishableContact } from "../src/legal";

/**
 * Run by the deploy (.github/workflows/ci.yml) before anything ships: the
 * legal page names a contact address, which the GDPR and the LCEN require
 * to reach someone. A placeholder there would be a page that says it can
 * be written to and can't.
 */
if (!isPublishableContact(CONTACT_EMAIL)) {
  console.error(
    `legal:check: CONTACT_EMAIL is "${CONTACT_EMAIL}", a placeholder.\n` +
      "Set it in src/legal.ts to the address players and rights holders should write to, then deploy again."
  );
  process.exit(1);
}
console.log(`legal:check: the legal page's contact is ${CONTACT_EMAIL}.`);
