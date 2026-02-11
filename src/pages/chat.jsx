import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import OpenAI from 'openai'
import './Flashcards.css'

export default function Chat({ onClose, onNavigate }) {
  const [cards, setCards] = useState([])
  const [userEmail, setUserEmail] = useState('')
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizSentence, setQuizSentence] = useState('')
  const [quizOptions, setQuizOptions] = useState([])
  const [correctIndex, setCorrectIndex] = useState(-1)
  const [quizTranslation, setQuizTranslation] = useState('')
  const [quizFeedback, setQuizFeedback] = useState('')

  useEffect(() => {
    // fetch session to display user email
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email || '')
    })
  }, [])

  const fetchCards = async () => {
    try {
      const { data, error } = await supabase
        .from('flashcards')
        .select('id, front, back')
        .order('id', { ascending: true })
      if (error) throw error
      const mapped = (data || []).map((c) => ({ id: c.id, front: c.front, back: c.back }))
      setCards(mapped)
    } catch (err) {
      console.error(err)
    }
  }

  const generateQuiz = async () => {
    if (!cards.length) {
      setQuizFeedback('No flashcards available. Please fetch cards first.')
      return
    }

    setQuizLoading(true)
    setQuizFeedback('')
    setQuizSentence('')
    setQuizOptions([])
    setCorrectIndex(-1)
    setQuizTranslation('')

    try {
      // Pick a random card and use the BACK (answer/Latin word) field
      const randomCard = cards[Math.floor(Math.random() * cards.length)]
      const word = randomCard.back // Use the back field - the Latin word/definition

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
            content: `IMPORTANT: You are creating a Latin multiple-choice quiz. Follow these STRICT rules:
1. Create ONLY ONE complete Latin sentence with a blank
2. The sentence MUST use the EXACT Latin word "${word}" - do NOT use related forms, synonyms, or different conjugations
3. This word comes from a Latin flashcard vocabulary list and must be used exactly as written
4. The word MUST appear exactly ONCE in the sentence
5. Replace ONLY "${word}" with _____ (five underscores)
6. Do NOT translate or use any non-Latin words
7. Generate TWO incorrect Latin sentences that are similar but wrong (e.g., wrong word choice, conjugation, or structure)
8. Provide an ENGLISH translation of the correct full Latin sentence
9. Output format: [sentence with _____] | [correct full sentence] | [incorrect option 1] | [incorrect option 2] | [English translation]
10. There MUST be exactly four | separators (five parts total)
11. All Latin options must be complete Latin sentences

The LATIN word from flashcards to use: "${word}"

Create the quiz now. Remember: use the exact word "${word}" as given, keep everything in Latin except the final English translation.`,
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
            <li><a href="#flashcards" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('flashcards'); }}>Flashcards</a></li>
            <li><a href="#chat">Chat</a></li>
          </ul>
        </nav>
      </header>

      <main className="container">
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button onClick={fetchCards} style={{ width: '200px', padding: 10, backgroundColor: '#2b6cff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 500, marginRight: 10 }}>
            Fetch Cards
          </button>
          <button onClick={generateQuiz} disabled={quizLoading || !cards.length} style={{ width: '200px', padding: 10, backgroundColor: '#2b6cff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
            {quizLoading ? 'Generating Quiz…' : 'Generate Quiz'}
          </button>
        </div>

        {quizSentence && (
          <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f0f8ff', border: '1px solid #2b6cff', borderRadius: 4, maxWidth: 600, margin: '20px auto' }}>
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

        {!cards.length && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <p>No flashcards available. Please fetch cards first.</p>
          </div>
        )}
      </main>
    </div>
  )
}
