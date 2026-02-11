import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import OpenAI from 'openai'
import './Flashcards.css'

export default function FillInTheBlank({ onClose, onNavigate }) {
  const [cards, setCards] = useState([])
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizSentence, setQuizSentence] = useState('')
  const [quizOptions, setQuizOptions] = useState([])
  const [correctIndex, setCorrectIndex] = useState(-1)
  const [quizTranslation, setQuizTranslation] = useState('')
  const [quizFeedback, setQuizFeedback] = useState('')
  const [userEmail, setUserEmail] = useState('')

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
      setCards((data || []).map((c) => ({ id: c.id, front: c.front, back: c.back })))
    } catch (err) {
      console.error(err)
    }
  }

  const generateQuiz = async () => {
    setQuizLoading(true)
    setQuizFeedback('')
    setQuizSentence('')
    setQuizOptions([])
    setCorrectIndex(-1)
    setQuizTranslation('')

    try {
      // Fetch cards
      const { data, error } = await supabase
        .from('flashcards')
        .select('id, front, back')
        .order('id', { ascending: true })
      if (error) throw error
      const fetchedCards = (data || []).map((c) => ({ id: c.id, front: c.front, back: c.back }))
      setCards(fetchedCards)
      console.log('Fetched cards:', fetchedCards.length)

      if (!fetchedCards.length) {
        setQuizFeedback('No flashcards available. Please add cards first.')
        setQuizLoading(false)
        return
      }

      // Pick a random card and use the BACK (answer/Latin word) field
      const randomCard = fetchedCards[Math.floor(Math.random() * fetchedCards.length)]
      const word = randomCard.back // Use the back field - the Latin word/definition

      // Get two other random words from different cards
      const otherCards = fetchedCards.filter(c => c.id !== randomCard.id)
      if (otherCards.length < 2) {
        setQuizFeedback('Need at least 3 flashcards for quiz.')
        setQuizLoading(false)
        return
      }
      const shuffledOthers = otherCards.sort(() => Math.random() - 0.5)
      const incorrect1 = shuffledOthers[0]
      const incorrect2 = shuffledOthers[1]

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
            content: `You are creating a Latin vocabulary quiz. Use the exact Latin word "${word}" from the flashcards.

STRICT INSTRUCTIONS:
1. Create exactly ONE Latin sentence that naturally includes the word "${word}".
2. Replace ONLY the word "${word}" with _____ (five underscores) in the sentence.
3. The sentence must be grammatically correct Latin.
4. Provide the English translation of the full correct sentence (with "${word}" included).

Output ONLY in this exact format with no extra text:
[sentence with _____] | [English translation]

Example for word "puer":
[_____ amat matrem.] | [The boy loves his mother.]

Now create for the word "${word}":`,
          },
        ],
      })

      const aiText = response.choices?.[0]?.message?.content || ''
      console.log('AI response:', aiText)
      const parts = aiText.split('|').map(p => p.trim())

      if (parts.length >= 2) {
        const sentence = parts[0].trim()
        const englishTranslation = parts[1].trim()
        console.log('Parsed sentence:', sentence, 'Translation:', englishTranslation)

        // Verify that there's actually a blank in the sentence
        if (sentence.includes('_____')) {
          // Create options array: correct word and two incorrect from other cards
          const options = [
            { word: word, translation: randomCard.front },
            { word: incorrect1.back, translation: incorrect1.front },
            { word: incorrect2.back, translation: incorrect2.front }
          ]
          const shuffled = options.sort(() => Math.random() - 0.5)
          const correctIdx = shuffled.findIndex(opt => opt.word === word)

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
      setQuizFeedback(`Wrong. The correct answer is: ${quizOptions[correctIndex].word}. Translation: ${quizTranslation}`)
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
            <li><a href="#chat" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('chat'); }}>Chat</a></li>
          </ul>
        </nav>
      </header>

      <main className="container">
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button onClick={generateQuiz} disabled={quizLoading} style={{ width: '200px', padding: 10, backgroundColor: '#2b6cff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
            {quizLoading ? 'Generating Quiz…' : 'Generate Quiz'}
          </button>
        </div>

        {quizSentence && (
          <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f0f8ff', border: '1px solid #2b6cff', borderRadius: 4, maxWidth: 600, margin: '20px auto' }}>
            <label className="label">Choose the correct Latin word to fill the blank:</label>
            <p style={{ fontSize: 16, marginBottom: 12, marginTop: 8 }}>{quizSentence}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {quizOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => {
                    alert(`Translation: ${option.translation}`)
                    checkQuizOption(index)
                  }}
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
                  {option.word}
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
            <p>No flashcards available. Please add some flashcards first.</p>
          </div>
        )}

        {cards.length > 0 && (
          <div style={{ marginTop: 40, padding: 12, backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: 4 }}>
            <h3 style={{ marginBottom: 12 }}>Vocabulary Reference</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {cards.map((card, index) => (
                <button
                  key={card.id ?? `card-${index}`}
                  onClick={() => alert(`Translation: ${card.front}`)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#e0e0e0',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  {card.back}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
