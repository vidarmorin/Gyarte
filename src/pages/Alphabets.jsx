import React from 'react'
import { supabase } from '../lib/supabaseClient'
import './Flashcards.css'

export default function Alphabets({ onClose, onNavigate }) {
  return (
    <div className="flashcards-page page">
      <header className="header">
        <div className="header-top">
          <h1>Alphabets</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="logout-button" onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }}>Logout</button>
          </div>
        </div>
        <nav className="nav">
          <ul>
            <li><a href="#home" onClick={(e) => { e.preventDefault(); onClose ? onClose() : (window.location.href = '/'); }}>Home</a></li>
            <li><a href="#fillintheblank" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('fillintheblank'); }}>Fill in the Blank</a></li>
            <li><a href="#flashcards" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('flashcards'); }}>Flashcards</a></li>
            <li><a href="#alphabets">Alphabets</a></li>
            <li><a href="#chat" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('chat'); }}>Chat</a></li>
          </ul>
        </nav>
      </header>

      <main className="container">
        {/* Placeholder content for Alphabets page */}
      </main>
    </div>
  )
}
