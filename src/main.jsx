import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import './index.css'
import App from './App.jsx'

class AppErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Gomoku Review crashed during rendering.', error, errorInfo)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main style={{ padding: '32px', color: '#20251f', fontFamily: 'Manrope Variable, sans-serif' }}>
        <h1>Analýza se nepodařila vykreslit</h1>
        <p>{this.state.error instanceof Error ? this.state.error.message : String(this.state.error)}</p>
        <button type="button" onClick={() => window.location.reload()}>Obnovit aplikaci</button>
      </main>
    )
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
