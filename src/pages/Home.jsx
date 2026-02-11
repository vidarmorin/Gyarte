import React from 'react';
import { supabase } from '../lib/supabaseClient';
import './Home.css';

export default function Home({ onNavigate }) {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="home-container">
      <header className="header">
        <div className="header-top">
          <h1>Welcome to My React App</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="logout-button" onClick={handleLogout}>Logout</button>
          </div>
        </div>
        <nav className="nav">
          <ul>
            <li><a href="#home" onClick={(e) => { e.preventDefault(); window.scrollTo(0, 0); }}>Home</a></li>
            <li><a href="#fillintheblank" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('fillintheblank'); }}>Fill in the Blank</a></li>
            <li><a href="#flashcards" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('flashcards'); }}>Flashcards</a></li>
            <li><a href="#chat" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('chat'); }}>Chat</a></li>
          </ul>
        </nav>
      </header>

      <main className="main">
        <section className="hero">
          <h2>Hello, Welcome!</h2>
          <p>This is a basic React homepage to get you started.</p>
          <button className="cta-button">Get Started</button>
        </section>

        <section className="features">
          <h2>Features</h2>
          <div className="feature-grid">
            <div className="feature-card">
              <h3>Fast</h3>
              <p>Lightning-fast performance with React</p>
            </div>
            <div className="feature-card">
              <h3>Responsive</h3>
              <p>Works great on all devices</p>
            </div>
            <div className="feature-card">
              <h3>Modern</h3>
              <p>Built with the latest web technologies</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>&copy; 2025 My React App. All rights reserved.</p>
      </footer>
    </div>
  );
}
