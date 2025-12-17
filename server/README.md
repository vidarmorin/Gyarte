Server to securely run CREATE TABLE for a user's flashcards

Overview

This small Express server runs SQL against your Supabase Postgres instance. It is intentionally simple and requires server-side configuration so you do NOT expose privileged keys in the browser.

Security notes

- You MUST run this server in a controlled environment — local machine, private server, or protected serverless function.
- The server requires two environment variables:
  - `PG_CONNECTION_STRING` — the Postgres connection string for your Supabase database (found in Supabase project -> Settings -> Database -> Connection string).
  - `ADMIN_SECRET` — an arbitrary secret string. Calls to `/create-table` must include this secret in the `x-admin-secret` header.

Endpoints

- POST /create-table
  - Body: `{ "email": "user@example.com" }`
  - Headers: `x-admin-secret: <ADMIN_SECRET>`
  - Response: `{ ok: true, table: "user_example_com_flashcards" }` on success

- GET /health
  - Returns `{ ok: true }`

Run locally

1. Install dependencies

```powershell
cd server
npm install
```

2. Start the server (example using PowerShell)

```powershell
$env:PG_CONNECTION_STRING = 'postgres://postgres:...@dbhost:5432/postgres'
$env:ADMIN_SECRET = 'choose-a-strong-secret'
node index.js
```

3. Create a table for a user (example with curl)

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: choose-a-strong-secret" \
  -d '{"email":"user@example.com"}' \
  http://localhost:8787/create-table
```

What this does

- Sanitizes the provided email (lowercase, non-alphanumerics replaced with underscores)
- Creates a table named `<sanitized_email>_flashcards` with columns `id`, `front`, `back`, and `created_at`.

Why this is safer

- The privileged DB credentials stay on the server-side (in `PG_CONNECTION_STRING`) and are never embedded in the client or browser.
- The `ADMIN_SECRET` prevents casual unauthenticated access to this endpoint. Do not put this secret in public client code.

Next steps / integration ideas

- Deploy this as a small serverless function behind an authenticated gateway.
- Add logging and rate-limiting.
- Add a simple admin UI (protected) that calls this endpoint for convenience.
