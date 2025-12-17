const express = require('express')
const bodyParser = require('body-parser')
const helmet = require('helmet')
const { Client } = require('pg')

const app = express()
app.use(helmet())
app.use(bodyParser.json())

// Environment variables required:
// PG_CONNECTION_STRING - Postgres connection string for your Supabase DB (server-side)
// ADMIN_SECRET - a secret string to protect this endpoint

const PORT = process.env.PORT || 8787
const PG_CONNECTION_STRING = process.env.PG_CONNECTION_STRING
const ADMIN_SECRET = process.env.ADMIN_SECRET

if (!PG_CONNECTION_STRING) {
  console.warn('Warning: PG_CONNECTION_STRING not set. Server will start but cannot execute SQL until configured.')
}
if (!ADMIN_SECRET) {
  console.warn('Warning: ADMIN_SECRET not set. Requests will be rejected until configured.')
}

function sanitizeIdentifier(input) {
  if (!input) return 'the_users_mail'
  return String(input).toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

app.post('/create-table', async (req, res) => {
  const headerSecret = req.get('x-admin-secret') || ''
  if (!ADMIN_SECRET || headerSecret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden: invalid admin secret' })
  }

  const { email } = req.body || {}
  const base = sanitizeIdentifier(email)
  const tableName = `${base}_flashcards`

  const createSql = `CREATE TABLE IF NOT EXISTS ${tableName} (
  id serial PRIMARY KEY,
  front text,
  back text,
  created_at timestamptz DEFAULT now()
);`

  if (!PG_CONNECTION_STRING) {
    return res.status(500).json({ error: 'Server not configured with PG_CONNECTION_STRING' })
  }

  const client = new Client({ connectionString: PG_CONNECTION_STRING })
  try {
    await client.connect()
    await client.query(createSql)
    await client.end()
    return res.json({ ok: true, table: tableName })
  } catch (err) {
    console.error('SQL error:', err)
    try { await client.end() } catch(e){}
    return res.status(500).json({ error: err.message || String(err) })
  }
})

app.get('/health', (req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
