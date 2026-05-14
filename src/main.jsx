import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@arco-design/web-react/dist/css/arco.css';
import '@fontsource/ibm-plex-sans/300.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/700.css';
import App from './App.jsx'
import { ProjectProvider } from './contexts/ProjectContext.jsx'


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ProjectProvider>
      <App />
    </ProjectProvider>
  </StrictMode>,
)
