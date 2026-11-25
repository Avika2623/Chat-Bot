import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  Check,
  Copy,
  Orbit,
  Radio,
  Square,
  Telescope,
} from 'lucide-react';
import type { ChatMessage, ChatSettings } from '../types';
import { MarkdownContent } from './MarkdownContent';

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  settings: ChatSettings;
  isGenerating: boolean;
  apiKeyConfigured: boolean | null;
  globalError: string | null;
  onDismissError: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
}

const STARTER_PROMPTS = [
  {
    title: 'Orbital Mechanics',
    prompt: 'Explain how a Hohmann transfer orbit works and why launch windows matter for Mars.',
  },
  {
    title: 'James Webb Optics',
    prompt: 'Why does the James Webb Space Telescope observe in infrared rather than visible light?',
  },
  {
    title: 'Fast Code Review',
    prompt: 'Write a clean TypeScript exponential backoff retry helper with AbortSignal support.',
  },
  {
    title: 'Exoplanet Telemetry',
    prompt: 'Summarize the transit photometry method for detecting exoplanets in 4 bullet points.',
  },
];

export function ChatWorkspace({
  messages,
  settings,
  isGenerating,
  apiKeyConfigured,
  globalError,
  onDismissError,
  onSend,
  onStop,
}: ChatWorkspaceProps) {
  const [draft, setDraft] = useState('');
  const [validationNotice, setValidationNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const userScrolledUpRef = useRef(false);

  // Auto-resize composer textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  // Smart auto-scroll unless the user scrolled up to read earlier messages
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || userScrolledUpRef.current) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    userScrolledUpRef.current = distanceFromBottom > 80;
  };

  const submitMessage = () => {
    if (isGenerating) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      setValidationNotice('Enter a message before transmitting.');
      return;
    }
    setValidationNotice(null);
    userScrolledUpRef.current = false;
    setDraft('');
    onSend(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  };

  const copyResponse = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="chat-pane">
      {/* Banner alerts */}
      {apiKeyConfigured === false ? (
        <div
          role="status"
          style={{
            margin: '12px 18px 0',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(251, 191, 36, 0.35)',
            background: 'rgba(120, 53, 15, 0.22)',
            color: '#fde68a',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
          }}
        >
          <AlertTriangle size={16} color="#fbbf24" style={{ flexShrink: 0 }} />
          <span>
            Server API key missing. Set <code style={{ fontFamily: 'var(--font-mono)' }}>GROQ_API_KEY</code> in
            your environment or untracked <code style={{ fontFamily: 'var(--font-mono)' }}>.env</code> file and
            restart the server.
          </span>
        </div>
      ) : null}

      {globalError ? (
        <div
          role="alert"
          style={{
            margin: '12px 18px 0',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(251, 113, 133, 0.4)',
            background: 'rgba(136, 19, 55, 0.25)',
            color: '#fecdd3',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} color="#fb7185" style={{ flexShrink: 0 }} />
            <span>{globalError}</span>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            className="btn-ghost"
            style={{ padding: '2px 8px', fontSize: '12px' }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Scrollable message history */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 18px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '840px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            flex: 1,
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                margin: 'auto 0',
                padding: '28px 12px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '18px',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  background:
                    'radial-gradient(circle at 30% 30%, rgba(56, 189, 248, 0.22), rgba(15, 23, 42, 0.9))',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 0 28px rgba(56, 189, 248, 0.14)',
                }}
              >
                <Telescope size={26} color="#38bdf8" />
              </div>

              <div>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '24px',
                    fontWeight: 600,
                    margin: '0 0 6px',
                    color: '#f8fafc',
                  }}
                >
                  Deep-Space Inference Link Ready
                </h2>
                <p
                  style={{
                    margin: 0,
                    color: 'var(--text-muted)',
                    fontSize: '14px',
                    maxWidth: '500px',
                  }}
                >
                  Tune your model, temperature, token cap, and system prompt in the parameters panel, then
                  transmit a prompt below.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '10px',
                  width: '100%',
                  maxWidth: '680px',
                  marginTop: '6px',
                }}
              >
                {STARTER_PROMPTS.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => {
                      userScrolledUpRef.current = false;
                      onSend(item.prompt);
                    }}
                    disabled={isGenerating}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-subtle)',
                      background: 'rgba(13, 22, 48, 0.72)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, background 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--accent-cyan)',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {item.title}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      {item.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <article
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'stretch',
                  }}
                >
                  <div
                    style={{
                      maxWidth: isUser ? 'min(82%, 640px)' : '100%',
                      borderRadius: isUser ? '14px 14px 4px 14px' : '14px',
                      padding: isUser ? '11px 15px' : '14px 16px',
                      border: isUser
                        ? '1px solid rgba(56, 189, 248, 0.34)'
                        : msg.status === 'error'
                          ? '1px solid rgba(251, 113, 133, 0.42)'
                          : '1px solid var(--border-subtle)',
                      background: isUser
                        ? 'linear-gradient(135deg, rgba(14, 116, 144, 0.28), rgba(55, 48, 163, 0.32))'
                        : 'rgba(11, 18, 40, 0.86)',
                    }}
                  >
                    {/* Header row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        marginBottom: '7px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: isUser ? '#7dd3fc' : '#a5b4fc',
                          }}
                        >
                          {isUser ? 'Commander' : 'Apogee'}
                        </span>
                        {!isUser && msg.model ? (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {msg.model}
                          </span>
                        ) : null}
                        {msg.status === 'streaming' || msg.status === 'loading' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--accent-cyan)',
                            }}
                          >
                            <Radio size={12} className="orbital-pulse-dot" />
                            {msg.status === 'loading' ? 'Awaiting first signal...' : 'Streaming...'}
                          </span>
                        ) : null}
                        {msg.status === 'stopped' ? (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--accent-amber)',
                            }}
                          >
                            Stopped
                          </span>
                        ) : null}
                      </div>

                      {!isUser && msg.content ? (
                        <button
                          type="button"
                          onClick={() => copyResponse(msg.id, msg.content)}
                          className="btn-ghost"
                          style={{ padding: '3px 8px', fontSize: '11.5px' }}
                          title="Copy full response"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check size={12} color="var(--accent-emerald)" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              Copy
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>

                    {/* Message content */}
                    {isUser ? (
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: '14.5px', lineHeight: 1.6 }}>
                        {msg.content}
                      </div>
                    ) : msg.status === 'loading' && !msg.content && !msg.reasoning ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          color: 'var(--text-muted)',
                          fontSize: '13.5px',
                          padding: '4px 0',
                        }}
                      >
                        <Orbit size={16} color="var(--accent-cyan)" className="orbital-pulse-dot" />
                        <span>Establishing telemetry with {msg.model ?? settings.model}...</span>
                      </div>
                    ) : msg.status === 'error' && !msg.content && !msg.reasoning ? (
                      <div style={{ color: '#fda4af', fontSize: '13.5px' }}>
                        {msg.errorText || 'Failed to receive response.'}
                      </div>
                    ) : (
                      <>
                        <MarkdownContent content={msg.content} reasoning={msg.reasoning} />
                        {!msg.content && msg.reasoning && msg.status === 'done' ? (
                          <div
                            style={{
                              marginTop: '8px',
                              fontSize: '12.5px',
                              color: 'var(--text-muted)',
                            }}
                          >
                            Response reached the token limit during reasoning. Increase Max Response Tokens to see the final answer.
                          </div>
                        ) : null}
                        {msg.errorText ? (
                          <div
                            style={{
                              marginTop: '10px',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              background: 'rgba(136, 19, 55, 0.25)',
                              border: '1px solid rgba(251, 113, 133, 0.35)',
                              color: '#fecdd3',
                              fontSize: '12.5px',
                            }}
                          >
                            {msg.errorText}
                          </div>
                        ) : null}
                      </>
                    )}

                    {/* Telemetry footer */}
                    {!isUser && (msg.latencyMs || msg.usage?.totalTokens) ? (
                      <div
                        style={{
                          marginTop: '10px',
                          paddingTop: '8px',
                          borderTop: '1px solid rgba(148, 163, 184, 0.12)',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '12px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {msg.latencyMs ? <span>{(msg.latencyMs / 1000).toFixed(2)}s</span> : null}
                        {msg.usage?.completionTokens !== undefined ? (
                          <span>{msg.usage.completionTokens} output tokens</span>
                        ) : null}
                        {msg.usage?.promptTokens !== undefined ? (
                          <span>{msg.usage.promptTokens} prompt tokens</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Composer */}
      <div
        style={{
          padding: '12px 18px 16px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(6, 11, 28, 0.82)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ maxWidth: '840px', margin: '0 auto' }}>
          {validationNotice ? (
            <div
              role="status"
              style={{
                marginBottom: '8px',
                fontSize: '12.5px',
                color: '#fde68a',
              }}
            >
              {validationNotice}
            </div>
          ) : null}

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '14px',
              border: '1px solid rgba(148, 163, 184, 0.24)',
              background: 'rgba(10, 17, 38, 0.94)',
              boxShadow: '0 8px 24px rgba(2, 6, 23, 0.45)',
            }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (validationNotice) setValidationNotice(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Transmit a message... (Shift+Enter for new line)"
              aria-label="Message prompt"
              style={{
                flex: 1,
                resize: 'none',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14.5px',
                lineHeight: 1.5,
                maxHeight: '200px',
                padding: '4px 2px',
              }}
            />

            {isGenerating ? (
              <button type="button" onClick={onStop} className="btn-stop">
                <Square size={14} fill="currentColor" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={submitMessage}
                disabled={!draft.trim()}
                className="btn-primary"
                aria-label="Send message"
              >
                <ArrowUp size={16} />
                Send
              </button>
            )}
          </div>

          <div
            style={{
              marginTop: '7px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            <span>Enter to send · Shift+Enter for newline</span>
            <span>
              {settings.model} · temp {settings.temperature.toFixed(2)} · max{' '}
              {settings.maxCompletionTokens} · {settings.stream ? 'stream on' : 'stream off'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
