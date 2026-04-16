import { Link, Route, Routes } from 'react-router-dom'
import UploadPage from './pages/UploadPage'
import DiagnosisPage from './pages/DiagnosisPage'
import ChatPage from './pages/ChatPage'

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI crop clinic</p>
          <h1>Plant Disease Treatment System</h1>
        </div>
        <nav className="nav-links">
          <Link to="/">Diagnosis</Link>
          <Link to="/chat">Farmer Chat</Link>
        </nav>
      </header>

      <main className="main-content">
        <div className="page-intro">
          <h2>Healthy fields start with fast detection and clear treatment advice.</h2>
          <p>
            Upload a leaf, get a diagnosis, listen to treatment guidance, and let farmers ask follow-up questions by voice.
          </p>
        </div>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/result" element={<DiagnosisPage />} />
          <Route path="/chat" element={<ChatPage />} />
        </Routes>
      </main>
    </div>
  )
}
