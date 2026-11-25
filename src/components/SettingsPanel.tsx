import { RefreshCw, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import type { ChatSettings, ModelOption } from '../types';

interface SettingsPanelProps {
  settings: ChatSettings;
  onChange: (next: Partial<ChatSettings>) => void;
  onReset: () => void;
  models: ModelOption[];
  modelsLoading: boolean;
  modelsError: string | null;
  usingFallbackModels: boolean;
  onRefreshModels: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

const SYSTEM_PRESETS = [
  {
    label: 'Balanced',
    prompt: 'You are a helpful, accurate, and clear AI assistant. Be concise unless asked for depth.',
  },
  {
    label: 'Astrophysics',
    prompt:
      'You are an astrophysics and orbital mechanics guide. Explain cosmic phenomena clearly with physical intuition and precise units.',
  },
  {
    label: 'Code Copilot',
    prompt:
      'You are a senior software engineer. Provide clean, production-grade code, explain edge cases concisely, and verify assumptions.',
  },
  {
    label: 'JSON Only',
    prompt: 'Respond strictly with valid JSON matching the user request. Do not include markdown fences or extra prose.',
  },
];

export function SettingsPanel({
  settings,
  onChange,
  onReset,
  models,
  modelsLoading,
  modelsError,
  usingFallbackModels,
  onRefreshModels,
  isOpenMobile,
  onCloseMobile,
}: SettingsPanelProps) {
  const categories = Array.from(new Set(models.map((m) => m.category)));

  return (
    <aside
      className={`settings-pane ${isOpenMobile ? 'open' : ''}`}
      aria-label="Inference parameters"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SlidersHorizontal size={15} color="var(--accent-cyan)" />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              fontWeight: 600,
            }}
          >
            Parameters
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={onReset}
            title="Restore default parameters"
            style={{ padding: '4px 8px', fontSize: '12px' }}
          >
            <RotateCcw size={13} />
            Reset
          </button>
          <button
            type="button"
            className="btn-ghost mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="Close parameters panel"
            style={{ padding: '4px 8px' }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Model selection */}
        <section>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}
          >
            <label
              htmlFor="model-select"
              style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}
            >
              Model
            </label>
            <button
              type="button"
              onClick={onRefreshModels}
              disabled={modelsLoading}
              className="btn-ghost"
              style={{ padding: '3px 7px', fontSize: '11px' }}
              title="Refresh model list from Groq API"
            >
              <RefreshCw size={11} className={modelsLoading ? 'orbital-pulse-dot' : undefined} />
              {modelsLoading ? 'Syncing' : 'Sync'}
            </button>
          </div>

          <select
            id="model-select"
            value={settings.model}
            onChange={(e) => onChange({ model: e.target.value })}
            style={{
              width: '100%',
              padding: '9px 10px',
              borderRadius: '9px',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(6, 11, 28, 0.92)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12.5px',
            }}
          >
            {categories.map((cat) => (
              <optgroup key={cat} label={cat}>
                {models
                  .filter((m) => m.category === cat)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>

          <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            {usingFallbackModels
              ? 'Using fallback list; connect server key to load live catalog.'
              : `Populated live from Groq (${models.length} chat models).`}
          </p>
          {modelsError ? (
            <p
              style={{
                margin: '6px 0 0',
                fontSize: '12px',
                color: '#fda4af',
                background: 'rgba(190, 18, 60, 0.14)',
                border: '1px solid rgba(251, 113, 133, 0.28)',
                borderRadius: '7px',
                padding: '6px 8px',
              }}
            >
              {modelsError}
            </p>
          ) : null}
        </section>

        {/* System prompt */}
        <section>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}
          >
            <label
              htmlFor="system-prompt"
              style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}
            >
              System Prompt
            </label>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
              {settings.systemPrompt.length} chars
            </span>
          </div>

          <textarea
            id="system-prompt"
            rows={4}
            value={settings.systemPrompt}
            onChange={(e) => onChange({ systemPrompt: e.target.value })}
            placeholder="Define assistant role, tone, or output format..."
            style={{
              width: '100%',
              resize: 'vertical',
              padding: '9px 10px',
              borderRadius: '9px',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(6, 11, 28, 0.9)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              lineHeight: 1.5,
            }}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '7px' }}>
            {SYSTEM_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="btn-ghost"
                onClick={() => onChange({ systemPrompt: preset.prompt })}
                style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '999px' }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Sets guiding instructions prepended to every turn in this chat.
          </p>
        </section>

        {/* Temperature */}
        <section>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}
          >
            <label
              htmlFor="temperature-slider"
              style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}
            >
              Temperature
            </label>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--accent-cyan)',
                background: 'rgba(56, 189, 248, 0.12)',
                padding: '2px 7px',
                borderRadius: '6px',
              }}
            >
              {settings.temperature.toFixed(2)}
            </span>
          </div>
          <input
            id="temperature-slider"
            className="astro-slider"
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={settings.temperature}
            onChange={(e) => onChange({ temperature: Number.parseFloat(e.target.value) })}
          />
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Controls randomness. Lower values are deterministic; higher values explore creative options.
          </p>
        </section>

        {/* Maximum response tokens */}
        <section>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}
          >
            <label
              htmlFor="max-tokens-slider"
              style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}
            >
              Max Response Tokens
            </label>
            <input
              aria-label="Max response tokens value"
              type="number"
              min={64}
              max={32768}
              step={64}
              value={settings.maxCompletionTokens}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(parsed)) {
                  onChange({ maxCompletionTokens: Math.min(32768, Math.max(1, parsed)) });
                }
              }}
              style={{
                width: '78px',
                textAlign: 'right',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--accent-cyan)',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '6px',
                padding: '2px 6px',
              }}
            />
          </div>
          <input
            id="max-tokens-slider"
            className="astro-slider"
            type="range"
            min={64}
            max={8192}
            step={64}
            value={Math.min(8192, settings.maxCompletionTokens)}
            onChange={(e) => onChange({ maxCompletionTokens: Number.parseInt(e.target.value, 10) })}
          />
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Maximum tokens generated per reply (up to 32,768 via numeric input).
          </p>
        </section>

        {/* Top-p */}
        <section>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}
          >
            <label
              htmlFor="top-p-slider"
              style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}
            >
              Top-p
            </label>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--accent-cyan)',
                background: 'rgba(56, 189, 248, 0.12)',
                padding: '2px 7px',
                borderRadius: '6px',
              }}
            >
              {settings.topP.toFixed(2)}
            </span>
          </div>
          <input
            id="top-p-slider"
            className="astro-slider"
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={settings.topP}
            onChange={(e) => onChange({ topP: Number.parseFloat(e.target.value) })}
          />
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Nucleus sampling. Restricts token selection to the top cumulative probability mass.
          </p>
        </section>

        {/* Streaming toggle */}
        <section
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            background: 'rgba(6, 11, 28, 0.65)',
          }}
        >
          <div>
            <label
              htmlFor="streaming-toggle"
              style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              Stream Responses
            </label>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Display tokens incrementally as they arrive instead of waiting for completion.
            </p>
          </div>
          <button
            id="streaming-toggle"
            type="button"
            role="switch"
            aria-checked={settings.stream}
            onClick={() => onChange({ stream: !settings.stream })}
            style={{
              position: 'relative',
              flexShrink: 0,
              width: '44px',
              height: '24px',
              borderRadius: '999px',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              background: settings.stream ? 'var(--accent-cyan)' : 'rgba(30, 41, 59, 0.9)',
              cursor: 'pointer',
              padding: 0,
              transition: 'background 0.15s ease',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '2px',
                left: settings.stream ? '22px' : '2px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: settings.stream ? '#040712' : '#cbd5e1',
                transition: 'left 0.15s ease',
              }}
            />
          </button>
        </section>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .mobile-close-btn { display: none !important; }
        }
      `}</style>
    </aside>
  );
}
