import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import OpenAI from 'openai'
import './Flashcards.css'

export default function Chat({ onClose, onNavigate }) {
  const [userEmail, setUserEmail] = useState('')
  const [languages, setLanguages] = useState([])
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [mode, setMode] = useState('passive')
  const [messages, setMessages] = useState([]) // UI messages only
  const [lastAssistantSemantic, setLastAssistantSemantic] = useState('') // clean memory
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // Load user email
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email || '')
    })
  }, [])

  // Load languages from Supabase
  useEffect(() => {
    if (!userEmail) return

    const fetchLanguages = async () => {
      try {
        const { data, error } = await supabase
          .from('Users')
          .select('Flashcards')
          .eq('User', userEmail)
          .maybeSingle()

        if (error) throw error

        const flashData = data?.Flashcards ? JSON.parse(data.Flashcards) : {}
        const uniqueLanguages = Object.keys(flashData)

        setLanguages(uniqueLanguages)
      } catch (err) {
        console.error('Error fetching languages:', err)
      }
    }

    fetchLanguages()
  }, [userEmail])

  // AI CALL
  async function sendChatMessage(userMessage) {
    const client = new OpenAI({
      apiKey: 'ollama',
      baseURL: 'http://10.22.1.100:11434/v1',
      dangerouslyAllowBrowser: true,
    })

    const systemPrompt = `
You are a friendly language tutor.

Target language: ${selectedLanguage}
Mode: ${mode}

GENERAL RULES:
- Detect the user's level automatically (A1–C1).
- Reply ONLY in ${selectedLanguage}, except for explanations which will be in English.
- Correct mistakes gently.
- Give a short explanation in simple English.
- Keep responses short and supportive (1–3 sentences).

ACTIVE MODE RULES (mode = "active"):
- You MUST ALWAYS include a follow-up question in the "follow_up" field.
- The follow-up question MUST:
  • Be directly related to what the user just said  
  • Expand the topic (ask for details, reasons, preferences, experiences, or opinions)  
  • NOT be generic (no “How are you?”, “How is your day?”, etc.)  
  • NOT repeat any previous question  
  • NOT only compliment the user  
  • Move the conversation forward in a meaningful way  

ALLOWED QUESTION TYPES:
- Detail question
- Preference question
- Experience question
- Opinion question
- Future question

FORBIDDEN QUESTION TYPES:
- Any variation of “How are you?”
- Any question already asked in this conversation
- Any question unrelated to the user’s last message

PASSIVE MODE RULES (mode = "passive"):
- Do NOT ask follow-up questions unless the user explicitly asks something.
- In passive mode, set "follow_up" to an empty string.

UNIVERSAL EXAMPLES:
User says: “I feel good today.”
Good follow-up: “What made you feel good today?”

User says: “I ate something delicious.”
Good follow-up: “What did you eat exactly?”

Respond ONLY in this JSON format:

{
  "reply": "your response in ${selectedLanguage}",
  "explanation": "short explanation in english",
  "level": "A1/A2/B1/B2/C1",
  "follow_up": "a topic-related follow-up question in ${selectedLanguage}, or empty string in passive mode"
}
`

    const history = []

    if (lastAssistantSemantic) {
      history.push({
        role: "assistant",
        content: lastAssistantSemantic
      })
    }

    const response = await client.chat.completions.create({
      model: 'gemma3:12b',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage }
      ]
    })

    const raw = response.choices?.[0]?.message?.content || ''
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}') + 1
    const json = raw.substring(start, end)

    try {
      const parsed = JSON.parse(json)
      return {
        reply: parsed.reply || "",
        explanation: parsed.explanation || "",
        level: parsed.level || "A1",
        follow_up: parsed.follow_up || ""
      }
    } catch {
      return {
        reply: 'Jag kunde inte tolka svaret.',
        explanation: '',
        level: 'A1',
        follow_up: ''
      }
    }
  }

  async function handleSend() {
    if (!input.trim() || !selectedLanguage) return

    const userMsg = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const ai = await sendChatMessage(userMsg.content)

    // Store semantic content for next turn
    setLastAssistantSemantic(ai.reply + (ai.follow_up ? " " + ai.follow_up : ""))

    const aiMsg = {
      role: 'assistant',
      content: ai.reply,
      follow_up: ai.follow_up,
      explanation: ai.explanation,
      level: ai.level
    }

    setMessages(prev => [...prev, aiMsg])
    setLoading(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault()
      handleSend()
    }
  }

  // Save clicked word as flashcard (duplicate‑safe)
  async function saveWordAsFlashcard(rawWord) {
    if (!selectedLanguage || !userEmail) return

    const word = rawWord
      .toLowerCase()
      .replace(/[.,!?;:()"]/g, '')
      .trim()

    if (!word) return

    try {
      const { data, error } = await supabase
        .from('Users')
        .select('Flashcards')
        .eq('User', userEmail)
        .maybeSingle()

      if (error) throw error

      let allFlash = data?.Flashcards ? JSON.parse(data.Flashcards) : {}
      if (!allFlash[selectedLanguage]) allFlash[selectedLanguage] = {}

      const existingWords = Object.keys(allFlash[selectedLanguage]).map(w =>
        w.toLowerCase()
      )

      if (existingWords.includes(word)) {
        alert(`"${rawWord}" is already saved.`)
        return
      }

      const client = new OpenAI({
        apiKey: 'ollama',
        baseURL: 'http://10.22.1.100:11434/v1',
        dangerouslyAllowBrowser: true,
      })

      const translationResponse = await client.chat.completions.create({
        model: 'gemma3:12b',
        messages: [
          {
            role: 'system',
            content: `Translate the following ${selectedLanguage} word into English. Respond ONLY with the translation.`
          },
          { role: 'user', content: word }
        ]
      })

      const translation = translationResponse.choices?.[0]?.message?.content
        ?.trim()
        ?.replace(/[.,!?;:()"]/g, '') || ''

      if (!translation) {
        alert('Could not translate the word.')
        return
      }

      const existingTranslations = Object.values(allFlash[selectedLanguage]).map(t =>
        t.toLowerCase()
      )

      if (existingTranslations.includes(translation.toLowerCase())) {
        alert(`A flashcard with the translation "${translation}" already exists.`)
        return
      }

      allFlash[selectedLanguage][word] = translation

      const { error: updateError } = await supabase
        .from('Users')
        .upsert(
          { User: userEmail, Flashcards: JSON.stringify(allFlash) },
          { onConflict: 'User' }
        )

      if (updateError) throw updateError

      alert(`Saved "${word}" → "${translation}"`)
    } catch (err) {
      console.error(err)
      alert('Error saving flashcard.')
    }
  }

  function renderWordButtons(text) {
    return text.split(' ').map((word, i) => (
      <button
        key={i}
        onClick={() => saveWordAsFlashcard(word)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          marginRight: 6,
          cursor: 'pointer',
          color: '#0077cc',
          textDecoration: 'underline',
          fontSize: '1em'
        }}
        title="Save as flashcard"
      >
        {word}
      </button>
    ))
  }

  return (
    <div className="flashcards-page page">
      <header className="header">
        <div className="header-top">
          <h1>LoquorAI</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="logout-button"
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/'
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <nav className="nav">
          <ul>
            <li><a href="#home" onClick={(e) => { e.preventDefault(); onClose ? onClose() : (window.location.href = '/'); }}>Home</a></li>
            <li><a href="#fillintheblank" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('fillintheblank'); }}>Alphabets</a></li>
            <li><a href="#flashcards" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('flashcards'); }}>Flashcards</a></li>
            <li><a href="#alphabets">Chat</a></li>
            <li><a href="#chat" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('chat'); }}>Generate Flashcards</a></li>
          </ul>
        </nav>
      </header>

      <main className="container">
        <h2>Language Chat</h2>
        <p>Select a language and mode to begin. Click words in AI replies to save them as flashcards.</p>

        {/* LANGUAGE SELECTOR */}
        <div style={{ marginBottom: 20 }}>
          <label><strong>Select Language:</strong></label>
          <select
            className="cta-button"
            style={{ background: 'white', color: 'black' }}
            value={selectedLanguage}
            onChange={(e) => {
              setSelectedLanguage(e.target.value)
              setMessages([])
              setLastAssistantSemantic('')
            }}
          >
            <option value="">Choose a language…</option>
            {languages.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>

        {/* MODE SELECTOR */}
        <div style={{ marginBottom: 20 }}>
          <label><strong>Mode:</strong></label>
          <select
            className="cta-button"
            style={{ background: 'white', color: 'black' }}
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="passive">Passive (respond only)</option>
            <option value="active">Active (AI asks questions)</option>
          </select>
        </div>

        {selectedLanguage && (
          <>
            <div className="feature-card" style={{ maxHeight: 300, overflowY: 'auto', marginTop: 20 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <strong>{m.role === 'user' ? 'You:' : 'AI:'}</strong>

                  <p>{renderWordButtons(m.content)}</p>

                  {m.follow_up && (
                    <p style={{ fontStyle: 'italic', marginTop: 4 }}>
                      {renderWordButtons(m.follow_up)}
                    </p>
                  )}

                  {m.explanation && m.role === 'assistant' && (
                    <small style={{ color: '#666' }}>
                      Explanation: {m.explanation} (Level: {m.level})
                    </small>
                  )}
                </div>
              ))}

              {loading && <p><em>AI is thinking…</em></p>}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                className="cta-button"
                style={{
                  flex: 1,
                  background: 'white',
                  color: 'black',
                  border: '1px solid #ccc'
                }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message…"
              />
              <button className="cta-button" onClick={handleSend} disabled={loading}>
                Send
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
