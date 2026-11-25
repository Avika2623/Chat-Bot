import { useCallback, useEffect, useRef, useState } from 'react';
import {
  History,
  MessageSquarePlus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ChatWorkspace } from './components/ChatWorkspace';
import { SettingsPanel } from './components/SettingsPanel';
import { Starfield } from './components/Starfield';
import type {
  ApiErrorPayload,
  ChatMessage,
  ChatSession,
  ChatSettings,
  HealthResponse,
  ModelOption,
  TokenUsage,
} from './types';

const DEFAULT_SETTINGS: ChatSettings = {
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxCompletionTokens: 2048,
  topP: 1,
  systemPrompt:
    'You are a helpful, accurate, and clear AI assistant. Be concise unless asked for depth.',
  stream: true,
};

const FALLBACK_MODELS: ModelOption[] = [
  { id: 'llama-3.3-70b-versatile', ownedBy: 'Meta', category: 'Meta Llama' },
  { id: 'llama-3.1-8b-instant', ownedBy: 'Meta', category: 'Meta Llama' },
  { id: 'openai/gpt-oss-120b', ownedBy: 'OpenAI', category: 'Flagship' },
  { id: 'openai/gpt-oss-20b', ownedBy: 'OpenAI', category: 'Flagship' },
  { id: 'qwen/qwen3-32b', ownedBy: 'Alibaba', category: 'Reasoning & Qwen' },
];

const STORAGE_SETTINGS_KEY = 'apogee.settings.v1';
const STORAGE_SESSIONS_KEY = 'apogee.sessions.v1';
const STORAGE_MOTION_KEY = 'apogee.reducedMotion.v1';

function createId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptySession(): ChatSession {
  return {
    id: createId(),
    title: 'New transmission',
    updatedAt: Date.now(),
    messages: [],
  };
}

function loadSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<ChatSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
    if (!raw) return [createEmptySession()];
    const parsed = JSON.parse(raw) as ChatSession[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [createEmptySession()];
  } catch {
    return [createEmptySession()];
  }
}

function loadReducedMotion(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_MOTION_KEY);
    if (saved !== null) return saved === 'true';
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

export function App() {
  const [settings, setSettings] = useState<ChatSettings>(loadSettings);
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => loadSessions()[0].id);
  const [reducedMotion, setReducedMotion] = useState<boolean>(loadReducedMotion);

  const [models, setModels] = useState<ModelOption[]>(FALLBACK_MODELS);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [usingFallbackModels, setUsingFallbackModels] = useState(true);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [desktopSettingsVisible, setDesktopSettingsVisible] = useState(true);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [sessionsMenuOpen, setSessionsMenuOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? sessions[0] ?? createEmptySession();

  // Persist reduced-motion preference and apply DOM attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-reduced-motion', String(reducedMotion));
    try {
      localStorage.setItem(STORAGE_MOTION_KEY, String(reducedMotion));
    } catch {
      // Ignore storage quota errors
    }
  }, [reducedMotion]);

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }, [settings]);

  // Persist sessions (strip transient loading/streaming flags)
  useEffect(() => {
    try {
      const serializable = sessions.slice(0, 20).map((session) => ({
        ...session,
        messages: session.messages.map((m) => ({
          ...m,
          status: m.status === 'streaming' || m.status === 'loading' ? 'done' : m.status,
        })),
      }));
      localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(serializable));
    } catch {
      // Ignore storage errors
    }
  }, [sessions]);

  const fetchModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const res = await fetch('/api/models');
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as ApiErrorPayload | null;
        throw new Error(payload?.error?.message ?? `Failed to load models (HTTP ${res.status})`);
      }
      const data = (await res.json()) as { models?: ModelOption[] };
      if (Array.isArray(data.models) && data.models.length > 0) {
        setModels(data.models);
        setUsingFallbackModels(false);
        setSettings((prev) => {
          const exists = data.models!.some((m) => m.id === prev.model);
          return exists ? prev : { ...prev, model: data.models![0].id };
        });
      }
    } catch (err) {
      setUsingFallbackModels(true);
      setModelsError(err instanceof Error ? err.message : 'Could not fetch live models.');
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<HealthResponse>)
      .then((data) => setApiKeyConfigured(data.apiKeyConfigured))
      .catch(() => setApiKeyConfigured(null));

    void fetchModels();
  }, [fetchModels]);

  const updateSettings = (patch: Partial<ChatSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const updateActiveMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[], maybeTitle?: string) => {
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== activeSession.id) return session;
          const nextMessages = updater(session.messages);
          return {
            ...session,
            title: maybeTitle ?? session.title,
            updatedAt: Date.now(),
            messages: nextMessages,
          };
        })
      );
    },
    [activeSession.id]
  );

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleNewChat = () => {
    if (isGenerating) handleStop();
    const fresh = createEmptySession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setGlobalError(null);
    setSessionsMenuOpen(false);
  };

  const handleClearChat = () => {
    if (isGenerating) handleStop();
    updateActiveMessages(() => [], 'New transmission');
    setGlobalError(null);
  };

  const handleSend = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isGenerating) return;

    setGlobalError(null);
    const userMsg: ChatMessage = {
      id: createId(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
      status: 'done',
    };

    const assistantId = createId();
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      reasoning: '',
      createdAt: Date.now(),
      model: settings.model,
      status: 'loading',
    };

    const historyForRequest = [...activeSession.messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const derivedTitle =
      activeSession.messages.length === 0
        ? trimmed.slice(0, 42) + (trimmed.length > 42 ? '…' : '')
        : undefined;

    updateActiveMessages((prev) => [...prev, userMsg, assistantPlaceholder], derivedTitle);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);
    const startedAt = performance.now();

    const patchAssistant = (patch: Partial<ChatMessage>) => {
      updateActiveMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m))
      );
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: settings.model,
          messages: historyForRequest,
          systemPrompt: settings.systemPrompt,
          temperature: settings.temperature,
          maxCompletionTokens: settings.maxCompletionTokens,
          topP: settings.topP,
          stream: settings.stream,
        }),
      });

      if (!response.ok) {
        const errPayload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
        const message =
          errPayload?.error?.message ?? `Request failed with status ${response.status}.`;
        patchAssistant({ status: 'error', errorText: message });
        setGlobalError(message);
        return;
      }

      if (!settings.stream) {
        const data = (await response.json()) as {
          content?: string;
          reasoning?: string;
          model?: string;
          usage?: TokenUsage;
        };
        patchAssistant({
          content: data.content ?? '',
          reasoning: data.reasoning ?? '',
          model: data.model ?? settings.model,
          usage: data.usage,
          latencyMs: Math.round(performance.now() - startedAt),
          status: 'done',
        });
        return;
      }

      // SSE Streaming mode
      if (!response.body) {
        throw new Error('Streaming response body was empty.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accContent = '';
      let accReasoning = '';
      let finalUsage: TokenUsage | undefined;
      let streamError: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const rawEvent of events) {
          const dataLine = rawEvent
            .split('\n')
            .find((line) => line.startsWith('data:'));
          if (!dataLine) continue;

          try {
            const evt = JSON.parse(dataLine.slice(5).trim()) as {
              type: 'delta' | 'usage' | 'done' | 'error';
              content?: string;
              reasoning?: string;
              usage?: TokenUsage;
              error?: { message?: string };
            };

            if (evt.type === 'delta') {
              accContent += evt.content ?? '';
              accReasoning += evt.reasoning ?? '';
              patchAssistant({
                content: accContent,
                reasoning: accReasoning,
                status: 'streaming',
              });
            } else if (evt.type === 'usage' && evt.usage) {
              finalUsage = evt.usage;
            } else if (evt.type === 'error') {
              streamError = evt.error?.message ?? 'Stream interrupted.';
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }

      patchAssistant({
        content: accContent,
        reasoning: accReasoning,
        usage: finalUsage,
        latencyMs: Math.round(performance.now() - startedAt),
        status: streamError ? 'error' : 'done',
        ...(streamError ? { errorText: streamError } : {}),
      });

      if (streamError) {
        setGlobalError(streamError);
      }
    } catch (err) {
      const elapsed = Math.round(performance.now() - startedAt);
      if (err instanceof Error && err.name === 'AbortError') {
        patchAssistant({ status: 'stopped', latencyMs: elapsed });
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : 'Network error while communicating with the server.';
        patchAssistant({ status: 'error', errorText: msg, latencyMs: elapsed });
        setGlobalError(msg);
      }
    } finally {
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-shell">
      <Starfield reducedMotion={reducedMotion} />

      <header className="top-bar">
        <div className="brand-group">
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              border: '1px solid rgba(56, 189, 248, 0.42)',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(79, 70, 229, 0.28))',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4" fill="#38bdf8" />
              <ellipse
                cx="12"
                cy="12"
                rx="10"
                ry="4.5"
                transform="rotate(-24 12 12)"
                stroke="#a5b4fc"
                strokeWidth="1.6"
              />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 className="brand-title">APOGEE</h1>
            <span className="brand-subtitle">ORBITAL AI CONSOLE</span>
          </div>

          <span className="telemetry-pill" title={settings.model}>
            {settings.model}
          </span>
        </div>

        <div className="header-actions">
          {/* Session history switcher */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className={`btn-ghost ${sessionsMenuOpen ? 'active' : ''}`}
              onClick={() => setSessionsMenuOpen((v) => !v)}
              title="Switch conversation"
            >
              <History size={14} />
              <span className="hide-sm">Chats ({sessions.length})</span>
            </button>
            {sessionsMenuOpen ? (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  width: '260px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  borderRadius: '11px',
                  border: '1px solid var(--border-subtle)',
                  background: 'rgba(8, 14, 34, 0.97)',
                  boxShadow: '0 14px 34px rgba(2, 6, 23, 0.75)',
                  padding: '6px',
                  zIndex: 50,
                }}
              >
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (isGenerating) handleStop();
                      setActiveSessionId(s.id);
                      setSessionsMenuOpen(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      background:
                        s.id === activeSession.id ? 'rgba(56, 189, 248, 0.14)' : 'transparent',
                      color: s.id === activeSession.id ? '#7dd3fc' : 'var(--text-secondary)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.title}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', opacity: 0.7 }}>
                      {s.messages.length}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button type="button" className="btn-ghost" onClick={handleNewChat} title="Start a new chat">
            <MessageSquarePlus size={14} />
            <span className="hide-sm">New Chat</span>
          </button>

          <button
            type="button"
            className="btn-ghost"
            onClick={handleClearChat}
            disabled={activeSession.messages.length === 0 && !isGenerating}
            title="Clear current chat"
          >
            <Trash2 size={14} />
            <span className="hide-sm">Clear</span>
          </button>

          <button
            type="button"
            className={`btn-ghost ${reducedMotion ? 'active' : ''}`}
            onClick={() => setReducedMotion((prev) => !prev)}
            aria-pressed={reducedMotion}
            title="Toggle reduced motion"
          >
            <Sparkles size={14} />
            <span className="hide-md">{reducedMotion ? 'Static Sky' : 'Motion'}</span>
          </button>

          {/* Desktop toggle */}
          <button
            type="button"
            className={`btn-ghost desktop-only-btn ${desktopSettingsVisible ? 'active' : ''}`}
            onClick={() => setDesktopSettingsVisible((prev) => !prev)}
            title="Toggle parameters panel"
          >
            <SlidersHorizontal size={14} />
            <span>Parameters</span>
          </button>

          {/* Mobile toggle */}
          <button
            type="button"
            className={`btn-ghost mobile-only-btn ${mobileSettingsOpen ? 'active' : ''}`}
            onClick={() => setMobileSettingsOpen((prev) => !prev)}
            title="Open parameters panel"
          >
            <SlidersHorizontal size={14} />
            <span className="hide-sm">Parameters</span>
          </button>
        </div>
      </header>

      <main className="workspace-grid">
        <ChatWorkspace
          messages={activeSession.messages}
          settings={settings}
          isGenerating={isGenerating}
          apiKeyConfigured={apiKeyConfigured}
          globalError={globalError}
          onDismissError={() => setGlobalError(null)}
          onSend={handleSend}
          onStop={handleStop}
        />

        {mobileSettingsOpen ? (
          <div
            className="drawer-backdrop"
            onClick={() => setMobileSettingsOpen(false)}
            aria-hidden="true"
          />
        ) : null}

        {desktopSettingsVisible || mobileSettingsOpen ? (
          <div className={desktopSettingsVisible ? 'settings-wrapper' : 'settings-wrapper mobile-only-drawer'}>
            <SettingsPanel
              settings={settings}
              onChange={updateSettings}
              onReset={() => setSettings(DEFAULT_SETTINGS)}
              models={models}
              modelsLoading={modelsLoading}
              modelsError={modelsError}
              usingFallbackModels={usingFallbackModels}
              onRefreshModels={() => void fetchModels()}
              isOpenMobile={mobileSettingsOpen}
              onCloseMobile={() => setMobileSettingsOpen(false)}
            />
          </div>
        ) : null}
      </main>

      <style>{`
        .settings-wrapper {
          display: flex;
          min-height: 0;
        }
        @media (max-width: 1023px) {
          .desktop-only-btn { display: none !important; }
          .settings-wrapper { display: contents; }
        }
        @media (min-width: 1024px) {
          .mobile-only-btn { display: none !important; }
          .mobile-only-drawer { display: none !important; }
        }
        @media (max-width: 640px) {
          .hide-sm { display: none !important; }
          .telemetry-pill { display: none !important; }
        }
        @media (max-width: 860px) {
          .hide-md { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export default App;
