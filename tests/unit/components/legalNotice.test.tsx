// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LegalNotice } from "../../../src/components/LegalNotice";
import { resetVisit, statsAllowed } from "../../../src/stats";

beforeEach(() => {
  localStorage.clear();
  resetVisit();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

describe("the audience measurement's opt-out", () => {
  const box = () => screen.getByRole("checkbox", { name: "Ne pas compter mes visites sur cet appareil" }) as HTMLInputElement;

  it("says what is measured, and turns it off and back on for this device", () => {
    render(<LegalNotice onClose={() => {}} contact={null} />);
    expect(screen.getByRole("heading", { level: 2, name: "Mesure d'audience" })).toBeTruthy();
    expect(text()).toContain("Aucun identifiant n'est créé ni lu");
    expect(box().checked).toBe(false);

    fireEvent.click(box());
    expect(box().checked).toBe(true);
    expect(localStorage.getItem("lyrix:no-stats")).toBe("1");
    expect(statsAllowed()).toBe(false);

    fireEvent.click(box());
    expect(box().checked).toBe(false);
    expect(statsAllowed()).toBe(true);
  });

  it("shows a choice made earlier on this device", () => {
    localStorage.setItem("lyrix:no-stats", "1");
    render(<LegalNotice onClose={() => {}} contact={null} />);
    expect(box().checked).toBe(true);
  });

  it("says so when the browser already refuses tracking, the box checked and locked", () => {
    vi.stubGlobal("navigator", { ...navigator, globalPrivacyControl: true });
    render(<LegalNotice onClose={() => {}} contact={null} />);
    expect(box().checked).toBe(true);
    expect(box().disabled).toBe(true);
    expect(text()).toContain("Ton navigateur demande déjà à ne pas être suivi");
  });
});
