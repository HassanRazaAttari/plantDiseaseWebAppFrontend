import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fileToBase64, predictDisease } from '../lib/api'

export default function UploadPage() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function onSelectFile(event) {
    const nextFile = event.target.files?.[0]
    if (!nextFile) return
    setFile(nextFile)
    setError('')
    setPreview(URL.createObjectURL(nextFile))
  }

  async function onAnalyze() {
    if (!file) {
      setError('Please upload a leaf image first.')
      return
    }

    try {
      setLoading(true)
      setError('')
      const imageBase64 = await fileToBase64(file)
      const prediction = await predictDisease(imageBase64)

      const record = {
        prediction,
        imagePreview: preview,
        createdAt: new Date().toISOString(),
      }
      localStorage.setItem('latestDiagnosis', JSON.stringify(record))
      localStorage.setItem('chatDiseaseContext', prediction.predicted_class || '')
      navigate('/result')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="hero-grid">
      <div className="card upload-card leaf-panel">
        <p className="section-kicker">Step 1</p>
        <h2>Upload a leaf photo</h2>
        <p className="muted">
          Choose one clear photo of the affected leaf. The system will detect the disease first,
          then show treatment and prevention advice.
        </p>

        <div className="simple-upload-box">
          <label className="simple-upload-controls">
            <input type="file" accept="image/*" onChange={onSelectFile} hidden />
            <span className="primary-btn upload-trigger">Choose leaf image</span>
          </label>
          <span className="hint-text">JPG, PNG, or WEBP. One centered leaf works best.</span>
        </div>

        <div className="preview-shell">
          {preview ? (
            <img className="preview-image" src={preview} alt="Leaf preview" />
          ) : (
            <div className="preview-placeholder">
              <div className="leaf-icon">🌿</div>
              <strong>Your image preview will appear here</strong>
              <p className="muted small">Upload a single leaf photo to begin diagnosis.</p>
            </div>
          )}
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="action-row">
          <button className="primary-btn" onClick={onAnalyze} disabled={loading}>
            {loading ? 'Analyzing...' : 'Analyze leaf'}
          </button>
          <p className="hint-text">Prediction first, treatment second, chat support after that.</p>
        </div>
      </div>

      <div className="card info-card orchard-card">
        <p className="section-kicker">What you get</p>
        <h3>Farmer workflow</h3>
        <ul className="feature-list">
          <li>Disease prediction from your deployed plant model</li>
          <li>Clear treatment and prevention advice from your AI agent</li>
          <li>Voice-friendly farmer chat for follow-up questions</li>
          <li>Multiple saved chats so farmers can continue old conversations</li>
        </ul>
        <div className="info-highlight">
          <span className="mini-chip">Plant friendly UI</span>
          <span className="mini-chip">Voice ready</span>
          <span className="mini-chip">Simple workflow</span>
        </div>
      </div>
    </section>
  )
}
