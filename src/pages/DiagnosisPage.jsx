import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getOrCreateFarmerId, getTreatment } from '../lib/api'
import { speakText, stopSpeaking } from '../lib/voice'

export default function DiagnosisPage() {
  const navigate = useNavigate()
  const diagnosis = useMemo(() => {
    const raw = localStorage.getItem('latestDiagnosis')
    return raw ? JSON.parse(raw) : null
  }, [])

  const [loading, setLoading] = useState(false)
  const [treatment, setTreatment] = useState('')
  const [sources, setSources] = useState([])
  const [sessionId, setSessionId] = useState(localStorage.getItem('bedrockSessionId') || '')
  const [error, setError] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const farmerId = useMemo(() => getOrCreateFarmerId(), [])

  useEffect(() => {
    async function loadTreatment() {
      if (!diagnosis?.prediction?.predicted_class) return
      try {
        setLoading(true)
        const result = await getTreatment(diagnosis.prediction.predicted_class, sessionId || undefined, farmerId)
        setTreatment(result.treatment)
        setSources(result.sources || [])
        if (result.sessionId) {
          setSessionId(result.sessionId)
          localStorage.setItem('bedrockSessionId', result.sessionId)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadTreatment()

    return () => stopSpeaking()
  }, [diagnosis, sessionId, farmerId])

  if (!diagnosis) {
    return (
      <div className="card empty-state">
        <h2>No diagnosis found</h2>
        <p className="muted">Upload an image first.</p>
        <button className="primary-btn" onClick={() => navigate('/')}>Go to upload</button>
      </div>
    )
  }

  const { prediction, imagePreview } = diagnosis

  function goToChat() {
    localStorage.setItem('chatDiseaseContext', prediction.predicted_class)
    navigate('/chat')
  }

  function onSpeakTreatment() {
    if (!treatment) return
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    const utterance = speakText(
      `Detected disease is ${prediction.predicted_class}. Confidence ${(prediction.confidence * 100).toFixed(1)} percent. ${treatment}`,
      {
        onEnd: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      }
    )
    if (utterance) setSpeaking(true)
  }

  return (
    <section className="result-layout">
      <div className="card result-summary leaf-panel">
        <div className="result-header">
          <div>
            <p className="section-kicker">Step 2</p>
            <h2>Disease prediction</h2>
          </div>
          <Link to="/" className="ghost-link">Analyze another image</Link>
        </div>

        <div className="result-grid">
          <img className="result-image" src={imagePreview} alt="Uploaded leaf" />
          <div>
            <div className="pill">Prediction: {prediction.predicted_class}</div>
            <p className="confidence-text">Confidence: {(prediction.confidence * 100).toFixed(2)}%</p>
            <h3>Top matches</h3>
            <div className="topk-list">
              {prediction.top_k?.map((item) => (
                <div className="topk-item" key={`${item.class}-${item.index}`}>
                  <span>{item.class}</span>
                  <strong>{(item.confidence * 100).toFixed(2)}%</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card treatment-card orchard-card">
        <div className="result-header">
          <div>
            <p className="section-kicker">Step 3</p>
            <h2>Treatment and prevention</h2>
          </div>
          <div className="header-actions">
            <button className="secondary-btn" onClick={onSpeakTreatment} disabled={!treatment}>
              {speaking ? 'Stop voice' : 'Play voice guidance'}
            </button>
            <button className="primary-btn compact-btn" onClick={goToChat}>Open farmer chat</button>
          </div>
        </div>

        {loading ? <p className="muted">Loading treatment advice...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {treatment ? <article className="treatment-output">{treatment}</article> : null}

        {sources.length > 0 ? (
          <div className="sources-box">
            <h3>References</h3>
            <ul>
              {sources.map((source, index) => (
                <li key={`${source.title || 'src'}-${index}`}>
                  {source.uri ? (
                    <a href={source.uri} target="_blank" rel="noreferrer">
                      {source.title || source.uri}
                    </a>
                  ) : (
                    <span>{source.title || 'Knowledge reference'}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}
