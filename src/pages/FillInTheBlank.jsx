import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import OpenAI from 'openai'
import './Flashcards.css'

export default function FillInTheBlank({ onClose, onNavigate }) {
  const [cards, setCards] = useState([])
  const [userEmail, setUserEmail] = useState('')
  const [alphabets, setAlphabets] = useState([])
  const [selectedAlphabet, setSelectedAlphabet] = useState('')
  const [newAlphabetInput, setNewAlphabetInput] = useState('')
  const [alpFeedback, setAlpFeedback] = useState('')
  const [inputWord, setInputWord] = useState('')
  const [result, setResult] = useState('')
  const [generatedWord, setGeneratedWord] = useState('')
  const [transcription, setTranscription] = useState('')
  const [rating, setRating] = useState(null)
  const [wordLoading, setWordLoading] = useState(false)
  const [ratingLoading, setRatingLoading] = useState(false)
  const [aiFeedback, setAiFeedback] = useState('')

  useEffect(() => {
    // fetch session to display user email
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email || ''
      setUserEmail(email)
      if (email) {
        fetchAlphabets(email)
      }
    })
    // also load cards on mount
    fetchCards()
  }, [])

  const fetchCards = async () => {
    try {
      const { data, error } = await supabase
        .from('flashcards')
        .select('id, front, back')
        .order('id', { ascending: true })
      if (error) throw error
      setCards((data || []).map((c) => ({ id: c.id, front: c.front, back: c.back })))
    } catch (err) {
      console.error(err)
    }
  }

  const addAlphabet = async () => {
    const alp = newAlphabetInput.trim()
    if (!alp) {
      setAlpFeedback('Enter a name for the alphabet.')
      return
    }
    if (alphabets.includes(alp)) {
      setAlpFeedback('Alphabet already exists.')
      return
    }
    try {
      const { data: current, error: fetchErr } = await supabase
        .from('Users')
        .select('Alphabets')
        .eq('User', userEmail)
        .maybeSingle()
      if (fetchErr) throw fetchErr
      let allAlph = current?.Alphabets ? JSON.parse(current.Alphabets) : {}
      allAlph[alp] = {}
      const { error } = await supabase
        .from('Users')
        .upsert({ User: userEmail, Alphabets: JSON.stringify(allAlph) }, { onConflict: 'User' })
      if (error) throw error
      setAlphabets(prev => [...prev, alp])
      setSelectedAlphabet(alp)
      setNewAlphabetInput('')
      setAlpFeedback(`Alphabet "${alp}" added.`)
    } catch (err) {
      console.error(err)
      setAlpFeedback('Error adding alphabet.')
    }
  }

  const fetchAlphabets = async (email) => {
    try {
      const { data, error } = await supabase
        .from('Users')
        .select('Alphabets')
        .eq('User', email)
        .maybeSingle()
      if (error) throw error
      const alpData = data?.Alphabets ? JSON.parse(data.Alphabets) : {}
      setAlphabets(Object.keys(alpData))
      if (Object.keys(alpData).length && !selectedAlphabet) {
        setSelectedAlphabet(Object.keys(alpData)[0])
      }
    } catch (err) {
      console.error('Error fetching alphabets:', err)
    }
  }

  const generateWord = async () => {
    if (!selectedAlphabet) return
    setWordLoading(true)
    setAiFeedback('')

    // special handling for Morse code
    if (selectedAlphabet.toLowerCase().includes('morse')) {
      // ensure we have cards loaded for a Latin source word
      if (!cards.length) await fetchCards()
      const randomCard = cards.length ? cards[Math.floor(Math.random() * cards.length)] : { back: 'HELLO' }
      const latin = randomCard.back || 'HELLO'
      const morseMap = {
        A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..',
        J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
        S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
        0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....',
        7: '--...', 8: '---..', 9: '----.'
      }
      const toMorse = (s) => s.toUpperCase().split('').map(ch => morseMap[ch] || '?').join(' ')
      setGeneratedWord(toMorse(latin))
      setTranscription('')
      setRating(null)
      setWordLoading(false)
      return
    }

    try {
      const client = new OpenAI({
        apiKey: 'ollama',
        baseURL: 'http://10.22.1.100:11434/v1',
        dangerouslyAllowBrowser: true,
      })
      // build prompt; special-case Aurebesh for extra clarity
      let promptMessage = `Provide a single word **in the ${selectedAlphabet} alphabet** (not Latin letters).`;
      if (selectedAlphabet.toLowerCase().includes('aurebesh')) {
        promptMessage += ` Use actual Aurebesh glyphs (see the Aurebesh script from Star Wars). If you cannot output such characters, respond with the single word IMPOSSIBLE exactly. Do not return any English/Latin words. `;
      }
      promptMessage += `If you cannot write a valid word in that script, respond with the single word IMPOSSIBLE exactly. Only output the word (or IMPOSSIBLE) and nothing else.`;

      const response = await client.chat.completions.create({
        model: 'gemma3:12b',
        messages: [
          {
            role: 'user',
            content: promptMessage,
          },
        ],
      })
      const text = response.choices?.[0]?.message?.content || ''
      const word = text.trim().split('\n')[0]
      if (word === 'IMPOSSIBLE') {
        setAiFeedback(`Cannot generate a word in the ${selectedAlphabet} alphabet.`)
        setGeneratedWord('')
      } else {
        // if Aurebesh check that no Latin letters slipped through
        if (selectedAlphabet.toLowerCase().includes('aurebesh')) {
          if (/[A-Za-z]/.test(word)) {
            setAiFeedback(`Model returned Latin characters rather than Aurebesh; treating as impossible.`)
            setGeneratedWord('')
          } else {
            setGeneratedWord(word)
            setTranscription('')
            setRating(null)
          }
        } else {
          setGeneratedWord(word)
          setTranscription('')
          setRating(null)
        }
      }
    } catch (err) {
      console.error(err)
      setAiFeedback('Error generating word.')
    } finally {
      setWordLoading(false)
    }
  }

  const rateTranscription = async () => {
    if (!generatedWord || !transcription) return
    setRatingLoading(true)
    setAiFeedback('')
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
            content: `You are an expert linguist. Rate the accuracy of this Latin transcription from 1 to 10 (whole integer only). Original word: "${generatedWord}" in the ${selectedAlphabet} alphabet. Transcription: "${transcription}". Respond with a single integer (1-10) and nothing else.`,
          },
        ],
      })
      const text = response.choices?.[0]?.message?.content || ''
      const num = parseInt(text.trim(), 10)
      if (isNaN(num) || num < 1 || num > 10) {
        throw new Error('Invalid rating returned')
      }
      setRating(num)
    } catch (err) {
      console.error(err)
      setAiFeedback('Error rating transcription.')
    } finally {
      setRatingLoading(false)
    }
  }


  const checkWord = () => {
    const trimmed = inputWord.trim()
    if (!trimmed) {
      setResult('Please type a word.')
      return
    }
    const match = cards.find(c => c.back.toLowerCase() === trimmed.toLowerCase())
    if (match) {
      setResult(`Found! English: ${match.front}`)
    } else {
      setResult('Word not found in flashcards.')
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
            <li><a href="#fillintheblank">Fill in the Blank</a></li>
            <li><a href="#flashcards" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('flashcards'); }}>Flashcards</a></li>
            <li><a href="#alphabets" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('test'); }}>Alphabets</a></li>
            <li><a href="#chat" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('chat'); }}>Chat</a></li>
          </ul>
        </nav>
      </header>

      <main className="container">
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          {/* alphabet management */}
          {alphabets.length === 0 && (
            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Add alphabet"
                value={newAlphabetInput}
                onChange={e => setNewAlphabetInput(e.target.value)}
                style={{ padding: 8, fontSize: 14, marginRight: 8 }}
              />
              <button
                onClick={addAlphabet}
                style={{ padding: 8, backgroundColor: '#2b6cff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Add
              </button>
              {alpFeedback && <div style={{ marginTop: 8, color: alpFeedback.startsWith('Error') ? '#c33' : '#080' }}>{alpFeedback}</div>}
            </div>
          )}

          {alphabets.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ marginRight: 8, fontSize: 14 }}>Alphabet:</label>
              <select
                value={selectedAlphabet}
                onChange={e => setSelectedAlphabet(e.target.value)}
                style={{ padding: 6, fontSize: 14 }}
              >
                {alphabets.map(alp => (
                  <option key={alp} value={alp}>{alp}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="New alphabet"
                value={newAlphabetInput}
                onChange={e => setNewAlphabetInput(e.target.value)}
                style={{ padding: 8, fontSize: 14, marginLeft: 12 }}
              />
              <button
                onClick={addAlphabet}
                style={{ padding: 8, backgroundColor: '#2b6cff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', marginLeft: 8 }}
              >
                Add
              </button>
              {alpFeedback && <div style={{ marginTop: 8, color: alpFeedback.startsWith('Error') ? '#c33' : '#080' }}>{alpFeedback}</div>}
            </div>
          )}

          {selectedAlphabet && (
            <div style={{ marginBottom: 20 }}>
              <button
                onClick={generateWord}
                disabled={wordLoading}
                style={{ padding: 8, backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                {wordLoading ? 'Generating…' : 'Generate Word'}
              </button>
            </div>
          )}

          {generatedWord && (
            <div style={{ marginBottom: 16 }}>
              <p><strong>Word:</strong> {generatedWord}</p>
              <input
                type="text"
                placeholder="Transcribe to Latin alphabet"
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                style={{ padding: 8, fontSize: 14, width: 240, marginRight: 8 }}
              />
              <button
                onClick={rateTranscription}
                disabled={ratingLoading || !transcription}
                style={{ padding: 8, backgroundColor: '#2b6cff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                {ratingLoading ? 'Checking…' : 'Submit'}
              </button>
            </div>
          )}

          {rating !== null && (
            <div style={{ marginBottom: 20, fontSize: 16, fontWeight: 'bold' }}>
              Rating: {rating} / 10
            </div>
          )}

          {aiFeedback && (
            <div style={{ marginBottom: 20, color: 'red' }}>{aiFeedback}</div>
          )}

          <div>
            <input
              type="text"
              placeholder="Type Latin word"
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
              style={{ padding: 8, fontSize: 14, width: 240, marginRight: 8 }}
            />
            <button
              onClick={checkWord}
              style={{ padding: 8, backgroundColor: '#2b6cff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              Check
            </button>
          </div>
        </div>

        {result && (
          <div style={{ marginTop: 20, fontSize: 16, fontWeight: 'bold' }}>{result}</div>
        )}

        {!cards.length && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <p>No flashcards available. Please add some flashcards first.</p>
          </div>
        )}
      </main>
    </div>
  )
}
