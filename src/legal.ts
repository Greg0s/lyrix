/**
 * What the site says about who publishes it and what it does with players'
 * data, on its legal page (LegalNotice.tsx, /mentions-legales): what French
 * law (LCEN, article 6) and the GDPR ask of a site open to the public.
 *
 * The publisher is a private individual, publishing on a non-professional
 * basis: the LCEN lets them name only their host, to whom they gave their
 * identity (decided with the developer).
 */

/**
 * Where players and rights holders write: a GDPR request, a song to take
 * down. A placeholder (`.invalid`, a domain that never exists) until the
 * developer picks the address; the deploy refuses to ship it
 * (`npm run legal:check`, scripts/check-legal.ts).
 */
export const CONTACT_EMAIL = "contact@lyrix.invalid";

/** The day the legal page last changed what it says, shown on it. */
export const LEGAL_UPDATED = "2026-10-20";

/** The site's host, as the LCEN requires it named: Cloudflare runs both the site (Pages) and the game's server (Workers). */
export const HOST = {
  name: "Cloudflare, Inc.",
  address: "101 Townsend St, San Francisco, CA 94107, États-Unis",
  phone: "+1 (650) 319-8930",
  url: "https://www.cloudflare.com",
} as const;

/** Domains reserved for examples and tests (RFC 2606, RFC 6761): an address on one reaches no one. */
const RESERVED_DOMAIN = /(^|\.)(invalid|test|example|localhost)$|^example\.(com|net|org)$/i;

/** Whether `email` is an address a player could actually write to, not a placeholder. */
export function isPublishableContact(email: string): boolean {
  const match = /^[^\s@]+@([^\s@]+\.[a-z]{2,})$/i.exec(email);
  return match !== null && !RESERVED_DOMAIN.test(match[1]);
}
