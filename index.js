import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_BASE_URL = "https://www.talkpix.ai/api/v1";
const TERMINAL_STATUSES = new Set(["completed", "failed"]);

/** An error returned by the TalkPix API (or a network failure reaching it). */
export class TalkPixError extends Error {
  constructor(message, { status = null, type = "api_error", param = null, body = null } = {}) {
    super(message);
    this.name = "TalkPixError";
    this.status = status;
    this.type = type;
    this.param = param;
    this.body = body;
  }
}

/**
 * Client for the TalkPix Developer API: one portrait + a script or audio
 * → a lip-synced talking video. Docs: https://www.talkpix.ai/developers
 *
 * Keep the key on your server. Never ship it in a browser or mobile app.
 */
export class TalkPix {
  constructor({ apiKey = process.env.TALKPIX_API_KEY, baseUrl = DEFAULT_BASE_URL, fetch: fetchImpl } = {}) {
    if (!apiKey) {
      throw new TalkPixError(
        "Missing API key. Pass { apiKey } or set TALKPIX_API_KEY. Create one at https://www.talkpix.ai/account/api.",
        { type: "authentication_error" },
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetch = fetchImpl ?? globalThis.fetch;
    if (typeof this.fetch !== "function") {
      throw new TalkPixError("No fetch implementation found. Use Node.js 18+ or pass { fetch }.");
    }

    this.videos = {
      create: (params) => this.request("POST", "/videos", params),
      retrieve: (id) => this.request("GET", `/videos/${encodeURIComponent(id)}`),
      list: (params = {}) => this.request("GET", `/videos${toQuery(params)}`),
      waitForCompletion: (id, options) => this.waitForCompletion(id, options),
    };
    this.uploads = {
      create: (params) => this.request("POST", "/uploads", params),
      upload: (data, options) => this.uploadFile(data, options),
    };
  }

  /** The account behind the key, with its credit balance. */
  me() {
    return this.request("GET", "/me");
  }

  /** Available voices, languages and ready-made voice/video prompts. */
  voices() {
    return this.request("GET", "/voices");
  }

  /** Credits a script will reserve before anything is rendered. Free. */
  estimate({ script, resolution } = {}) {
    return this.request("POST", "/estimate", { script, resolution });
  }

  /** Poll a render until it is completed or failed. */
  async waitForCompletion(id, { intervalMs = 5000, timeoutMs = 10 * 60 * 1000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const video = await this.videos.retrieve(id);
      if (TERMINAL_STATUSES.has(video.status)) return video;
      if (Date.now() + intervalMs > deadline) {
        throw new TalkPixError(`Video ${id} is still ${video.status} after ${timeoutMs} ms.`, { type: "timeout_error" });
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  /**
   * Upload a local photo or audio file (Buffer, Uint8Array, Blob or string)
   * and get back the `key` to pass as `image_key` / `audio_key`.
   */
  async uploadFile(data, { contentType, kind = contentType?.startsWith("audio/") ? "audio" : "image" } = {}) {
    if (!contentType) {
      throw new TalkPixError("uploadFile needs { contentType }, e.g. 'image/jpeg' or 'audio/mpeg'.", {
        type: "invalid_request_error",
        param: "content_type",
      });
    }
    const upload = await this.uploads.create({ kind, content_type: contentType });
    const response = await this.fetch(upload.upload_url, {
      method: upload.method ?? "PUT",
      headers: upload.headers ?? { "Content-Type": contentType },
      body: data,
    });
    if (!response.ok) {
      throw new TalkPixError(`Upload failed with HTTP ${response.status}.`, { status: response.status });
    }
    return upload;
  }

  async request(method, path, body) {
    const headers = { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let response;
    try {
      response = await this.fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      throw new TalkPixError(`Could not reach the TalkPix API: ${cause?.message ?? cause}`, { type: "connection_error" });
    }

    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // Non-JSON body (e.g. an edge error page); reported below.
    }

    if (!response.ok) {
      const error = json?.error ?? {};
      throw new TalkPixError(error.message ?? `HTTP ${response.status}`, {
        status: response.status,
        type: error.type ?? "api_error",
        param: error.param ?? null,
        body: json ?? text,
      });
    }
    return json;
  }
}

/**
 * Verify a webhook delivery. `header` is the `TalkPix-Signature` header
 * (`t=<unix>,v1=<hex>`), `body` the raw request body string, and `secret`
 * the webhook secret shown on https://www.talkpix.ai/account/api.
 */
export function verifyWebhookSignature(secret, header, body, toleranceSeconds = 300) {
  if (!secret || !header || typeof body !== "string") return false;
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
  const timestamp = Number(parts.t);
  const presented = parts.v1;
  if (!Number.isFinite(timestamp) || !presented) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  if (expected.length !== presented.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(presented));
}

function toQuery(params) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null);
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : "";
}

export default TalkPix;
