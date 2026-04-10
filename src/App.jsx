import React, { useState, useEffect } from 'react'
import Home from './pages/Home'
import Auth from './pages/Auth'
import Flashcards from './pages/Flashcards'
import FillInTheBlank from './pages/FillInTheBlank'
import Chat from './pages/chat'
import Test from './pages/Test'
import Settings from './pages/Settings'
import { supabase } from './lib/supabaseClient'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [route, setRoute] = useState('home')
  const [settings, setSettings] = useState({
    skipLink: true,
    focusOutline: true,
    highContrast: false,
  })

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem('loquoraiSettings')
    if (saved) {
      try {
        setSettings(JSON.parse(saved))
      } catch (err) {
        console.warn('Could not parse saved settings', err)
      }
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('focus-enabled', settings.focusOutline)
    document.body.classList.toggle('high-contrast', settings.highContrast)
    window.localStorage.setItem('loquoraiSettings', JSON.stringify(settings))
  }, [settings])

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!session) return <Auth />

  const handleSettingsChange = (updates) => {
    setSettings((prev) => ({ ...prev, ...updates }))
  }

  return (
    <>
      {route === 'flashcards' ? (
        <Flashcards onClose={() => setRoute('home')} onNavigate={(r) => setRoute(r)} />
      ) : route === 'fillintheblank' ? (
        <FillInTheBlank onClose={() => setRoute('home')} onNavigate={(r) => setRoute(r)} />
      ) : route === 'chat' ? (
        <Chat onClose={() => setRoute('home')} onNavigate={(r) => setRoute(r)} />
      ) : route === 'test' ? (
        <Test onClose={() => setRoute('home')} onNavigate={(r) => setRoute(r)} />
      ) : route === 'settings' ? (
        <Settings
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setRoute('home')}
        />
      ) : (
        <Home settings={settings} onNavigate={(r) => setRoute(r)} />
      )}
    </>
  )
}

export default App
