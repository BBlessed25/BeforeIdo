import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SinglesWizard } from "../src/components/SinglesWizard";
import { submitSingles } from "../src/lib/submitSingles";
import { SINGLES_SUCCESS } from "../src/lib/singles";

async function next(user) {
  await user.click(screen.getByRole("button", { name: /continue/i }));
}
async function reachOptional(user) {
  await user.type(screen.getByRole("textbox", { name: /Full Name/ }), "TEST REGISTRATION QA");
  await next(user);
  await user.type(screen.getByRole("textbox", { name: /Phone Number/ }), "+44 020 7946 0958");
  await next(user);
  await user.type(screen.getByRole("textbox", { name: /Email Address/ }), "qa@example.com");
  await next(user);
  expect(screen.getAllByRole("radio").every((radio) => !radio.checked)).toBe(true);
  await user.click(screen.getByRole("radio", { name: "25–29" }));
  await next(user);
  expect(screen.getAllByRole("radio").every((radio) => !radio.checked)).toBe(true);
  await user.click(screen.getByRole("radio", { name: "Female" }));
  await next(user);
}
function confirmation(payload) {
  return {
    ok: true,
    saved: true,
    submissionId: payload.submissionId,
    submittedAt: "2026-10-05T12:00:00.000Z",
  };
}

describe("Singles registration", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("validates required questions and email, supports keyboard entry, and preserves answers with Back", async () => {
    const user = userEvent.setup();
    render(<SinglesWizard />);
    await next(user);
    expect(screen.getByRole("alert")).toHaveTextContent(/full name/i);
    await user.type(screen.getByRole("textbox", { name: /Full Name/ }), "Test User{Enter}");
    expect(screen.getByRole("heading", { name: /Phone Number/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByRole("textbox", { name: /Full Name/ })).toHaveValue("Test User");
    await next(user);
    await next(user);
    expect(screen.getByRole("alert")).toHaveTextContent(/phone number/i);
    await user.type(screen.getByRole("textbox", { name: /Phone Number/ }), "020 7946 0958");
    await next(user);
    await user.type(screen.getByRole("textbox", { name: /Email Address/ }), "bad-email");
    await next(user);
    expect(screen.getByRole("alert")).toHaveTextContent(/email address/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits optional blanks and shows success only after confirmation", async () => {
    fetch.mockImplementation(async (_url, options) => ({
      ok: true,
      json: async () => confirmation(JSON.parse(options.body)),
    }));
    const user = userEvent.setup();
    render(<SinglesWizard />);
    await reachOptional(user);
    for (let i = 0; i < 3; i++) {
      expect(
        screen.getAllByRole(i === 1 ? "checkbox" : "radio").every((input) => !input.checked)
      ).toBe(true);
      await next(user);
    }
    expect(screen.getAllByRole("radio").every((input) => !input.checked)).toBe(true);
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(await screen.findByText(SINGLES_SUCCESS)).toBeInTheDocument();
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload).toMatchObject({
      phone: "+44 020 7946 0958",
      attendance: "",
      expectations: [],
      dietary: "",
      dietaryDetails: "",
      futureEvents: "",
    });
  });

  it("supports multiple expectations, conditional details, clearing No, and safe retry with the same ID", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ ok: false, message: "Temporary failure. Please retry." }),
    });
    fetch.mockImplementation(async (_url, options) => ({
      ok: true,
      json: async () => confirmation(JSON.parse(options.body)),
    }));
    const user = userEvent.setup();
    render(<SinglesWizard />);
    await reachOptional(user);
    await user.click(screen.getByRole("radio", { name: "No" }));
    await next(user);
    await user.click(screen.getByRole("checkbox", { name: "Meet new people" }));
    await user.click(screen.getByRole("checkbox", { name: "Open to meeting someone" }));
    await next(user);
    await user.click(screen.getByRole("radio", { name: "Yes — please specify" }));
    await next(user);
    expect(screen.getByRole("alert")).toHaveTextContent(/please specify/i);
    await user.type(screen.getByRole("textbox", { name: /Please specify your dietary/ }), "Nuts");
    await user.click(screen.getByRole("radio", { name: "No" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Yes — please specify" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    await user.click(screen.getByRole("radio", { name: "No" }));
    await next(user);
    await user.click(screen.getByRole("radio", { name: "No" }));
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.getAllByRole("radio").every((radio) => !radio.checked)).toBe(true);
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Temporary failure");
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByRole("radio", { name: "No" })).toBeChecked();
    await next(user);
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(await screen.findByText(SINGLES_SUCCESS)).toBeInTheDocument();
    const first = JSON.parse(fetch.mock.calls[0][1].body),
      retry = JSON.parse(fetch.mock.calls[1][1].body);
    expect(first).toEqual(retry);
    expect(first).toMatchObject({
      attendance: "No",
      expectations: ["Meet new people", "Open to meeting someone"],
      dietary: "No",
      dietaryDetails: "",
      futureEvents: "",
    });
  });

  it("prevents repeated clicks during saving and retains failed registrations", async () => {
    let resolve;
    fetch.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    const user = userEvent.setup();
    render(<SinglesWizard />);
    await reachOptional(user);
    await next(user);
    await next(user);
    await next(user);
    await user.dblClick(screen.getByRole("button", { name: "Register" }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/saving/i);
    resolve({ ok: true, json: async () => ({ ok: true }) });
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not confirm/i);
    expect(screen.queryByText(SINGLES_SUCCESS)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register" })).toBeEnabled();
  });

  it("browser client rejects unreadable, mismatched, and unsuccessful responses", async () => {
    for (const result of [
      null,
      {},
      { ok: true },
      { ok: true, saved: true, submissionId: "wrong", submittedAt: new Date().toISOString() },
    ]) {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => result });
      await expect(submitSingles({ submissionId: "correct" })).rejects.toThrow(/confirm/);
    }
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error("HTML");
      },
    });
    await expect(submitSingles({ submissionId: "correct" })).rejects.toThrow(/confirm/);
  });
});
