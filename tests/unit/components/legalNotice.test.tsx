// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LegalNotice } from "../../../src/components/LegalNotice";

afterEach(cleanup);

const mailLinks = () => [...document.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]')];
const text = () => document.querySelector("main")?.textContent ?? "";

describe("the legal notice's contact", () => {
  it("names none until one is set, and leaves no sentence hanging", () => {
    render(<LegalNotice onClose={() => {}} contact={null} />);
    expect(mailLinks()).toEqual([]);
    expect(text()).not.toMatch(/écrire à|écrivant à|Pour le joindre/);
    expect(text()).toContain("t'y opposer. Sans compte");
    expect(text()).toContain("ne servent qu'au jeu.");
  });

  it("offers it to write to, once set: to reach the publisher, take a song down, and exercise a right", () => {
    render(<LegalNotice onClose={() => {}} contact="contact@lyrix.fr" />);
    const links = mailLinks();
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.getAttribute("href")).toBe("mailto:contact@lyrix.fr");
      expect(link.textContent).toBe("contact@lyrix.fr");
    }
    expect(text()).toContain("Pour le joindre : contact@lyrix.fr.");
    expect(text()).toContain("peut écrire à contact@lyrix.fr : elle sera retirée sans délai.");
    expect(text()).toContain("t'y opposer, en écrivant à contact@lyrix.fr. Sans compte");
  });
});
