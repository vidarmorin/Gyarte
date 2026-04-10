import React from 'react'
import './Settings.css'

export default function Settings({ settings, onChange, onClose }) {
  const toggle = (key) => {
    onChange({ [key]: !settings[key] })
  }

  return (
    <div className="settings-container">
      <div className="settings-card">
        <h1>Settings</h1>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.skipLink}
              onChange={() => toggle('skipLink')}
            />
            Show skip link
          </label>
          <p>Enable keyboard users to jump directly to the main content.</p>
        </div>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.focusOutline}
              onChange={() => toggle('focusOutline')}
            />
            Visible focus outlines
          </label>
          <p>Show a clear focus indicator for interactive elements.</p>
        </div>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={() => toggle('highContrast')}
            />
            High contrast mode
          </label>
          <p>Use stronger foreground and background contrast for readability.</p>
        </div>

        <button type="button" className="back-button" onClick={onClose}>
          Back
        </button>
      </div>
    </div>
  )
}
