/** @typedef {Error & { code?: string }} CodedError */

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const rateLimitBuckets = new Map();

function headerValue(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function requestIp(request) {
  const forwarded = headerValue(request, "x-forwarded-for");
  return String(forwarded || request.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function requestOriginIsAllowed(request, allowedOrigin) {
  const fetchSite = String(headerValue(request, "sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "cross-site") return false;

  const origin = headerValue(request, "origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === allowedOrigin;
  } catch {
    return false;
  }
}

function withinRateLimit(request, routeName, maximum) {
  const now = Date.now();
  if (rateLimitBuckets.size > 1_000) {
    for (const [bucketKey, bucket] of rateLimitBuckets) {
      if (bucket.resetAt <= now) rateLimitBuckets.delete(bucketKey);
    }
  }
  const key = `${routeName}:${requestIp(request)}`;
  const current = rateLimitBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= maximum;
}

export function resetRateLimitsForTests() {
  rateLimitBuckets.clear();
}

export function sendJson(response, statusCode, payload, origin = "") {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Vary", "Origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  return response.status(statusCode).json(payload);
}

export function guardRequest(
  request,
  response,
  { methods, routeName, allowedOrigin, maximum = 10 }
) {
  const origin = headerValue(request, "origin") || "";
  if (request.method === "OPTIONS") {
    if (!requestOriginIsAllowed(request, allowedOrigin)) {
      sendJson(response, 403, {
        ok: false,
        code: "ORIGIN_NOT_ALLOWED",
        message: "Request origin is not allowed.",
      });
      return false;
    }
    response.setHeader("Access-Control-Allow-Methods", [...methods, "OPTIONS"].join(", "));
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
    response.status(204).end();
    return false;
  }

  if (!methods.includes(request.method)) {
    response.setHeader("Allow", methods.join(", "));
    sendJson(response, 405, {
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed.",
    });
    return false;
  }
  if (!requestOriginIsAllowed(request, allowedOrigin)) {
    sendJson(response, 403, {
      ok: false,
      code: "ORIGIN_NOT_ALLOWED",
      message: "Request origin is not allowed.",
    });
    return false;
  }
  if (!withinRateLimit(request, routeName, maximum)) {
    response.setHeader("Retry-After", String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
    sendJson(
      response,
      429,
      { ok: false, code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
      origin
    );
    return false;
  }
  return true;
}

export function getRequestBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) {
    if (JSON.stringify(request.body).length > 16_384) {
      const error = /** @type {CodedError} */ (new Error("The request is too large."));
      error.code = "REQUEST_TOO_LARGE";
      throw error;
    }
    return request.body;
  }
  if (typeof request.body === "string") {
    if (request.body.length > 16_384) {
      const error = /** @type {CodedError} */ (new Error("The request is too large."));
      error.code = "REQUEST_TOO_LARGE";
      throw error;
    }
    try {
      return JSON.parse(request.body || "{}");
    } catch {
      const error = /** @type {CodedError} */ (new Error("The request body is invalid."));
      error.code = "INVALID_JSON";
      throw error;
    }
  }
  return {};
}

export function getSinglesServerConfig(environment = process.env) {
  const appsScriptUrl = environment.SINGLES_GOOGLE_APPS_SCRIPT_URL;
  const sharedSecret = environment.SINGLES_SHARED_SECRET;
  if (!appsScriptUrl || !sharedSecret) {
    const error = /** @type {CodedError} */ (new Error("Registration service is not configured."));
    error.code = "SERVER_CONFIGURATION_ERROR";
    throw error;
  }

  const config = {
    appsScriptUrl: String(appsScriptUrl).trim(),
    sharedSecret: String(sharedSecret).trim(),
    allowedOrigin: String(environment.ALLOWED_ORIGIN || "").trim(),
  };
  if (!config.appsScriptUrl || !config.sharedSecret || !config.allowedOrigin) {
    const error = /** @type {CodedError} */ (
      new Error("Registration service configuration is incomplete.")
    );
    error.code = "CONFIGURATION_ERROR";
    throw error;
  }
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(config.appsScriptUrl)) {
    const error = /** @type {CodedError} */ (new Error("Registration backend URL is invalid."));
    error.code = "CONFIGURATION_ERROR";
    throw error;
  }
  try {
    const allowedOrigin = new URL(config.allowedOrigin);
    const isLocalHttp =
      allowedOrigin.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(allowedOrigin.hostname);
    if (
      allowedOrigin.origin !== config.allowedOrigin ||
      (!isLocalHttp && allowedOrigin.protocol !== "https:")
    ) {
      throw new Error("invalid origin");
    }
  } catch {
    const error = /** @type {CodedError} */ (new Error("Allowed origin is invalid."));
    error.code = "CONFIGURATION_ERROR";
    throw error;
  }
  return config;
}

export async function callAppsScript(action, data, config = getSinglesServerConfig()) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(config.appsScriptUrl, {
      method: "POST",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        Accept: "application/json",
      },
      body: JSON.stringify({
        action,
        secret: config.sharedSecret,
        ...(data === undefined ? {} : { data }),
      }),
    });

    const text = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(text);
    } catch {
      const error = /** @type {CodedError} */ (
        new Error("Registration database returned an invalid response.")
      );
      error.code = "GOOGLE_BACKEND_UNAVAILABLE";
      throw error;
    }
    if (!response.ok && responseData?.ok !== false) {
      const error = /** @type {CodedError} */ (
        new Error("Registration database is temporarily unavailable.")
      );
      error.code = "GOOGLE_BACKEND_UNAVAILABLE";
      throw error;
    }
    return responseData;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = /** @type {CodedError} */ (
        new Error("Registration database timed out.")
      );
      timeoutError.code = "GOOGLE_BACKEND_UNAVAILABLE";
      throw timeoutError;
    }
    const codedError = /** @type {CodedError} */ (error);
    if (!codedError.code) codedError.code = "GOOGLE_BACKEND_UNAVAILABLE";
    throw codedError;
  } finally {
    clearTimeout(timeout);
  }
}
