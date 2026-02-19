# Seeknimbly HR — North America Compliance

HR compliance chat MVP: chat with an assistant for North America (NA/CA/US) using OpenAI, without exposing the API key in the browser.

## Tech stack

- Next.js 14 (App Router), React, TypeScript
- Tailwind CSS
- OpenAI JS SDK (server-side only)
- Zod (request validation)
- No database; optional file logging under `/logs` in dev

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

4. Open [http://localhost:3000](http://localhost:3000). **Sign in** with the email and password set in `AUTH_EMAIL` and `AUTH_PASSWORD`. Then use the jurisdiction dropdown (NA/CA/US), type a question, and send. Chat is persisted in `localStorage`; use **New chat** to clear. Use **Sign out** in the header to log out.

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

## Project structure

```
app/
  page.tsx           # Chat UI (jurisdiction, transcript, input, New chat)
  layout.tsx
  globals.css
  api/
    hr/
      route.ts       # POST /api/hr (Zod, OpenAI, rate limit, logging)
lib/
  rateLimit.ts       # In-memory rate limiter (per IP + route)
  prompts.ts         # System prompts per jurisdiction
  storage.ts         # localStorage helpers for transcript
.env.example
README.md
```

## Manual test plan

- [ ] **Setup**: `npm install`, copy `.env.example` → `.env.local`, set `OPENAI_API_KEY`, run `npm run dev`.
- [ ] **UI**: Page title “Seeknimbly HR — North America Compliance”; jurisdiction dropdown NA/CA/US (default NA); chat bubbles; input; Send; New chat.
- [ ] **Send message**: Enter sends, Shift+Enter adds newline; loading “Thinking…” appears; assistant reply appears and ends with “Not legal advice.”
- [ ] **Persistence**: Refresh page; same transcript still visible. Click “New chat”; transcript clears and does not reappear on refresh.
- [ ] **Errors**: Stop dev server or use invalid key; send message; friendly error bubble (e.g. “The assistant is temporarily unavailable…”).
- [ ] **Long message**: Paste or type > 8000 chars; client shows warning and blocks send (or API returns 400 if client check bypassed).
- [ ] **Province/state**: Ask something like “What are the overtime rules?” without province/state; assistant asks for jurisdiction when relevant.
- [ ] **Legal disclaimer**: Ask “Is this legal advice?”; response includes “Not legal advice.”
- [ ] **Rate limit**: Send 21+ requests in a short time; 21st returns 429 and UI shows error.
- [ ] **curl**: `curl -X POST .../api/hr` with valid JSON returns `{ "text": "..." }`; missing key returns 500 with error message.
