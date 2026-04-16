const API_URL = import.meta.env.VITE_API_URL?.trim()
const FARMER_ID_KEY = 'farmerId'

function ensureApiUrl() {
  if (!API_URL) {
    throw new Error(
      'Backend is not connected. Create frontend/.env, set VITE_API_URL to your Lambda Function URL, then restart npm run dev.'
    )
  }
}

export function getOrCreateFarmerId() {
  const existing = localStorage.getItem(FARMER_ID_KEY)?.trim()
  if (existing) return existing

  const generated = `farmer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  localStorage.setItem(FARMER_ID_KEY, generated)
  return generated
}

async function callApi(payload) {
  ensureApiUrl()

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const raw = await res.text()
  let data = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    throw new Error(raw || 'Backend returned invalid JSON')
  }

  if (!res.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data
}

export async function checkBackendHealth() {
  ensureApiUrl()

  const res = await fetch(API_URL, {
    method: 'GET',
  })

  const raw = await res.text()
  let data = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    throw new Error(raw || 'Backend health check returned invalid JSON')
  }

  if (!res.ok) {
    throw new Error(data.error || 'Backend health check failed')
  }
  return data
}

export async function predictDisease(base64Image) {
  return callApi({ action: 'predict', image: base64Image })
}

export async function getTreatment(disease, sessionId, farmerId = getOrCreateFarmerId()) {
  return callApi({ action: 'treatment', disease, sessionId, farmerId })
}

export async function chatWithFarmer(
  message,
  diseaseContext,
  sessionId,
  farmerId = getOrCreateFarmerId()
) {
  return callApi({ action: 'chat', message, diseaseContext, sessionId, farmerId })
}

export async function submitFeedback(payload) {
  return callApi({ action: 'feedback', farmerId: getOrCreateFarmerId(), ...payload })
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = String(reader.result).split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
