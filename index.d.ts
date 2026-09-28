export type VideoStatus = "queued" | "processing" | "completed" | "failed";
export type Resolution = "720p" | "1080p";

export interface CreateVideoParams {
  /** Public https URL of the portrait. Provide exactly one of image_url / image_key. */
  image_url?: string;
  /** Key returned by uploads.create / uploadFile. */
  image_key?: string;
  /** Script mode: the words to speak (with voice + language). */
  script?: string;
  /** Voice id or alias from voices(), e.g. "zephyr". Required in script mode. */
  voice?: string;
  /** Language id or alias from voices(), e.g. "en-US". Required in script mode. */
  language?: string;
  /** Script mode only: how the voice should sound. */
  voice_prompt?: string;
  /** How the face and camera should move. */
  video_prompt?: string;
  captions?: boolean;
  /** Audio mode: your own recording instead of a script. */
  audio_url?: string;
  audio_key?: string;
  resolution?: Resolution;
  /** Receives a signed video.completed / video.failed event. */
  webhook_url?: string;
  /** Up to 20 string keys, echoed back on the video and its webhook. */
  metadata?: Record<string, string>;
}

export interface Video {
  id: string;
  object: "video";
  status: VideoStatus;
  video_url: string | null;
  duration_seconds: number | null;
  resolution: Resolution;
  mode: "script" | "audio";
  credits_reserved: number;
  credits_charged: number | null;
  credits_refunded: boolean;
  error: { code: string; message: string } | null;
  webhook_url: string | null;
  webhook_delivered_at: string | null;
  metadata: Record<string, string>;
  created_at: string;
  completed_at: string | null;
  /** Present on create: the credit balance after the reservation. */
  balance?: number;
}

export interface VideoList {
  object: "list";
  data: Video[];
  has_more: boolean;
  next_starting_after?: string;
}

export interface Estimate {
  object: "estimate";
  resolution: Resolution;
  estimated_seconds: number;
  credits: number;
  max_seconds: number;
  words: number;
}

export interface Account {
  object: "account";
  email: string | null;
  api_key: { id: string; name: string };
  credits: {
    balance: number;
    seconds_available: Record<string, number>;
    add_credits_url: string;
  };
}

export interface VoiceCatalog {
  object: "list";
  voices: { id: string; alias: string; sex: string | null; sample_url: string }[];
  languages: { id: string; alias: string }[];
  voice_prompts: { id: string; prompt: string }[];
  video_prompts: { id: string; prompt: string }[];
}

export interface Upload {
  object: "upload";
  kind: "image" | "audio";
  key: string;
  upload_url: string;
  method: "PUT";
  headers: Record<string, string>;
  expires_in: number;
  max_bytes: number;
}

export interface TalkPixOptions {
  /** Defaults to process.env.TALKPIX_API_KEY. */
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export declare class TalkPixError extends Error {
  status: number | null;
  type: string;
  param: string | null;
  body: unknown;
}

export declare class TalkPix {
  constructor(options?: TalkPixOptions);
  me(): Promise<Account>;
  voices(): Promise<VoiceCatalog>;
  estimate(params: { script: string; resolution?: Resolution }): Promise<Estimate>;
  videos: {
    create(params: CreateVideoParams): Promise<Video>;
    retrieve(id: string): Promise<Video>;
    list(params?: { limit?: number; starting_after?: string; status?: VideoStatus }): Promise<VideoList>;
    waitForCompletion(id: string, options?: { intervalMs?: number; timeoutMs?: number }): Promise<Video>;
  };
  uploads: {
    create(params: { kind?: "image" | "audio"; content_type: string; size_bytes?: number }): Promise<Upload>;
    upload(data: BodyInit, options: { contentType: string; kind?: "image" | "audio" }): Promise<Upload>;
  };
  waitForCompletion(id: string, options?: { intervalMs?: number; timeoutMs?: number }): Promise<Video>;
  uploadFile(data: BodyInit, options: { contentType: string; kind?: "image" | "audio" }): Promise<Upload>;
}

export declare function verifyWebhookSignature(
  secret: string,
  header: string | null | undefined,
  body: string,
  toleranceSeconds?: number,
): boolean;

export default TalkPix;
