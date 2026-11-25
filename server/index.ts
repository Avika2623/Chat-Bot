import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import {
  extractUsage,
  fetchGroqModels,
  getServerApiKey,
  GroqServiceError,
  requestGroqCompletion,
  type ChatRequestInput,
} from './groq.js';

// Load .env without overwriting existing environment variables (e.g. Antigravity secrets)
dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const IS_PROD = process.env.NODE_ENV === 'production';
const PORT = Number.parseInt(process.env.PORT ?? '3000', 10) || 3000;

function sendSafeError(res: Response, err: unknown) {
  if (err instanceof GroqServiceError) {
    if (!res.headersSent) {
      res.status(err.status).json(err.toJSON());
    }
    return;
  }
  const fallback = new GroqServiceError(
    500,
    'UPSTREAM_ERROR',
    'An unexpected server error occurred. Please try again.'
  );
  if (!res.headersSent) {
    res.status(500).json(fallback.toJSON());
  }
}

function writeSseEvent(res: Response, data: unknown) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function streamGroqResponse(
  upstream: globalThis.Response,
  res: Response,
  abortController: AbortController
) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (!upstream.body) {
    writeSseEvent(res, {
      type: 'error',
      error: { code: 'UPSTREAM_ERROR', message: 'No response stream received from Groq.' },
    });
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payloadText = line.slice(5).trim();

        if (payloadText === '[DONE]') {
          writeSseEvent(res, { type: 'done' });
          continue;
        }

        try {
          const parsed = JSON.parse(payloadText) as {
            choices?: Array<{
              delta?: { content?: string; reasoning?: string };
              finish_reason?: string | null;
            }>;
            usage?: Record<string, unknown>;
            x_groq?: { usage?: Record<string, unknown>; error?: string };
            error?: { message?: string; code?: string };
          };

          if (parsed.error) {
            writeSseEvent(res, {
              type: 'error',
              error: {
                code: 'UPSTREAM_ERROR',
                message: parsed.error.message ?? 'Streaming interrupted by model provider.',
              },
            });
            continue;
          }

          const choice = parsed.choices?.[0];
          const delta = choice?.delta?.content ?? '';
          const reasoningDelta = choice?.delta?.reasoning ?? '';
          const usage = extractUsage(parsed.x_groq?.usage ?? parsed.usage);

          if (delta || reasoningDelta) {
            writeSseEvent(res, {
              type: 'delta',
              content: delta,
              reasoning: reasoningDelta,
            });
          }

          if (usage) {
            writeSseEvent(res, { type: 'usage', usage });
          }
        } catch {
          // Skip malformed keepalive or partial comment lines
        }
      }
    }
  } catch (err) {
    if (!abortController.signal.aborted) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'Generation stopped.'
          : 'Stream connection interrupted.';
      writeSseEvent(res, {
        type: 'error',
        error: { code: 'NETWORK_ERROR', message },
      });
    }
  } finally {
    reader.releaseLock();
    if (!res.writableEnded) {
      res.end();
    }
  }
}

export async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      apiKeyConfigured: Boolean(getServerApiKey()),
    });
  });

  app.get('/api/models', async (_req: Request, res: Response) => {
    try {
      const models = await fetchGroqModels();
      res.json({ models });
    } catch (err) {
      const code = err instanceof GroqServiceError ? err.code : 'UNKNOWN';
      console.warn(`[api/models] request failed (${code})`);
      sendSafeError(res, err);
    }
  });

  app.post('/api/chat', async (req: Request, res: Response) => {
    const abortController = new AbortController();
    // Abort upstream request if client closes connection (e.g. Stop Generation)
    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    try {
      const body = req.body as ChatRequestInput;
      const isStream = body?.stream !== false;
      const upstream = await requestGroqCompletion(body, abortController.signal);

      if (isStream) {
        await streamGroqResponse(upstream, res, abortController);
        return;
      }

      const data = (await upstream.json()) as {
        model?: string;
        choices?: Array<{
          message?: { content?: string; reasoning?: string };
          finish_reason?: string;
        }>;
        usage?: Record<string, unknown>;
      };

      const choice = data.choices?.[0];
      res.json({
        model: data.model ?? body.model,
        content: choice?.message?.content ?? '',
        reasoning: choice?.message?.reasoning ?? '',
        finishReason: choice?.finish_reason ?? 'stop',
        usage: extractUsage(data.usage),
      });
    } catch (err) {
      if (abortController.signal.aborted) {
        if (!res.writableEnded) res.end();
        return;
      }
      const code = err instanceof GroqServiceError ? err.code : 'UNKNOWN';
      console.warn(`[api/chat] request failed (${code})`);
      sendSafeError(res, err);
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: ROOT_DIR,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainModule) {
  createApp()
    .then((app) => {
      app.listen(PORT, () => {
        const keyStatus = getServerApiKey() ? 'configured' : 'missing';
        console.log(`APOGEE console running at http://localhost:${PORT} (GROQ_API_KEY: ${keyStatus})`);
      });
    })
    .catch((err) => {
      console.error('Failed to start server:', err instanceof Error ? err.message : 'Unknown error');
      process.exit(1);
    });
}
