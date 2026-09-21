import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { atlasUrl } from './data'
import './styles.css'

new Image().src = atlasUrl

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
