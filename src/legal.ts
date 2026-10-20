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
 * down. None yet, the developer will add one (decided with them): until
 * then, the page leaves out the sentences that would name it.
 */
export const CONTACT_EMAIL: string | null = null;

/** The day the legal page last changed what it says, shown on it. */
export const LEGAL_UPDATED = "2026-10-20";

/** The site's host, as the LCEN requires it named: Cloudflare runs both the site (Pages) and the game's server (Workers). */
export const HOST = {
  name: "Cloudflare, Inc.",
  address: "101 Townsend St, San Francisco, CA 94107, États-Unis",
  phone: "+1 (650) 319-8930",
  url: "https://www.cloudflare.com",
} as const;
