import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from './index.js';
import { buildGroqPayload, getServerApiKey, GroqServiceError } from './groq.js';

async function run() {
  // 1. Unit checks for validation & error handling
  assert.throws(
    () => buildGroqPayload({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: '   ' }] }),
    (err: unknown) => err instanceof GroqServiceError && err.code === 'EMPTY_MESSAGE'
  );

  assert.throws(
    () => buildGroqPayload({ model: '', messages: [{ role: 'user', content: 'Hello' }] }),
    (err: unknown) => err instanceof GroqServiceError && err.code === 'INVALID_MODEL'
  );

  // 2. Start Express app on ephemeral port for integration checks
  const app = await createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  assert(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Health endpoint check (must never contain key)
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthText = await healthRes.text();
    const key = getServerApiKey();
    if (key) {
      assert(!healthText.includes(key), 'Health response must never leak API key');
    }
    const health = JSON.parse(healthText) as { ok: boolean; apiKeyConfigured: boolean };
    assert.equal(health.ok, true);
    console.log(`[verify] /api/health ok (apiKeyConfigured=${health.apiKeyConfigured})`);

    // Empty message check via HTTP
    const emptyRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: '  ' }] }),
    });
    assert.equal(emptyRes.status, 400);
    const emptyErr = (await emptyRes.json()) as { error: { code: string } };
    assert.equal(emptyErr.error.code, 'EMPTY_MESSAGE');
    console.log('[verify] Empty message validation passed');

    if (!health.apiKeyConfigured) {
      console.log('[verify] Skipping live Groq API calls because GROQ_API_KEY is not set');
      return;
    }

    // Live /api/models check
    const modelsRes = await fetch(`${baseUrl}/api/models`);
    assert.equal(modelsRes.status, 200);
    const modelsBody = (await modelsRes.json()) as { models: Array<{ id: string }> };
    assert(Array.isArray(modelsBody.models) && modelsBody.models.length > 0, 'Expected live chat models');
    console.log(
      `[verify] /api/models returned ${modelsBody.models.length} live chat models:`,
      modelsBody.models.map((m) => m.id).join(', ')
    );

    const fastModel =
      modelsBody.models.find((m) => m.id === 'llama-3.1-8b-instant')?.id ?? modelsBody.models[0].id;

    // Invalid model check
    const badModelRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'non-existent-orbital-model-999',
        messages: [{ role: 'user', content: 'Hi' }],
        stream: false,
      }),
    });
    assert.equal(badModelRes.status, 400);
    const badModelErr = (await badModelRes.json()) as { error: { code: string } };
    assert.equal(badModelErr.error.code, 'INVALID_MODEL');
    console.log('[verify] Invalid model error handling passed');

    // Non-streaming chat completion check
    const chatRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: fastModel,
        messages: [{ role: 'user', content: 'Reply with exactly the single word: APOGEE' }],
        temperature: 0,
        maxCompletionTokens: 256,
        stream: false,
      }),
    });
    assert.equal(chatRes.status, 200);
    const chatJson = (await chatRes.json()) as { content: string; reasoning?: string; finishReason?: string };
    assert(
      chatJson.content.length > 0 || (chatJson.reasoning?.length ?? 0) > 0,
      `Expected non-empty completion, got: ${JSON.stringify(chatJson)}`
    );
    console.log(`[verify] Non-streaming completion passed (${fastModel}, finish=${chatJson.finishReason})`);

    // Streaming SSE chat completion check
    const streamRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: fastModel,
        messages: [{ role: 'user', content: 'Say hello in 5 words.' }],
        temperature: 0.2,
        maxCompletionTokens: 256,
        stream: true,
      }),
    });
    assert.equal(streamRes.status, 200);
    const streamText = await streamRes.text();
    assert(streamText.includes('"type":"delta"'), 'Expected SSE delta events');
    assert(streamText.includes('"type":"done"'), 'Expected SSE done event');
    console.log('[verify] Streaming SSE completion passed');
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('[verify] FAILED:', err);
  process.exit(1);
});
