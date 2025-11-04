import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './theme.css'
import './index.css'
import { BridgeProvider } from './contexts/BridgeContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BridgeProvider>
    <App />
  </BridgeProvider>,
)
