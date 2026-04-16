export function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export function supportsVoiceInput() {
  return Boolean(getSpeechRecognition())
}

export function speakText(text, options = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) {
    return null
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = options.rate ?? 1
  utterance.pitch = options.pitch ?? 1
  utterance.lang = options.lang ?? 'en-US'

  const voices = window.speechSynthesis.getVoices?.() || []
  const preferredVoice = voices.find((voice) =>
    /ur|en/i.test(`${voice.lang} ${voice.name}`)
  )
  if (preferredVoice) {
    utterance.voice = preferredVoice
  }

  if (typeof options.onEnd === 'function') utterance.onend = options.onEnd
  if (typeof options.onError === 'function') utterance.onerror = options.onError

  window.speechSynthesis.speak(utterance)
  return utterance
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}
