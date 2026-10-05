import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "../src/App";

vi.mock("../src/pages/SinglesRegistrationPage", () => ({
  SinglesRegistrationPage: () => (
    <>
      <section id="hero">About the event</section>
      <section id="registration">Registration form</section>
    </>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(["/", "/singles"])("switches navigation on %s when scrolling down and back up", (path) => {
  window.history.replaceState({}, "", path);
  vi.stubGlobal("scrollY", 0);
  vi.stubGlobal("innerHeight", 700);
  vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(1600);
  vi.spyOn(document.body, "scrollHeight", "get").mockReturnValue(1600);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    if (this.tagName === "NAV") return { top: 0, bottom: 72 };
    return { top: (this.id === "registration" ? 600 : 100) - window.scrollY };
  });
  render(<App />);
  const about = screen.getByRole("button", { name: "About" });
  const register = screen.getByRole("button", { name: "Register" });
  expect(about).toHaveAttribute("aria-current", "location");
  expect(register).not.toHaveAttribute("aria-current");
  vi.stubGlobal("scrollY", 530);
  fireEvent.scroll(window);
  expect(register).toHaveAttribute("aria-current", "location");
  expect(about).not.toHaveAttribute("aria-current");
  vi.stubGlobal("scrollY", 200);
  fireEvent.scroll(window);
  expect(about).toHaveAttribute("aria-current", "location");
});

it("highlights a short registration section at the bottom and scrolls nav clicks to the section", () => {
  window.history.replaceState({}, "", "/singles");
  vi.stubGlobal("scrollY", 0);
  vi.stubGlobal("innerHeight", 700);
  vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(900);
  vi.spyOn(document.body, "scrollHeight", "get").mockReturnValue(900);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    return this.tagName === "NAV"
      ? { bottom: 72 }
      : { top: (this.id === "registration" ? 600 : 100) - window.scrollY };
  });
  render(<App />);
  const scrollIntoView = vi.fn();
  document.getElementById("registration").scrollIntoView = scrollIntoView;
  const register = screen.getByRole("button", { name: "Register" });
  fireEvent.click(register);
  expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  vi.stubGlobal("scrollY", 200);
  fireEvent.scroll(window);
  expect(register).toHaveAttribute("aria-current", "location");
  vi.stubGlobal("scrollY", 0);
  fireEvent.scroll(window);
  expect(screen.getByRole("button", { name: "About" })).toHaveAttribute("aria-current", "location");
});
