# NovaBot Worker — Cloudflare Workers AI

Tiny Cloudflare Worker that powers the Nova Claw chat widget on novactrl.ai.

- Uses **Workers AI** (free tier, 10,000 requests/day on Llama 3.1 8B Instruct).
- No external API keys, no Anthropic / Gemini / OpenAI account needed.
- ~80 lines, single file: [`worker.js`](./worker.js).

---

## Deploy (5 minutes, no CLI)

1. Open [dash.cloudflare.com](https://dash.cloudflare.com). Sign up if you don't have an account — it's free.

2. Left sidebar → **Workers & Pages** → **Create** → **Hello World**.

3. Name the worker `novabot` and click **Deploy**.

4. After it deploys, click **Edit Code**. Delete the placeholder code and paste the entire contents of [`worker.js`](./worker.js). Click **Save and Deploy**.

5. Back on the worker overview page → **Settings** → **Bindings** → **+ Add** → **Workers AI**.
   - Variable name: `AI` (must be exactly this — uppercase).
   - Save.

6. **Settings** → **Triggers** — note your worker URL. It will look like:
   ```
   https://novabot.<your-subdomain>.workers.dev
   ```

7. Open every HTML page in the NovaCTRL repo (root + `posts/`). Find this line in the footer script:
   ```js
   window.NOVABOT_WORKER_URL = '';
   ```
   Paste your worker URL inside the quotes:
   ```js
   window.NOVABOT_WORKER_URL = 'https://novabot.<your-subdomain>.workers.dev';
   ```

8. Commit, push to GitHub, wait ~30 seconds for Pages to rebuild, hard-refresh novactrl.ai, click the bottom-right Nova Claw button, say hi.

---

## How it works

- The widget on every page (`js/novabot.js`) builds a floating button + chat panel.
- When a user sends a message, the widget POSTs `{ messages: [...] }` to your worker.
- The worker prepends the Nova Claw system prompt and calls `env.AI.run('@cf/meta/llama-3.1-8b-instruct', ...)`.
- Cloudflare returns the model's response; the worker returns `{ reply: "..." }` with CORS headers.

---

## Swap the model

Inside `worker.js`, line ~85:
```js
const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { ... });
```

Other free Workers AI chat models worth trying:
- `@cf/meta/llama-3.1-70b-instruct` — bigger, slower, better answers (still free tier)
- `@cf/qwen/qwen1.5-14b-chat-awq` — solid alternative
- `@cf/mistral/mistral-7b-instruct-v0.2` — fast, lightweight

Full catalog: [developers.cloudflare.com/workers-ai/models](https://developers.cloudflare.com/workers-ai/models/).

---

## Tighten CORS later (optional)

Inside `worker.js`, replace:
```js
'Access-Control-Allow-Origin': '*',
```
with:
```js
'Access-Control-Allow-Origin': 'https://novactrl.ai',
```

This stops other domains from using your worker quota.

---

## Monitor usage

In the Cloudflare dashboard → your worker → **Metrics**. You'll see request count, error rate, p50/p99 latency. The free tier resets daily; if you ever hit the cap, Cloudflare just returns errors (no surprise bill).
