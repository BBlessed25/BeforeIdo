import { randomUUID } from "node:crypto";
import handler from "../api/singles-register.js";
import { SINGLES_EXPECTATIONS } from "../src/lib/singles.js";

// Only synthetic test data. Each run leaves one clearly labeled row for the organizer to remove.
const submissionId = process.env.SINGLES_TEST_SUBMISSION_ID || randomUUID();
const data = {
  submissionId,
  fullName: "TEST REGISTRATION — DELETE AFTER VERIFICATION",
  phone: "+44 020 7946 0958",
  email: "singles-qa@example.com",
  ageRange: "30–34",
  gender: "Female",
  attendance: "Visiting for the first time",
  expectations: SINGLES_EXPECTATIONS,
  dietary: "Yes — please specify",
  dietaryDetails: "TEST ONLY: nuts; literal text =1+1",
  futureEvents: "Yes",
};
async function submit() {
  const response = {
    statusCode: 0,
    body: null,
    setHeader() {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {},
  };
  await handler(
    { method: "POST", headers: { origin: process.env.ALLOWED_ORIGIN }, body: data },
    response
  );
  if (response.statusCode !== 200 || response.body?.saved !== true) {
    throw new Error(response.body?.message || "The test row could not be confirmed.");
  }
  return response.body;
}
try {
  // Record the ID before attempting the write: an ambiguous timeout must retry with this same ID.
  console.log(`Test submission ID: ${submissionId}`);
  const first = await submit();
  const retry = await submit();
  if (first.submissionId !== retry.submissionId || first.submittedAt !== retry.submittedAt) {
    throw new Error("Retry confirmation did not match the first submission.");
  }
  console.log("Google Sheets confirmed the complete row and an idempotent retry.");
  console.log(`One test row remains in Singles Event Registrations: ${submissionId}`);
  console.log(
    "The backend verified all 12 cells against the expected values and checked for formulas."
  );
} catch (error) {
  console.error(error.message);
  console.error(
    `If the outcome is uncertain, retry using SINGLES_TEST_SUBMISSION_ID=${submissionId}.`
  );
  process.exitCode = 1;
}
