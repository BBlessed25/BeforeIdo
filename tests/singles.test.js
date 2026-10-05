import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import {
  validateSingles,
  singlesRow,
  SINGLES_HEADERS,
  SINGLES_EXPECTATIONS,
} from "../src/lib/singles.js";
import handler from "../api/singles-register.js";
import { resetRateLimitsForTests } from "../server/singlesApi.js";

const registration = {
  submissionId: "12345678-1234-4234-8234-123456789012",
  fullName: "TEST REGISTRATION — QA",
  phone: "+44 020 7946 0958",
  email: "singles-test@example.com",
  ageRange: "25–29",
  gender: "Female",
  attendance: "",
  expectations: [],
  dietary: "",
  dietaryDetails: "",
  futureEvents: "",
};

test("only fields 1–5 are always required; phones preserve international prefixes and zeros", () => {
  assert.deepEqual(validateSingles(registration).errors, {});
  assert.equal(
    validateSingles({ ...registration, phone: "020 7946 0958" }).value.phone,
    "020 7946 0958"
  );
  for (const field of ["fullName", "phone", "email", "ageRange", "gender"]) {
    assert.ok(validateSingles({ ...registration, [field]: "" }).errors[field]);
  }
  assert.ok(validateSingles({ ...registration, email: "invalid" }).errors.email);
  for (const field of ["ageRange", "gender", "attendance", "dietary", "futureEvents"]) {
    assert.ok(validateSingles({ ...registration, [field]: "invented option" }).errors[field]);
  }
  assert.ok(validateSingles({ ...registration, expectations: ["unknown"] }).errors.expectations);
});

test("all 12 columns align; multiple selections and unanswered/No answers stay distinct", () => {
  const result = validateSingles({
    ...registration,
    expectations: [SINGLES_EXPECTATIONS[0], SINGLES_EXPECTATIONS[3]],
    dietary: "No",
    dietaryDetails: "must disappear",
    futureEvents: "No",
  });
  assert.deepEqual(result.errors, {});
  assert.equal(result.value.dietaryDetails, "");
  const row = singlesRow(result.value, "2026-10-05T12:00:00.000Z");
  assert.equal(row.length, SINGLES_HEADERS.length);
  assert.deepEqual(row, [
    registration.submissionId,
    "2026-10-05T12:00:00.000Z",
    registration.fullName,
    registration.phone,
    registration.email,
    "25–29",
    "Female",
    "",
    "Meet new people; Open to meeting someone",
    "No",
    "",
    "No",
  ]);
  assert.ok(
    validateSingles({ ...registration, dietary: "Yes — please specify" }).errors.dietaryDetails
  );
  assert.deepEqual(
    validateSingles({ ...registration, dietary: "Yes — please specify", dietaryDetails: "Nuts" })
      .errors,
    {}
  );
});

function harness({
  destination = "explicit-singles-spreadsheet",
  failWrite = false,
  failFlushOnce = false,
  lockedByOther = false,
} = {}) {
  let locked = false,
    writes = 0,
    flushFailed = false;
  const sheets = new Map();
  const range = (sheet, row, column, height, width) => ({
    setValues(values) {
      sheet.rows[row - 1] = [...values[0]];
      return this;
    },
    setNumberFormat(format) {
      assert.equal(format, "@");
      return this;
    },
    getDisplayValues() {
      return Array.from({ length: height }, (_, index) =>
        Array.from({ length: width }, (_, c) => sheet.rows[row - 1 + index]?.[column - 1 + c] ?? "")
      );
    },
    getFormulas() {
      return [Array(width).fill("")];
    },
  });
  const context = {
    Sheets: {
      Spreadsheets: {
        Values: {
          update(body, id, notation, options) {
            assert.equal(locked, true);
            assert.equal(id, "explicit-singles-spreadsheet");
            assert.equal(options.valueInputOption, "RAW");
            const row = Number(notation.match(/!A(\d+):L\d+$/)[1]);
            assert.equal(
              body.values[0].every((cell) => typeof cell === "string"),
              true
            );
            if (failWrite) throw new Error("write failed");
            writes++;
            sheets.get("Singles Event Registrations").rows[row - 1] = [...body.values[0]];
          },
        },
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) =>
          ({ SINGLES_SHARED_SECRET: "test-secret", SINGLES_SPREADSHEET_ID: destination })[key],
      }),
    },
    LockService: {
      getScriptLock: () => ({
        waitLock() {
          if (lockedByOther || locked) throw new Error("lock held");
          locked = true;
        },
        releaseLock() {
          locked = false;
        },
      }),
    },
    SpreadsheetApp: {
      openById(id) {
        assert.equal(id, "explicit-singles-spreadsheet");
        return {
          getSheetByName: (name) => sheets.get(name),
          insertSheet(name) {
            const sheet = {
              rows: [],
              getLastRow() {
                return this.rows.length;
              },
              getLastColumn() {
                return this.rows[0]?.length || 0;
              },
              setFrozenRows() {},
              getRange(...args) {
                return range(this, ...args);
              },
            };
            sheets.set(name, sheet);
            return sheet;
          },
        };
      },
      flush() {
        if (failFlushOnce && !flushFailed) {
          flushFailed = true;
          throw new Error("response lost after write");
        }
      },
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({
        text,
        setMimeType() {
          return this;
        },
      }),
    },
  };
  vm.createContext(context);
  for (const file of ["Code.gs", "SinglesValidation.gs", "Singles.gs"])
    vm.runInContext(
      readFileSync(new URL(`../google-apps-script/${file}`, import.meta.url), "utf8"),
      context
    );
  return {
    sheets,
    context,
    writes: () => writes,
    locked: () => locked,
    post: (data, secret = "test-secret") =>
      JSON.parse(
        context.doPost({
          postData: { contents: JSON.stringify({ action: "registerSingles", secret, data }) },
        }).text
      ),
  };
}

test("Apps Script validator is generated from the same source as browser and API", () => {
  const source = readFileSync(new URL("../src/lib/singles.js", import.meta.url), "utf8");
  const generated = readFileSync(
    new URL("../google-apps-script/SinglesValidation.gs", import.meta.url),
    "utf8"
  );
  assert.equal(
    generated,
    "// Generated from src/lib/singles.js. Run npm run sync:sheets after editing validation.\n" +
      source.replace(/^export /gm, "")
  );
});

test("Apps Script authenticates, requires destination, validates, locks writes, preserves literal text, and deduplicates", () => {
  const h = harness();
  assert.equal(h.post(registration, "wrong").code, "UNAUTHORIZED");
  assert.equal(h.post({ ...registration, email: "invalid" }).code, "VALIDATION_ERROR");
  assert.equal(h.writes(), 0);
  const value = {
    ...registration,
    fullName: '=HYPERLINK("https://example.com")',
    phone: "020 7946 0958",
    dietary: "Yes — please specify",
    dietaryDetails: "=1+1",
    expectations: SINGLES_EXPECTATIONS,
    attendance: "Visiting for the first time",
    futureEvents: "Yes",
  };
  const saved = h.post(value);
  assert.equal(saved.saved, true);
  assert.match(saved.submittedAt, /Z$/);
  const rows = h.sheets.get("Singles Event Registrations").rows;
  assert.deepEqual(Array.from(rows[0]), SINGLES_HEADERS);
  assert.deepEqual(
    Array.from(rows[1]),
    singlesRow(validateSingles(value).value, saved.submittedAt)
  );
  assert.equal(h.post(value).submittedAt, saved.submittedAt);
  assert.equal(h.writes(), 1);
  assert.equal(h.post({ ...value, fullName: "Different Person" }).code, "SUBMISSION_CONFLICT");
  assert.equal(h.writes(), 1);
  assert.equal(h.locked(), false);
  const international = harness();
  const plus = international.post(registration);
  assert.equal(plus.saved, true);
  assert.equal(
    international.sheets.get("Singles Event Registrations").rows[1][3],
    registration.phone
  );
  assert.equal(harness({ destination: "" }).post(registration).code, "CONFIGURATION_ERROR");
  assert.equal(harness({ failWrite: true }).post(registration).ok, false);
});

test("lost response after write retries without adding another row; lock contention cannot write", () => {
  const h = harness({ failFlushOnce: true });
  assert.equal(h.post(registration).ok, false);
  assert.equal(h.post(registration).saved, true);
  assert.equal(h.writes(), 1);
  assert.equal(h.locked(), false);
  const contended = harness({ lockedByOther: true });
  assert.equal(contended.post(registration).ok, false);
  assert.equal(contended.writes(), 0);
});

test("existing worksheet headers are verified and records never overwritten", () => {
  const h = harness();
  h.post(registration);
  h.sheets.get("Singles Event Registrations").rows[0][2] = "Unexpected header";
  assert.equal(
    h.post({ ...registration, submissionId: "22345678-1234-4234-8234-123456789012" }).code,
    "CONFIGURATION_ERROR"
  );
  assert.equal(h.writes(), 1);
});

function response() {
  return {
    statusCode: 0,
    body: null,
    setHeader() {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    end() {},
  };
}
function environment() {
  process.env.SINGLES_GOOGLE_APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/singles-test/exec";
  process.env.SINGLES_SHARED_SECRET = "test-secret";
  process.env.ALLOWED_ORIGIN = "https://singles.example.com";
  resetRateLimitsForTests();
}
function request(body = registration, origin = "https://singles.example.com") {
  return { method: "POST", headers: { origin }, body };
}

test("API validates before forwarding, rejects cross-origin calls, and uses the singles configuration", async () => {
  environment();
  const original = globalThis.fetch;
  const h = harness();
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, process.env.SINGLES_GOOGLE_APPS_SCRIPT_URL);
    calls++;
    const data = JSON.parse(options.body);
    assert.equal(data.action, "registerSingles");
    assert.equal(data.secret, "test-secret");
    return { ok: true, text: async () => JSON.stringify(h.post(data.data, data.secret)) };
  };
  try {
    const invalid = response();
    await handler(request({ ...registration, email: "invalid" }), invalid);
    assert.equal(invalid.statusCode, 400);
    assert.equal(calls, 0);
    const foreign = response();
    await handler(request(registration, "https://foreign.example.com"), foreign);
    assert.equal(foreign.statusCode, 403);
    assert.equal(calls, 0);
    const first = response();
    await handler(request(), first);
    assert.equal(first.body.saved, true);
    const retry = response();
    await handler(request(), retry);
    assert.deepEqual(retry.body, first.body);
    assert.equal(h.writes(), 1);
    const conflict = response();
    await handler(request({ ...registration, fullName: "Changed" }), conflict);
    assert.equal(conflict.statusCode, 409);
    delete process.env.SINGLES_SHARED_SECRET;
    const missing = response();
    await handler(request(), missing);
    assert.equal(missing.statusCode, 503);
  } finally {
    globalThis.fetch = original;
  }
});

test("API never reports success for unreadable, unconfirmed, mismatched or failed upstream responses", async () => {
  environment();
  const original = globalThis.fetch;
  try {
    for (const result of [
      "<html>not json</html>",
      "null",
      "{}",
      JSON.stringify({ ok: true }),
      JSON.stringify({
        ok: true,
        saved: true,
        submissionId: "wrong",
        submittedAt: new Date().toISOString(),
      }),
      JSON.stringify({ ok: false, code: "DATABASE_ERROR" }),
    ]) {
      globalThis.fetch = async () => ({ ok: true, text: async () => result });
      const res = response();
      await handler(request(), res);
      assert.equal(res.statusCode, 503);
      assert.equal(res.body.ok, false);
    }
    globalThis.fetch = async () => {
      throw new Error("secret internal detail");
    };
    const res = response();
    await handler(request(), res);
    assert.equal(res.statusCode, 503);
    assert.equal(JSON.stringify(res.body).includes("secret"), false);
  } finally {
    globalThis.fetch = original;
  }
});
