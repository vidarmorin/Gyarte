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
      // DEVELOPING MUST BE CHANGED
      const selectedLanguage = 'Swedish'
      const ChosenNumber = 5

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
            content: `IMPORTANT: You are creating a selection "${selectedLanguage}" flashcards. Follow these STRICT rules:
1. Create ONLY "${ChosenNumber}" flashcard(s) in the formatspecified below - do NOT create more or less than "${ChosenNumber}" flashcard(s)
2. The flashcard(s) MUST be in the format {"word in ${selectedLanguage}": "English translation"} - ONLY this format is allowed, do NOT include any other text or formatting
3. All flascards must be put in a single JSON object, do NOT create multiple JSON objects or arrays - {"word1": "translation1", "word2": "translation2", ...} is the correct format
4. The word(s) MUST be from the "${selectedLanguage}" language and be common vocabulary words
5. Do NOT include ANY words that are not in "${selectedLanguage}"
6. The English translation MUST be accurate and concise
7. Output format: {"word in ${selectedLanguage}": "English translation"} - ONLY this JSON format is allowed, do NOT include any other text or formatting
8. Do NOT include ANY explanations, apologies, or additional text - ONLY the flashcard(s) in the specified JSON format
9. The flashcard(s) MUST be unique and not repeated
10. ONLY return the flashcard(s) in the specified JSON format, do NOT include ANY other text or formatting such as '''json''' before the dict

Create the flashcard(s) now. Remember: follow the STRICT rules above and output ONLY the flashcard(s) in the specified JSON format.`
          },
        ],
      })

      const aiText = response.choices?.[0]?.message?.content || ''
      const jsonStart = aiText.indexOf('{')
      const jsonEnd = aiText.lastIndexOf('}') + 1
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('Invalid response format: JSON not found')
      }

      
      const jsonString = aiText.substring(jsonStart, jsonEnd)
      let flashcardData
      console.log(aiText)
      try {
        flashcardData = JSON.parse(jsonString)
      } catch (err) {
        throw new Error('Failed to parse JSON: ' + err.message)
      }
      console.log('Parsed flashcard data:', flashcardData)

      // Convert parsed data into flashcard format
      const newCards = Object.entries(flashcardData).map(([word, translation]) => ({ front: word, back: translation }))
      setCards(newCards)
    } catch (err) {
      console.error(err)
      setQuizFeedback('Error generating quiz. Please try again.')
    } finally {
      setQuizLoading(false)
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
