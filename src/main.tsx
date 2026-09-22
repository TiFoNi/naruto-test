import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { GAMES } from './games'
import './styles.css'

for (const game of GAMES) new Image().src = game.atlasUrl

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
