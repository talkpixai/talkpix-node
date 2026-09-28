# TalkPix Node.js client

Official Node.js client for the [TalkPix](https://www.talkpix.ai) API. Send one portrait photo plus a script (or an audio file) and get back a lip-synced talking video as an MP4.

- Zero dependencies, Node.js 18+ (uses the built-in `fetch`)
- Typed (`index.d.ts` included)
- Webhook signature verification built in

Full API reference: [talkpix.ai/developers](https://www.talkpix.ai/developers)

## Install

```bash
npm install talkpix
```

## Quick start

Create an API key in your account at [talkpix.ai/account/api](https://www.talkpix.ai/account/api) and keep it on your server.

```js
import TalkPix from "talkpix";

const talkpix = new TalkPix({ apiKey: process.env.TALKPIX_API_KEY });

const video = await talkpix.videos.create({
  image_url: "https://example.com/portrait.jpg",
  script: "Hi! This video was made with one API call.",
  voice: "zephyr",
  language: "en-US",
});

const done = await talkpix.videos.waitForCompletion(video.id);
console.log(done.status, done.video_url);
```

## Check the cost first

`estimate` is free and tells you how many credits a script will reserve before anything renders:

```js
const estimate = await talkpix.estimate({ script: "Happy birthday, Sam!", resolution: "720p" });
// { estimated_seconds, credits, max_seconds, words, ... }

const account = await talkpix.me();
console.log(account.credits.balance);
```

Credits are reserved when a render starts and reconciled to the rendered length when it finishes. A failed render returns its credits automatically.

## Use your own audio

Swap the script for a recording. The photo lip-syncs to your voice:

```js
const video = await talkpix.videos.create({
  image_url: "https://example.com/portrait.jpg",
  audio_url: "https://example.com/message.mp3",
});
```

## Upload local files

If your photo or audio isn't at a public URL, upload it first and pass the returned `key`:

```js
import { readFile } from "node:fs/promises";

const photo = await talkpix.uploadFile(await readFile("portrait.jpg"), { contentType: "image/jpeg" });

const video = await talkpix.videos.create({
  image_key: photo.key,
  script: "This photo was uploaded straight from my server.",
  voice: "zephyr",
  language: "en-US",
});
```

## Voices and languages

```js
const { voices, languages } = await talkpix.voices();
```

Each voice has a `sample_url` so you can listen before you pick one.

## Webhooks

Pass `webhook_url` to get a signed `video.completed` or `video.failed` event instead of polling. Verify it against the raw body with the webhook secret from your account:

```js
import { verifyWebhookSignature } from "talkpix";

app.post("/hooks/talkpix", express.raw({ type: "application/json" }), (req, res) => {
  const ok = verifyWebhookSignature(
    process.env.TALKPIX_WEBHOOK_SECRET,
    req.get("TalkPix-Signature"),
    req.body.toString("utf8"),
  );
  if (!ok) return res.sendStatus(400);
  const event = JSON.parse(req.body);
  // event.type === "video.completed" → event.data.video_url
  res.sendStatus(200);
});
```

## List renders

```js
const page = await talkpix.videos.list({ limit: 20, status: "completed" });
if (page.has_more) {
  const next = await talkpix.videos.list({ starting_after: page.next_starting_after });
}
```

## Errors

Every API error is thrown as a `TalkPixError` with `status`, `type` and, for validation errors, the `param` that failed:

```js
import { TalkPixError } from "talkpix";

try {
  await talkpix.videos.create({ image_url: "https://example.com/portrait.jpg" });
} catch (error) {
  if (error instanceof TalkPixError) {
    console.error(error.status, error.type, error.param, error.message);
  }
}
```

If a render is refused because the balance can't cover it, add credits at [talkpix.ai/pricing](https://www.talkpix.ai/pricing).

## Pricing

API renders use the same credit wallet and rates as the web app. Credits come in one-time packs from $5, never expire, and no subscription is required.

## License

MIT
