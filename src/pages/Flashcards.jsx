import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import OpenAI from 'openai'
import './Flashcards.css'

export default function Flashcards({ onClose, onNavigate }) {
  const [cards, setCards] = useState([])
  const [idx, setIdx] = useState(0)
  const [showingPrimary, setShowingPrimary] = useState(true)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [order, setOrder] = useState('front')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [sqlSnippet, setSqlSnippet] = useState('')
  const [showServerModal, setShowServerModal] = useState(false)
  const [serverUrl, setServerUrl] = useState('http://localhost:8787')
  const [adminSecretInput, setAdminSecretInput] = useState('')
  const [serverResponse, setServerResponse] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResponse, setAiResponse] = useState('')
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizSentence, setQuizSentence] = useState('')
  const [quizOptions, setQuizOptions] = useState([])
  const [correctIndex, setCorrectIndex] = useState(-1)
  const [quizTranslation, setQuizTranslation] = useState('')
  const [quizFeedback, setQuizFeedback] = useState('')
  const [languages, setLanguages] = useState([])
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [languagesFetched, setLanguagesFetched] = useState(false)

  useEffect(() => {
    // fetch session to display user email
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email || '')
    })
  }, [])

  const fetchAndShow = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('NyFlashcard')
        .select('Language')
      if (error) throw error
      const allLanguages = (data || []).map(item => item.Language).filter(Boolean)
      console.log('All languages in NyFlashcard table:', allLanguages)
      const uniqueLanguages = [...new Set(allLanguages)]
      setLanguages(uniqueLanguages)
      setLanguagesFetched(true)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const loadLanguageCards = async (language) => {
    if (!language) return
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('NyFlashcard')
        .select('data')
        .eq('Language', language)
        .single()
      if (error) throw error
      
      const dict = JSON.parse(data.data)
      const mapped = Object.entries(dict).map(([word, translation], index) => ({
        id: index + 1,
        front: translation,
        back: word
      }))
      setCards(mapped)
      setIdx(0)
      setShowingPrimary(true)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    setError('')
    if (!selectedLanguage) return setError('Please select a language first.')
    if (!front.trim() || !back.trim()) return setError('Enter both front and back.')
    setLoading(true)
    try {
      // Fetch current data
      const { data: currentData, error: fetchError } = await supabase
        .from('NyFlashcard')
        .select('data')
        .eq('Language', selectedLanguage)
        .single()
      if (fetchError) throw fetchError

      const dict = JSON.parse(currentData.data)
      // Add new entry: back (word) : front (translation)
      dict[back.trim()] = front.trim()

      // Update the row
      const { error: updateError } = await supabase
        .from('NyFlashcard')
        .update({ data: JSON.stringify(dict) })
        .eq('Language', selectedLanguage)
      if (updateError) throw updateError

      setFront('')
      setBack('')
      // Reload the cards
      await loadLanguageCards(selectedLanguage)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const sanitize = (email) => {
    return (email || 'the_users_mail').toLowerCase().replace(/[^a-z0-9]+/g, '_')
  }

  const generateCreateTableSQL = () => {
    const base = sanitize(userEmail)
    const tableName = `${base}_flashcards`
    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (
  id serial PRIMARY KEY,
  front text,
  back text,
  created_at timestamptz DEFAULT now()
);`
    setSqlSnippet(sql)
    return sql
  }

  const copyCreateTableSQL = async () => {
    const sql = sqlSnippet || generateCreateTableSQL()
    try {
      await navigator.clipboard.writeText(sql)
      setError('SQL copied to clipboard. Run it in Supabase SQL editor (service role key required for remote execution).')
    } catch (err) {
      setError('Could not copy SQL to clipboard. Here is the SQL:')
    }
  }

  const callCreateTableOnServer = async (url, secret) => {
    setServerResponse('')
    if (!url) return setServerResponse('Server URL required')
    try {
      const res = await fetch(url.replace(/\/$/, '') + '/create-table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret || '',
        },
        body: JSON.stringify({ email: userEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        setServerResponse(data.error || JSON.stringify(data))
      } else {
        setServerResponse(`Table created: ${data.table || 'unknown'}`)
      }
    } catch (err) {
      setServerResponse(err.message || String(err))
    } finally {
      // clear secret from memory
      setAdminSecretInput('')
    }
  }

  const renderText = () => {
    if (!cards.length) return 'No flashcards yet'
    const c = cards[idx]
    const primary = order === 'front' ? c.front : c.back
    const secondary = order === 'front' ? c.back : c.front
    return showingPrimary ? primary : secondary
  }

  const toggleFlip = () => setShowingPrimary((s) => !s)
  const prev = () => {
    if (!cards.length) return
    setIdx((i) => (i - 1 + cards.length) % cards.length)
    setShowingPrimary(true)
  }
  const next = () => {
    if (!cards.length) return
    setIdx((i) => (i + 1) % cards.length)
    setShowingPrimary(true)
  }

  const callOllamaAI = async () => {
    setAiLoading(true)
    setAiResponse('')
    try {
      const client = new OpenAI({
        apiKey: 'ollama',
        baseURL: 'http://10.22.1.100:11434/v1',
        dangerouslyAllowBrowser: true,
      })

      const response = await client.chat.completions.create({
        model: 'gemma3:12b',
        messages: [
          {
            role: 'user',
            content: 'what is 1+1?',
          },
        ],
      })

      const answer = response.choices?.[0]?.message?.content || 'No response from AI'
      setAiResponse(answer)
    } catch (err) {
      setAiResponse(`Error: ${err.message || String(err)}`)
    } finally {
      setAiLoading(false)
    }
  }

  const generateQuiz = async () => {
    if (!selectedLanguage) {
      setQuizFeedback('Please select a language first.')
      return
    }
    if (!cards.length) {
      setQuizFeedback('No flashcards available for this language.')
      return
    }

    setQuizLoading(true)
    setQuizFeedback('')
    setQuizSentence('')
    setQuizOptions([])
    setCorrectIndex(-1)
    setQuizTranslation('')

    try {
      // Pick a random card and use the BACK (answer/word) field
      const randomCard = cards[Math.floor(Math.random() * cards.length)]
      const word = randomCard.back // Use the back field - the word

      const client = new OpenAI({
        apiKey: 'ollama',
        baseURL: 'http://10.22.1.100:11434/v1',
        dangerouslyAllowBrowser: true,
      })

      const response = await client.chat.completions.create({
        model: 'gemma3:12b',
        messages: [
          {
            role: 'user',
            content: `IMPORTANT: You are creating a ${selectedLanguage} multiple-choice quiz. Follow these STRICT rules:
1. Create ONLY ONE complete ${selectedLanguage} sentence with a blank
2. The sentence MUST use the EXACT ${selectedLanguage} word "${word}" - do NOT use related forms, synonyms, or different conjugations
3. This word comes from a ${selectedLanguage} flashcard vocabulary list and must be used exactly as written
4. The word MUST appear exactly ONCE in the sentence
5. Replace ONLY "${word}" with _____ (five underscores)
6. Do NOT translate or use any non-${selectedLanguage} words
7. Generate TWO incorrect ${selectedLanguage} sentences that are similar but wrong (e.g., wrong word choice, conjugation, or structure)
8. Provide an ENGLISH translation of the correct full ${selectedLanguage} sentence
9. Output format: [sentence with _____] | [correct full sentence] | [incorrect option 1] | [incorrect option 2] | [English translation]
10. There MUST be exactly four | separators (five parts total)
11. All ${selectedLanguage} options must be complete ${selectedLanguage} sentences

The ${selectedLanguage} word from flashcards to use: "${word}"

Create the quiz now. Remember: use the exact word "${word}" as given, keep everything in ${selectedLanguage} except the final English translation.`,
          },
        ],
      })

      const aiText = response.choices?.[0]?.message?.content || ''
      const parts = aiText.split('|').map(p => p.trim())
      
      if (parts.length >= 5) {
        const sentence = parts[0].trim().toLowerCase()
        const correct = parts[1].trim().toLowerCase()
        const incorrect1 = parts[2].trim().toLowerCase()
        const incorrect2 = parts[3].trim().toLowerCase()
        const englishTranslation = parts[4].trim()
        
        // Verify that there's actually a blank in the sentence
        if (sentence.includes('_____') && correct.toLowerCase().includes(word.toLowerCase())) {
          // Create options array and shuffle
          const options = [correct, incorrect1, incorrect2]
          const shuffled = options.sort(() => Math.random() - 0.5)
          const correctIdx = shuffled.indexOf(correct)
          
          setQuizSentence(sentence)
          setQuizOptions(shuffled)
          setCorrectIndex(correctIdx)
          setQuizTranslation(englishTranslation)
        } else {
          setQuizFeedback('Error: Generated quiz is invalid. Please try again.')
        }
      } else {
        setQuizFeedback('Error generating quiz. Please try again.')
      }
    } catch (err) {
      setQuizFeedback(`Error: ${err.message || String(err)}`)
    } finally {
      setQuizLoading(false)
    }
  }

  const checkQuizOption = (selectedIndex) => {
    if (selectedIndex === correctIndex) {
      setQuizFeedback(`Correct! Translation: ${quizTranslation}`)
    } else {
      setQuizFeedback(`Wrong. The correct answer is: ${quizOptions[correctIndex]}`)
    }
  }

  return (
    <div className="flashcards-page page">
      <header className="header">
        <div className="header-top">
          <h1>Welcome to My React App</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="logout-button" onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }}>Logout</button>
          </div>
        </div>
        <nav className="nav">
          <ul>
            <li><a href="#home" onClick={(e) => { e.preventDefault(); onClose ? onClose() : (window.location.href = '/'); }}>Home</a></li>
            <li><a href="#fillintheblank" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('fillintheblank'); }}>Fill in the Blank</a></li>
            <li><a href="#flashcards">Flashcards</a></li>
            <li><a href="#chat" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('chat'); }}>Chat</a></li>
          </ul>
        </nav>
      </header>

      <main className="container flash-container">
        <section className="left-col">
          <div className="card add-card">
            <h2>Welcome to My React App</h2>

            {languagesFetched && (
              <div style={{ marginBottom: 20 }}>
                <label className="label">Available Languages:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {languages.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setSelectedLanguage(lang)
                        loadLanguageCards(lang)
                      }}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: selectedLanguage === lang ? '#4CAF50' : '#2b6cff',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="add-form">
              <label className="label">Front (translation)</label>
              <input id="front-input" type="text" placeholder="e.g. the boy" value={front} onChange={(e) => setFront(e.target.value)} />

              <label className="label">Back (word)</label>
              <input id="back-input" type="text" placeholder="e.g. puer" value={back} onChange={(e) => setBack(e.target.value)} />

              <div className="add-actions">
                <button className="primary" onClick={handleAdd} disabled={loading}>{loading ? 'Adding…' : 'Add'}</button>
                <button onClick={fetchAndShow} disabled={loading}>{loading ? 'Loading…' : 'Fetch'}</button>
              </div>

              {error && <div className="error">{error}</div>}

              {aiResponse && (
                <div className="ai-response" style={{ marginTop: 12, padding: 12, backgroundColor: '#f0f8ff', border: '1px solid #2b6cff', borderRadius: 4, color: '#333' }}>
                  <strong>AI Response:</strong>
                  <p style={{ marginTop: 8, margin: '8px 0 0 0', whiteSpace: 'pre-wrap' }}>{aiResponse}</p>
                </div>
              )}

              {showServerModal && (
                <div className="modal-overlay">
                  <div className="modal">
                    <h3>Create table on server</h3>
                    <p style={{ color: '#666' }}>Enter the server URL and admin secret. The secret is sent only for this request and then cleared.</p>
                    <label className="label">Server URL</label>
                    <input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
                    <label className="label">Admin secret</label>
                    <input value={adminSecretInput} onChange={(e) => setAdminSecretInput(e.target.value)} type="password" />
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="primary" onClick={async () => { await callCreateTableOnServer(serverUrl, adminSecretInput) }}>
                        Run
                      </button>
                      <button onClick={() => { setShowServerModal(false); setAdminSecretInput(''); setServerResponse('') }}>Cancel</button>
                    </div>
                    {serverResponse && <div style={{ marginTop: 12, color: serverResponse.startsWith('Table created') ? 'green' : '#c33' }}>{serverResponse}</div>}
                  </div>
                </div>
              )}

              {sqlSnippet && (
                <div className="sql-snippet">
                  <label className="label">CREATE TABLE SQL</label>
                  <textarea readOnly rows={6} value={sqlSnippet} style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }} />
                  <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
                    This SQL will create a table named after your email (sanitized). Run it in the Supabase SQL editor or via an admin/service role key.
                  </div>
                </div>
              )}

              <div className="display-options">
                <label>
                  <input type="radio" name="display-order" value="front" checked={order === 'front'} onChange={() => setOrder('front')} /> Show Question First
                </label>
                <label>
                  <input type="radio" name="display-order" value="back" checked={order === 'back'} onChange={() => setOrder('back')} /> Show Answer First
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="right-col">
          <div className="flashcard-panel">
            <button className="nav-btn" onClick={prev}>&lt; Prev</button>
            <button className={`flashcard-btn ${showingPrimary ? 'question' : 'answer'}`} aria-pressed={!showingPrimary} onClick={toggleFlip}>
              {renderText()}
            </button>
            <button className="nav-btn" onClick={next}>Next &gt;</button>
          </div>

          <div className="hint">Tip: click the card to flip it. Use Prev/Next to browse.</div>

          <div style={{ marginTop: 24 }}>
            <button onClick={generateQuiz} disabled={quizLoading || !cards.length} style={{ width: '100%', padding: 10, backgroundColor: '#2b6cff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
              {quizLoading ? 'Generating Quiz…' : `Generate ${selectedLanguage || 'Language'} Quiz`}
            </button>
          </div>

          {quizSentence && (
            <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f0f8ff', border: '1px solid #2b6cff', borderRadius: 4 }}>
              <label className="label">Complete the sentence in Latin:</label>
              <p style={{ fontSize: 16, marginBottom: 12, marginTop: 8 }}>{quizSentence}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {quizOptions.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => checkQuizOption(index)}
                    style={{
                      padding: 10,
                      backgroundColor: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 14,
                      textAlign: 'left',
                      whiteSpace: 'pre-wrap'
                    }}
                    disabled={quizFeedback !== ''}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {quizFeedback && (
                <div style={{ marginTop: 12, fontSize: 16, fontWeight: 'bold', color: quizFeedback.startsWith('Correct!') ? 'green' : '#c33' }}>
                  {quizFeedback}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
