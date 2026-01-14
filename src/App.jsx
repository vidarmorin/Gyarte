import React, { useState, useEffect } from 'react'
import Home from './pages/Home'
import Auth from './pages/Auth'
import Flashcards from './pages/Flashcards'
import FillInTheBlank from './pages/FillInTheBlank'
import { supabase } from './lib/supabaseClient'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [route, setRoute] = useState('home')

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

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!session) return <Auth />

  return (
    <>
      {route === 'flashcards' ? (
        <Flashcards onClose={() => setRoute('home')} onNavigate={(r) => setRoute(r)} />
      ) : route === 'fillintheblank' ? (
        <FillInTheBlank onClose={() => setRoute('home')} onNavigate={(r) => setRoute(r)} />
      ) : (
        <Home onNavigate={(r) => setRoute(r)} />
      )}
    </>
  )
}

export default App
