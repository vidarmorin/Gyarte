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
  const [languages, setLanguages] = useState([])
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [selectedNumber, setSelectedNumber] = useState(5)
  const [fetchCardsLoading, setFetchCardsLoading] = useState(false)
  const [generatedCards, setGeneratedCards] = useState([])
  const [selectedCardIndices, setSelectedCardIndices] = useState(new Set())
  
  useEffect(() => {
    // fetch session to display user email
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email || '')
    })

    // fetch languages from NyFlashcard table
    const fetchLanguages = async () => {
      try {
        const { data, error } = await supabase
          .from('NyFlashcard')
          .select('Language')
          .order('Language', { ascending: true })
        if (error) throw error
        const uniqueLanguages = [...new Set((data || []).map(c => c.Language))]
        setLanguages(uniqueLanguages)
      } catch (err) {
        console.error('Error fetching languages:', err)
      }
    }

    fetchLanguages()
  }, [])

  const fetchCards = async () => {
    setFetchCardsLoading(true)
    try {
      const { data, error } = await supabase
        .from('NyFlashcard')
        .select('data')
        .eq('Language', selectedLanguage)
        .single()
      if (error) throw error
      const dict = JSON.parse(data.data)
      const mapped = Object.entries(dict).map(([word, translation]) => ({
        front: word,
        back: translation
      }))
      setCards(mapped)
    } catch (err) {
      console.error(err)
    } finally {
      setFetchCardsLoading(false)
    }
  }

  const generateQuiz = async () => {
    if (!selectedLanguage) {
      setQuizFeedback('Please select a language first.')
      return
    }

    setQuizLoading(true)
    setQuizFeedback('')
    setQuizSentence('')
    setQuizOptions([])
    setCorrectIndex(-1)
    setQuizTranslation('')

    try {
      // Fetch all existing words for this language to exclude them
      const { data: existingData, error: fetchError } = await supabase
        .from('NyFlashcard')
        .select('data')
        .eq('Language', selectedLanguage)
        .single()
      
      if (fetchError) throw fetchError
      
      const existingDict = JSON.parse(existingData.data)
      const existingWords = Object.keys(existingDict)
      const existingWordsString = existingWords.join(', ')
      const ChosenNumber = selectedNumber

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
            content: `IMPORTANT: You are creating NEW "${selectedLanguage}" flashcards. Follow these STRICT rules:

EXISTING WORDS IN DATABASE (DO NOT USE THESE):
${existingWordsString}

1. Create ONLY "${ChosenNumber}" NEW flashcard(s) - do NOT create more or less than "${ChosenNumber}" flashcard(s)
2. The flashcards MUST be in the format {"word in ${selectedLanguage}": "English translation"} - ONLY this format is allowed
3. All flashcards must be put in a single JSON object - {"word1": "translation1", "word2": "translation2", ...} is the correct format
4. CRITICAL: Do NOT include ANY words from the existing words list above - ONLY create completely NEW words that are NOT in the database
5. The word(s) MUST be from the "${selectedLanguage}" language and be common vocabulary words
6. Each word MUST be unique and different from all other words you generate
7. The English translation MUST be accurate and concise
8. Do NOT include ANY explanations, apologies, or additional text - ONLY the flashcard JSON
9. ONLY return the flashcard(s) in the specified JSON format

Create the NEW flashcard(s) now. Remember: EXCLUDE ALL EXISTING WORDS and output ONLY the JSON format.`
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

      // Verify none of the generated words exist in database
      for (const word of Object.keys(flashcardData)) {
        if (existingWords.some(w => w.toLowerCase() === word.toLowerCase())) {
          throw new Error(`Generated word "${word}" already exists in database. Please try again.`)
        }
      }

      // Convert parsed data into flashcard format
      const newCards = Object.entries(flashcardData).map(([word, translation]) => ({ front: word, back: translation }))
      setGeneratedCards(newCards)
      setSelectedCardIndices(new Set())
    } catch (err) {
      console.error(err)
      setQuizFeedback('Error generating quiz. Please try again.')
    } finally {
      setQuizLoading(false)
    }
  }

  const toggleCardSelection = (index) => {
    const newSelected = new Set(selectedCardIndices)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedCardIndices(newSelected)
  }

  const saveSelectedCards = async () => {
    if (selectedCardIndices.size === 0) {
      setQuizFeedback('Please select at least one card to save.')
      return
    }

    try {
      const cardsToSave = Array.from(selectedCardIndices).map(index => generatedCards[index])
      
      const { data: currentData, error: fetchError } = await supabase
        .from('NyFlashcard')
        .select('data')
        .eq('Language', selectedLanguage)
        .single()
      
      if (fetchError) throw fetchError

      const existingDict = JSON.parse(currentData.data)
      
      cardsToSave.forEach(card => {
        existingDict[card.front] = card.back
      })

      const { error: updateError } = await supabase
        .from('NyFlashcard')
        .update({ data: JSON.stringify(existingDict) })
        .eq('Language', selectedLanguage)

      if (updateError) throw updateError

      setQuizFeedback(`Successfully saved ${selectedCardIndices.size} card(s)!`)
      setGeneratedCards([])
      setSelectedCardIndices(new Set())
    } catch (err) {
      console.error(err)
      setQuizFeedback('Error saving cards. Please try again.')
    }
  }

  const discardCards = () => {
    setGeneratedCards([])
    setSelectedCardIndices(new Set())
  }

  const checkQuizOption = (index) => {
    if (index === correctIndex) {
      setQuizFeedback('Correct! Well done!')
    } else {
      setQuizFeedback(`Incorrect. The correct answer is: ${quizOptions[correctIndex]}`)
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
          
          {languages.length > 0 && (
          <div style={{ marginTop: 20, marginBottom: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Select Language:</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {languages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  style={{
                    padding: 10,
                    backgroundColor: selectedLanguage === lang ? '#2b6cff' : '#e0e0e0',
                    color: selectedLanguage === lang ? 'white' : '#333',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: selectedLanguage === lang ? 600 : 500,
                  }}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
          )}

          <select value={selectedNumber} onChange={(e) => setSelectedNumber(Number(e.target.value))} style={{ padding: 10, backgroundColor: '#fff', color: '#333', border: '1px solid #2b6cff', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 500, marginRight: 10 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <option key={num} value={num}>
                {num} Card{num !== 1 ? 's' : ''}
              </option>
            ))}
          </select>
          
          <button id="generate-quiz-button" onClick={generateQuiz} disabled={quizLoading || !selectedLanguage} style={{ width: '200px', padding: 10, backgroundColor: '#2b6cff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 500, opacity: quizLoading || !selectedLanguage ? 0.5 : 1 }}>
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

        {generatedCards.length > 0 && (
          <div style={{ marginTop: 20, padding: 20, backgroundColor: '#f0f8ff', border: '2px solid #2b6cff', borderRadius: 4, maxWidth: 800, margin: '20px auto' }}>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 15, color: '#2b6cff' }}>Review Generated Cards - Select ones to save:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {generatedCards.map((card, index) => (
                <button
                  key={index}
                  onClick={() => toggleCardSelection(index)}
                  style={{
                    padding: 12,
                    backgroundColor: selectedCardIndices.has(index) ? '#2b6cff' : '#fff',
                    color: selectedCardIndices.has(index) ? 'white' : '#333',
                    border: '2px solid ' + (selectedCardIndices.has(index) ? '#2b6cff' : '#ddd'),
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 14,
                    textAlign: 'left',
                    fontWeight: selectedCardIndices.has(index) ? 600 : 500
                  }}
                >
                  {card.front} / {card.back}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={saveSelectedCards}
                style={{
                  padding: 10,
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  minWidth: 150
                }}
              >
                Save Selected ({selectedCardIndices.size})
              </button>
              <button
                onClick={discardCards}
                style={{
                  padding: 10,
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  minWidth: 150
                }}
              >
                Discard All
              </button>
            </div>
          </div>
        )}

        {!cards.length && !generatedCards.length && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <p>No flashcards available. Please fetch cards first.</p>
          </div>
        )}
      </main>
    </div>
  )
}
