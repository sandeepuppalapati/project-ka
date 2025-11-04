import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './theme.css'
import './index.css'
import { BridgeProvider } from './contexts/BridgeContext'
import { ThemeProvider } from './contexts/ThemeContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <BridgeProvider>
      <App />
    </BridgeProvider>
  </ThemeProvider>,
)
