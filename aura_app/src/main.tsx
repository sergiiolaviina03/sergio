import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initCloud, setNotifier } from './lib/cloud'
import { toast } from './components/ui'
import { initNative } from './lib/platform'

setNotifier(toast)

initCloud()
initNative()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
