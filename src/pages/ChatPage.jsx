import { useEffect, useMemo, useRef, useState } from 'react'
import { chatWithFarmer, getOrCreateFarmerId } from '../lib/api'
import { getSpeechRecognition, speakText, stopSpeaking, supportsVoiceInput } from '../lib/voice'

const CHATS_KEY = 'farmerChatConversations'
const ACTIVE_CHAT_KEY = 'farmerChatActiveId'

function createChat(seedDisease = '') {
  return {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: seedDisease ? `${seedDisease} help` : 'New farmer chat',
    diseaseContext: seedDisease || '',
    sessionId: localStorage.getItem('bedrockSessionId') || '',
    messages: [
      {
        role: 'assistant',
        content:
          'Assalam-o-Alaikum. I am your plant disease assistant. Ask me about symptoms, treatment, prevention, sprays, or what to do next.',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function loadChats() {
  const raw = localStorage.getItem(CHATS_KEY)
  const diseaseContext = localStorage.getItem('chatDiseaseContext') || ''
  if (!raw) return [createChat(diseaseContext)]

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? parsed : [createChat(diseaseContext)]
  } catch {
    return [createChat(diseaseContext)]
  }
}

export default function ChatPage() {
  const voiceInputSupported = useMemo(() => supportsVoiceInput(), [])
  const [chats, setChats] = useState(loadChats)
  const [activeChatId, setActiveChatId] = useState(() => localStorage.getItem(ACTIVE_CHAT_KEY) || loadChats()[0].id)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [voiceOutput, setVoiceOutput] = useState(true)
  const [listening, setListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Tap the mic to start voice mode.')
  const [voiceText, setVoiceText] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const farmerId = useMemo(() => getOrCreateFarmerId(), [])
  const listRef = useRef(null)
  const recognitionRef = useRef(null)
  const shouldKeepListeningRef = useRef(false)

  const activeChat = chats.find((chat) => chat.id === activeChatId) || chats[0]
  const messages = activeChat?.messages || []

  useEffect(() => {
    if (!activeChat && chats.length) {
      setActiveChatId(chats[0].id)
    }
  }, [activeChat, chats])

  useEffect(() => {
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats))
  }, [chats])

  useEffect(() => {
    if (activeChatId) localStorage.setItem(ACTIVE_CHAT_KEY, activeChatId)
  }, [activeChatId])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, activeChatId])

  useEffect(() => () => {
    stopSpeaking()
    recognitionRef.current?.stop()
    shouldKeepListeningRef.current = false
  }, [])

  function updateActiveChat(updater) {
    setChats((currentChats) =>
      currentChats.map((chat) =>
        chat.id === activeChatId
          ? typeof updater === 'function'
            ? updater(chat)
            : { ...chat, ...updater }
          : chat
      )
    )
  }

  function createNewChat() {
    stopSpeaking()
    const seedDisease = localStorage.getItem('chatDiseaseContext') || ''
    const nextChat = createChat(seedDisease)
    setChats((current) => [nextChat, ...current])
    setActiveChatId(nextChat.id)
    setInput('')
    setVoiceText('')
    setVoiceStatus('New chat ready. Tap the mic or type your question.')
  }

  function selectChat(chatId) {
    stopSpeaking()
    setActiveChatId(chatId)
    setInput('')
    setVoiceText('')
  }

  function deleteChat(chatId) {
    const nextChats = chats.filter((chat) => chat.id !== chatId)
    if (!nextChats.length) {
      const fallback = createChat(localStorage.getItem('chatDiseaseContext') || '')
      setChats([fallback])
      setActiveChatId(fallback.id)
      return
    }
    setChats(nextChats)
    if (chatId === activeChatId) {
      setActiveChatId(nextChats[0].id)
    }
  }

  async function onSend(prefilledText) {
    const text = (prefilledText ?? input).trim()
    if (!text || loading || !activeChat) return

    shouldKeepListeningRef.current = false
    recognitionRef.current?.stop()
    setListening(false)
    setVoiceStatus('Question sent. Waiting for reply...')

    const nextMessages = [...activeChat.messages, { role: 'user', content: text }]
    const nextTitle = activeChat.title === 'New farmer chat' && text
      ? text.slice(0, 28) + (text.length > 28 ? '...' : '')
      : activeChat.title

    updateActiveChat((chat) => ({
      ...chat,
      title: nextTitle,
      messages: nextMessages,
      updatedAt: new Date().toISOString(),
    }))

    setInput('')
    setVoiceText('')
    setLoading(true)

    try {
      const result = await chatWithFarmer(text, activeChat.diseaseContext || undefined, activeChat.sessionId || undefined, farmerId)
      if (result.sessionId) {
        localStorage.setItem('bedrockSessionId', result.sessionId)
      }
      const assistantMessage = {
        role: 'assistant',
        content: result.answer,
        sources: result.sources || [],
      }
      updateActiveChat((chat) => ({
        ...chat,
        sessionId: result.sessionId || chat.sessionId,
        messages: [...nextMessages, assistantMessage],
        updatedAt: new Date().toISOString(),
      }))
      setVoiceStatus('Reply received.')
      if (voiceOutput) {
        setSpeaking(true)
        speakText(result.answer, {
          onEnd: () => setSpeaking(false),
          onError: () => setSpeaking(false),
        })
      }
    } catch (err) {
      updateActiveChat((chat) => ({
        ...chat,
        messages: [...nextMessages, { role: 'assistant', content: `Error: ${err.message}` }],
        updatedAt: new Date().toISOString(),
      }))
      setVoiceStatus('There was a problem sending the question.')
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  function stopVoiceInput(manual = true) {
    shouldKeepListeningRef.current = false
    recognitionRef.current?.stop()
    setListening(false)
    setVoiceStatus(manual ? 'Voice mode stopped.' : 'Voice mode paused.')
  }

  function startVoiceInput() {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setVoiceStatus('Voice input is not available in this browser.')
      return
    }

    stopSpeaking()
    setSpeaking(false)
    shouldKeepListeningRef.current = true

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setListening(true)
      setVoiceStatus('Mic is live. Speak when you are ready.')
    }

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim()
      setVoiceText(transcript)
      setInput(transcript)
      setVoiceStatus(transcript ? 'Listening... keep speaking or press send.' : 'Mic is live. Speak when you are ready.')
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        setVoiceStatus('Mic is still on. Start speaking when ready.')
        return
      }
      if (event.error === 'aborted') {
        setVoiceStatus('Voice mode stopped.')
        return
      }
      setVoiceStatus(`Voice error: ${event.error}`)
    }

    recognition.onend = () => {
      if (shouldKeepListeningRef.current) {
        setListening(false)
        setVoiceStatus('Mic is live. Waiting for your voice...')
        setTimeout(() => {
          if (shouldKeepListeningRef.current) {
            try {
              recognition.start()
            } catch {
              // ignore duplicate start attempts
            }
          }
        }, 250)
      } else {
        setListening(false)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      setVoiceStatus('Voice mode is already running.')
    }
  }

  return (
    <section className="chat-layout enhanced-chat-layout">
      <aside className="chat-sidebar card orchard-card">
        <div className="sidebar-top-row">
          <div>
            <p className="section-kicker">Farmer support</p>
            <h2>Voice and chat</h2>
          </div>
          <button className="primary-btn compact-btn" onClick={createNewChat}>New chat</button>
        </div>

        <p className="muted">
          Ask by text or voice. Keep separate conversations for different crops or diseases.
        </p>

        <label className="field-label">Disease context</label>
        <input
          className="text-input"
          value={activeChat?.diseaseContext || ''}
          onChange={(e) => {
            const value = e.target.value
            localStorage.setItem('chatDiseaseContext', value)
            updateActiveChat((chat) => ({ ...chat, diseaseContext: value, updatedAt: new Date().toISOString() }))
          }}
          placeholder="Optional disease name, e.g. Apple Brown_spot"
        />

        <div className="voice-panel">
          <div className="voice-panel-top">
            <label className="voice-toggle">
              <input
                type="checkbox"
                checked={voiceOutput}
                onChange={(e) => setVoiceOutput(e.target.checked)}
              />
              <span>Read assistant replies aloud</span>
            </label>
            <button className="ghost-btn small-btn" onClick={() => { stopSpeaking(); setSpeaking(false) }}>
              Stop audio
            </button>
          </div>

          <div className="mic-status-card">
            <button
              className={`mic-button ${listening ? 'active' : ''}`}
              onClick={listening ? () => stopVoiceInput(true) : startVoiceInput}
              disabled={!voiceInputSupported}
              type="button"
              aria-label={listening ? 'Stop voice mode' : 'Start voice mode'}
            >
              <span className="mic-rings" />
              <span className="mic-icon">🎙️</span>
            </button>
            <div>
              <strong>{listening ? 'Mic is on' : 'Tap mic to talk'}</strong>
              <p className="hint-text voice-status-text">
                {voiceInputSupported
                  ? voiceStatus
                  : 'Voice input is not supported in this browser. Use Chrome or Edge for best results.'}
              </p>
              {voiceText ? <p className="live-transcript">Live transcript: {voiceText}</p> : null}
            </div>
          </div>
        </div>

        <div className="chat-history-section">
          <div className="history-title-row">
            <h3>Chat history</h3>
            <span className="mini-chip neutral-chip">{chats.length} chats</span>
          </div>
          <div className="chat-history-list">
            {chats.map((chat) => (
              <button
                key={chat.id}
                className={`chat-history-item ${chat.id === activeChatId ? 'active' : ''}`}
                onClick={() => selectChat(chat.id)}
                type="button"
              >
                <div className="chat-history-copy">
                  <strong>{chat.title}</strong>
                  <span>{chat.diseaseContext || 'General plant help'}</span>
                </div>
                <span
                  className="chat-delete"
                  onClick={(event) => {
                    event.stopPropagation()
                    deleteChat(chat.id)
                  }}
                  role="button"
                  aria-label="Delete chat"
                >
                  ×
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="chat-window card leaf-panel">
        <div className="chat-header">
          <div>
            <p className="section-kicker">Step 4</p>
            <h2>Farmer chat assistant</h2>
          </div>
          <div className="chat-badges">
            <span className="mini-chip">Multiple chats</span>
            <span className="mini-chip">Voice input</span>
            <span className="mini-chip">Voice output</span>
          </div>
        </div>

        <div className="messages" ref={listRef}>
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`message-row ${message.role === 'user' ? 'user' : 'assistant'}`}
            >
              <div className="message-bubble">
                <p>{message.content}</p>
                {message.sources?.length ? (
                  <ul className="source-list-inline">
                    {message.sources.map((source, srcIndex) => (
                      <li key={`${source.title || 'src'}-${srcIndex}`}>
                        {source.uri ? (
                          <a href={source.uri} target="_blank" rel="noreferrer">
                            {source.title || source.uri}
                          </a>
                        ) : (
                          source.title || 'Knowledge source'
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="message-row assistant">
              <div className="message-bubble loading-bubble">Thinking...</div>
            </div>
          ) : null}
        </div>

        <div className="composer">
          <textarea
            rows="3"
            className="composer-input"
            placeholder="Ask about treatment, symptoms, prevention, sprays, watering, pruning, or crop safety..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="composer-actions three-actions">
            <button className={`secondary-btn voice-pill ${listening ? 'voice-live' : ''}`} onClick={listening ? () => stopVoiceInput(true) : startVoiceInput} disabled={!voiceInputSupported}>
              {listening ? 'Mic on' : 'Voice'}
            </button>
            <button className="ghost-btn" onClick={() => { stopSpeaking(); setSpeaking(false) }}>
              {speaking ? 'Stop reply' : 'Audio'}
            </button>
            <button className="primary-btn" onClick={() => onSend()} disabled={loading}>
              Send
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
