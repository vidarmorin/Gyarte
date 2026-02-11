import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Test({ onClose, onNavigate }) {
  const [language, setLanguage] = useState('')
  const [flashcardsText, setFlashcardsText] = useState('')
  const [jsonOutput, setJsonOutput] = useState('')
  const [saving, setSaving] = useState(false)

  const formatFlashcards = () => {
    if (!language.trim()) {
      alert('Please enter a language')
      return
    }
    if (!flashcardsText.trim()) {
      alert('Please enter flashcards')
      return
    }

    const lines = flashcardsText.trim().split('\n')
    const dict = {}

    for (const line of lines) {
      const parts = line.split(':')
      if (parts.length >= 2) {
        const word = parts[0].trim()
        const translation = parts.slice(1).join(':').trim()
        if (word && translation) {
          dict[word] = translation
        }
      }
    }

    const result = {
      [language.trim()]: dict
    }

    setJsonOutput(JSON.stringify(result, null, 2))
  }

  const saveToSupabase = async () => {
    if (!language.trim() || !jsonOutput) {
      alert('Please format the flashcards first')
      return
    }

    setSaving(true)
    try {
      const dict = JSON.parse(jsonOutput)[language.trim()]
      const { error } = await supabase
        .from('NyFlashcard')
        .insert([{ Language: language.trim(), data: JSON.stringify(dict) }])
      
      if (error) throw error
      
      alert('Saved to Supabase successfully!')
    } catch (err) {
      alert(`Error saving: ${err.message}`)
    } finally {
      setSaving(false)
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
            <li><a href="#chat" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('chat'); }}>Chat</a></li>
          </ul>
        </nav>
      </header>

      <main className="container">
        <div style={{ maxWidth: 600, margin: '40px auto' }}>
          <h2>Format Flashcards to JSON</h2>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>Language:</label>
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="e.g. Latin"
              style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4 }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>Flashcards (word:translation, one per line):</label>
            <textarea
              value={flashcardsText}
              onChange={(e) => setFlashcardsText(e.target.value)}
              placeholder="puer:boy&#10;puella:girl&#10;domus:house"
              rows={10}
              style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4, fontFamily: 'monospace' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button
              onClick={formatFlashcards}
              style={{ padding: '10px 20px', backgroundColor: '#2b6cff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              Format to JSON
            </button>
            <button
              onClick={saveToSupabase}
              disabled={saving || !jsonOutput}
              style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              {saving ? 'Saving…' : 'Save to Supabase'}
            </button>
          </div>

          {jsonOutput && (
            <div style={{ marginTop: 20 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>JSON Output:</label>
              <textarea
                value={jsonOutput}
                readOnly
                rows={15}
                style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4, fontFamily: 'monospace', backgroundColor: '#f9f9f9' }}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}