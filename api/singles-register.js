import { validateSingles } from "../src/lib/singles.js";
import {
  callAppsScript,
  getRequestBody,
  getSinglesServerConfig,
  guardRequest,
  sendJson,
} from "../server/singlesApi.js";

export default async function handler(request, response) {
  try {
    const config = getSinglesServerConfig();
    if (
      !guardRequest(request, response, {
        methods: ["POST"],
        routeName: "singles-register",
        allowedOrigin: config.allowedOrigin,
      })
    )
      return;
    const { errors, value } = validateSingles(getRequestBody(request));
    if (Object.keys(errors).length)
      return sendJson(response, 400, {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Please correct the highlighted answer.",
        errors,
      });
    const result = await callAppsScript("registerSingles", value, config);
    if (
      result?.ok === true &&
      result.saved === true &&
      result.submissionId === value.submissionId &&
      typeof result.submittedAt === "string" &&
      Number.isFinite(Date.parse(result.submittedAt))
    ) {
      return sendJson(response, 200, {
        ok: true,
        saved: true,
        submissionId: result.submissionId,
        submittedAt: result.submittedAt,
      });
    }
    if (result?.code === "VALIDATION_ERROR" && result.errors)
      return sendJson(response, 400, {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Please correct the highlighted answer.",
        errors: result.errors,
      });
    if (result?.code === "SUBMISSION_CONFLICT")
      return sendJson(response, 409, {
        ok: false,
        code: "SUBMISSION_CONFLICT",
        message:
          "An earlier version of this registration was already saved. Please contact the organizer before registering again.",
      });
    return sendJson(response, 503, {
      ok: false,
      message:
        "We could not confirm your registration was saved. Your answers are still here. Please retry.",
    });
  } catch (error) {
    const configuration = ["SERVER_CONFIGURATION_ERROR", "CONFIGURATION_ERROR"].includes(
      error.code
    );
    const invalid = ["INVALID_JSON", "REQUEST_TOO_LARGE"].includes(error.code);
    return sendJson(response, configuration ? 503 : invalid ? 400 : 503, {
      ok: false,
      message: configuration
        ? "Registration is not configured yet. Please contact the organizer or try again later."
        : "We could not save your registration. Your answers are still here. Please retry.",
    });
  }
}
