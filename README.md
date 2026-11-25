# APOGEE — Orbital AI Chat Console

A responsive AI chat console inspired by Playground-style workflows, built with an original deep-space and astronomy visual theme, React, TypeScript, Vite, and an Express API proxy.

## Security & API Key Setup

The Groq API key is **only** read on the server (`server/groq.ts`) from `process.env.GROQ_API_KEY`. It is never bundled into browser code, returned by API responses, or logged.

### Providing the key securely
Choose one of the following methods:

1. **Environment variable / Antigravity secret (recommended for production or CI):**
   Export `GROQ_API_KEY` in your runtime environment or secret manager before starting the app. Server environment variables take precedence over `.env`.
   ```bash
   export GROQ_API_KEY="your_groq_api_key"
   ```
2. **Local `.env` file (recommended for local development):**
   Copy `.env.example` to `.env` (already ignored by `.gitignore`) and set:
   ```env
   GROQ_API_KEY=your_groq_api_key
   PORT=3000
   ```

## Running the App

```bash
# Install dependencies
npm install

# Start development server (Express API + Vite HMR on http://localhost:3000)
npm run dev

# Build for production and start
npm run build
npm start
```

## Verification Checks

```bash
# Type-check server and frontend
npm run typecheck

# Run API & streaming verification suite
npm run test:api
```
