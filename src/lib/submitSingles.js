/** @typedef {Error & { errors?: Record<string, string> }} SinglesError */
export async function submitSingles(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40000);
  try {
    const response = await fetch("/api/singles-register", {
      method: "POST",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("We could not confirm your registration was saved. Please retry.");
    }
    if (
      !response.ok ||
      result?.ok !== true ||
      result.saved !== true ||
      result.submissionId !== payload.submissionId ||
      typeof result.submittedAt !== "string" ||
      !Number.isFinite(Date.parse(result.submittedAt))
    ) {
      const error = /** @type {SinglesError} */ (
        new Error(
          result?.message || "We could not confirm your registration was saved. Please retry."
        )
      );
      error.errors = result?.errors;
      throw error;
    }
    return result;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error(
        "Saving took too long to confirm. Your answers are still here. Please retry safely."
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
