import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './auth'
import { I18nProvider } from './i18n'
import { GAMES } from './games'
import { atlasUrl } from './pics'
import './styles.css'

for (const game of GAMES) new Image().src = atlasUrl(game.id)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
)
