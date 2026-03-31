import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import './Home.css'; // reuse your existing styling

export default function Chat({ onNavigate }) {
  const [languages, setLanguages] = useState([]);
  const [selectedLang, setSelectedLang] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  // Load languages from Supabase
  useEffect(() => {
    async function loadLanguages() {
      const { data, error } = await supabase.from('languages').select('*');
      if (!error) setLanguages(data);
    }
    loadLanguages();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: selectedLang,
        message: input
      })
    });

    const data = await res.json();

    setMessages(prev => [
      ...prev,
      userMessage,
      { role: 'assistant', content: data.reply, score: data.score }
    ]);

    setInput('');
  }

  return (
    <div className="home-container">
      {/* HEADER */}
      <header className="header">
        <div className="header-top">
          <h1>AI Language Chat</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="logout-button" onClick={handleLogout}>Logout</button>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav className="nav">
          <ul>
            <li><a href="#home" onClick={(e) => { e.preventDefault(); onNavigate('home'); }}>Home</a></li>
            <li><a href="#fillintheblank" onClick={(e) => { e.preventDefault(); onNavigate('fillintheblank'); }}>Fill in the Blank</a></li>
            <li><a href="#flashcards" onClick={(e) => { e.preventDefault(); onNavigate('flashcards'); }}>Flashcards</a></li>
            <li><a href="#alphabets" onClick={(e) => { e.preventDefault(); onNavigate('test'); }}>Alphabets</a></li>
            <li><a href="#chat" onClick={(e) => e.preventDefault()}>Chat</a></li>
          </ul>
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <main className="main">
        <section className="hero">
          <h2>Practice a Language with AI</h2>
          <p>Select a language and start chatting. The AI will match your level and score your responses.</p>
        </section>

        {/* LANGUAGE SELECTOR */}
        <section className="features">
          <h2>Select Language</h2>
          <select
            className="cta-button"
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
          >
            <option value="">Choose a language…</option>
            {languages.map(lang => (
              <option key={lang.id} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </section>

        {/* CHAT WINDOW */}
        {selectedLang && (
          <section className="features">
            <h2>Chat in {selectedLang.toUpperCase()}</h2>

            <div className="feature-card" style={{ maxHeight: 300, overflowY: 'auto' }}>
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <strong>{m.role === 'user' ? 'You:' : 'AI:'}</strong>
                  <p>{m.content}</p>
                  {m.score && (
                    <small>Score: {m.score}/10</small>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                className="cta-button"
                style={{ flex: 1 }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message…"
              />
              <button className="cta-button" onClick={sendMessage}>Send</button>
            </div>
          </section>
        )}
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <p>&copy; 2025 My React App. All rights reserved.</p>
      </footer>
    </div>
  );
}
