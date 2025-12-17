import React from 'react';
import './home.css';

export default function Home() {
  return (
    <div className="home-container">
      <header className="header">
        <h1>Welcome to My React App</h1>
        <nav className="nav">
          <ul>
            <li><a href="#home">Home</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#contact">Contact</a></li>
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
