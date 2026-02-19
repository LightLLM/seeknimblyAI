# Seeknimbly HR — North America Compliance

HR compliance chat MVP: chat with an assistant for North America (NA/CA/US) using OpenAI, without exposing the API key in the browser.

## Tech stack

- Next.js 14 (App Router), React, TypeScript
- NextAuth (Credentials provider) for login; chat is protected
- Tailwind CSS
- OpenAI JS SDK (server-side only); Responses API with optional web search for compliance
- Zod (request validation)
- No database; transcript in `localStorage`; optional file logging under `/logs` in dev

## Run locally

1. **Clone / open the project** and install dependencies:

   ```bash
   npm install
   ```

2. **Environment**: Copy `.env.example` to `.env.local` and set your OpenAI key:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local`:

   ```
   OPENAI_API_KEY=sk-your-key-here
   OPENAI_MODEL=gpt-5
   NEXTAUTH_SECRET=your-random-secret-at-least-32-chars
   NEXTAUTH_URL=http://localhost:3000
   AUTH_EMAIL=admin@example.com
   AUTH_PASSWORD=your-password
   ```
   (Use `gpt-4o` or another model name if your account doesn’t have gpt-5. For login, set `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_EMAIL`, and `AUTH_PASSWORD`.)

3. **Start the dev server**:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000). **Sign in** with the email and password set in `AUTH_EMAIL` and `AUTH_PASSWORD`. Then use the jurisdiction dropdown (NA/CA/US), type a question, and send. Replies stream in with optional “Compliance reasoning” steps. Chat is persisted in `localStorage`; use **New chat** to clear. Use **Sign out** in the header to log out.

## Deploy on Vercel

1. **Environment variables**: In your Vercel project, set the same variables as in `.env.example` (e.g. `OPENAI_API_KEY`, `OPENAI_MODEL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_EMAIL`, `AUTH_PASSWORD`). For production, set `NEXTAUTH_URL` to your Vercel URL (e.g. `https://your-app.vercel.app`).
2. **Streaming**: The chat stream route uses `maxDuration = 60` (also set in `vercel.json`). If the stream returns no text (e.g. on Vercel), the route automatically retries with a non-streaming request and sends that response. If chat still shows “no response”, check **Vercel → Project → Settings → Environment Variables** for `OPENAI_API_KEY` and `OPENAI_MODEL` (e.g. `gpt-4o`) for Production, then redeploy. In **Deployments → Logs**, look for `[api/hr/stream]` to see whether the fallback ran or failed.
3. **File upload**: Request body is limited to ~4.5 MB on Vercel. The app limits uploads to **4 MB** per request. Keep files under 4 MB or upload one at a time.

## Chat API

- **UI** uses **POST `/api/hr/stream`**: streaming NDJSON (text deltas, steps, then a final `done` or `error`). Requests time out after 90 seconds.
- **POST `/api/hr`**: non-streaming JSON response `{ "text": "..." }`, useful for scripts and curl.

## Testing

### 1. HR compliance chat (in the browser)

1. Run `npm run dev` and open http://localhost:3000.
2. Sign in with `AUTH_EMAIL` / `AUTH_PASSWORD`.
3. Pick a jurisdiction (NA / CA / US), type a question (e.g. "What is minimum wage in Ontario?"), and send. You should see streaming text and optional "Compliance reasoning" steps. Try attaching a PDF or image.

### 2. HR stream from the command line

With the dev server running: `node scripts/test-stream.mjs`. To test production: `BASE_URL=https://seeknimblyai.vercel.app node scripts/test-stream.mjs`.

### 3. Recruitment agent (no UI yet)

The agent is at **POST `/api/agent/stream`**. Test with:

- **Script:** `node scripts/test-agent-stream.mjs` (dev server running).
- **curl:** `curl -N -X POST http://localhost:3000/api/agent/stream -H "Content-Type: application/json" -d "{\"message\": \"Find me 5 backend engineers in Toronto.\", \"params\": {\"job_title\": \"Backend Engineer\", \"location\": \"Toronto\"}}"`

Response is NDJSON: `{"type":"step",...}` then `{"type":"done","text":"..."}`. For MLOps workflows try: "I need Kubeflow and MLflow candidates in Toronto".

## Test `/api/hr` with curl

```bash
curl -X POST http://localhost:3000/api/hr \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"What are the main employment standards in Canada?\", \"jurisdiction\": \"CA\"}"
```

Expected: JSON with `{ "text": "..." }`. Each response should end with “Not legal advice.”

**Rate limit (20 requests per 10 minutes per IP):**

```bash
# Send 21+ requests quickly; the 21st should return 429
for i in $(seq 1 22); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/hr \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"test\", \"jurisdiction\": \"NA\"}"
done
```

## Common errors

| Situation | What you see | Fix |
|-----------|----------------|-----|
| Missing `OPENAI_API_KEY` | 500 + “Server configuration error: OpenAI API key not configured.” | Set `OPENAI_API_KEY` in `.env.local`. |
| Invalid or revoked key | 502 + “The assistant is temporarily unavailable…” | Check key in OpenAI dashboard, set correct `OPENAI_MODEL` (e.g. `gpt-4o`). |
| Rate limit | 429 + “Too many requests…” | Wait ~10 minutes or restart dev server to reset in-memory limiter. |
| Message too long | 400 from API or client warning | Keep message ≤ 8000 characters. |
| Wrong body shape | 400 with Zod message | Send JSON: `{ "message": "string", "jurisdiction": "NA" \| "CA" \| "US" }`. |
| Stream / API failure | Chat hangs or error bubble | Check server logs for `[api/hr/stream]` and the error message; verify `OPENAI_API_KEY` and `OPENAI_MODEL`. |
| Request timeout | “[Error] Request timed out…” | Stream is limited to 90s; try a shorter question or retry. |

## Project structure

```
app/
  page.tsx              # Auth gate: session → ChatPage, else LoginForm
  ChatPage.tsx          # Chat UI (jurisdiction, transcript, streaming, New chat)
  LoginForm.tsx         # Sign-in form (AUTH_EMAIL / AUTH_PASSWORD)
  providers.tsx        # SessionProvider
  layout.tsx
  globals.css
  api/
    auth/
      [...nextauth]/
        route.ts       # NextAuth Credentials
    hr/
      route.ts         # POST /api/hr (non-streaming JSON)
      stream/
        route.ts       # POST /api/hr/stream (streaming NDJSON, used by UI)
lib/
  rateLimit.ts         # In-memory rate limiter (per IP + route)
  prompts.ts            # System prompts per jurisdiction
  storage.ts            # localStorage helpers for transcript
.env.example
README.md
```

## Manual test plan

- [ ] **Setup**: `npm install`, copy `.env.example` → `.env.local`, set `OPENAI_API_KEY`, `NEXTAUTH_*`, `AUTH_EMAIL`, `AUTH_PASSWORD`, run `npm run dev`.
- [ ] **Auth**: Unauthenticated users see the login form; sign in with `AUTH_EMAIL`/`AUTH_PASSWORD` to reach the chat.
- [ ] **UI**: Header “Seeknimbly HR”; jurisdiction dropdown NA/CA/US (default NA); chat bubbles; input; Send; New chat; Sign out.
- [ ] **Send message**: Enter sends, Shift+Enter adds newline; loading “Thinking…” and optional “Compliance reasoning” steps; reply streams in and ends with “Not legal advice.”
- [ ] **Persistence**: Refresh page; same transcript still visible. Click “New chat”; transcript clears and does not reappear on refresh.
- [ ] **Errors**: Stop dev server or use invalid key; send message; friendly error bubble. Check terminal for `[api/hr/stream]` logs.
- [ ] **Long message**: Paste or type > 8000 chars; client shows warning and blocks send (or API returns 400 if client check bypassed).
- [ ] **Province/state**: Ask something like “What are the overtime rules?” without province/state; assistant asks for jurisdiction when relevant.
- [ ] **Legal disclaimer**: Ask “Is this legal advice?”; response includes “Not legal advice.”
- [ ] **Rate limit**: Send 21+ requests in a short time; 21st returns 429 and UI shows error.
- [ ] **curl**: `curl -X POST .../api/hr` with valid JSON returns `{ "text": "..." }`; missing key returns 500 with error message.

## Notes

- **DEP0169 / `url.parse()` deprecation**: You may see a Node warning: “DeprecationWarning: `url.parse()` behavior is not standardized… Use the WHATWG URL API instead.” This comes from dependencies (e.g. Next.js, next-auth’s openid-client), not from this app’s code. It does not affect chat or auth. To hide it: **locally** use `NODE_OPTIONS=--no-deprecation npm run dev` (PowerShell: `$env:NODE_OPTIONS="--no-deprecation"; npm run dev`); **on Vercel** add an environment variable `NODE_OPTIONS` = `--disable-warning=DEP0169` in Project → Settings → Environment Variables, then redeploy.
