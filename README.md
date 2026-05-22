# TraceChat

A lightweight fullstack AI workspace that wraps LLM calls, streams responses, sends inference metadata to an ingestion endpoint, and stores chat plus observability data in PostgreSQL.

## Features

- Multi-turn chatbot with short conversation context
- Conversation list, resume, and cancel flow
- Streaming responses over Server-Sent Events
- Instrumented LLM wrapper for provider, model, latency, status, token usage, timestamps, and previews
- Ingestion endpoint with payload validation and raw event tracking
- PostgreSQL schema for conversations, messages, inference logs, and ingestion events
- Simple metrics dashboard for throughput, latency, tokens, errors, and cancelled requests
- PII-style preview redaction for emails, phone numbers, and secret-looking values
- Mock provider fallback when `OPENAI_API_KEY` is not configured
- Redis/BullMQ event queue with a separate ingestion worker
- Self-hosted Kubernetes manifests in `k8s/`

## Quick Start

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Open `http://localhost:5173`.

The app defaults to Gemini when `GEMINI_API_KEY` is set. If no provider key is configured, it falls back to mock mode, which still exercises chat persistence, streaming, ingestion, and dashboards.

Provider options:

```bash
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash-lite
```

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-4.1-mini
```

```bash
LLM_PROVIDER=groq
GROQ_API_KEY=your-key
GROQ_MODEL=llama-3.3-70b-versatile
```

You can also switch providers at runtime from the provider selector in the chat top bar. Providers without keys stay disabled until their API key is added to `.env`.

## Docker Compose

```bash
docker compose up
```

This starts Postgres, Redis, the API server, the ingestion worker, and the frontend. Set `GEMINI_API_KEY` in your shell or `.env` to use Gemini instead of the mock provider.

## Architecture Overview

```text
React UI
  -> Backend chat API
  -> Instrumented LLM client
  -> Provider implementation
  -> Ingestion endpoint
  -> PostgreSQL
```

The chat API stores the user message, loads the latest conversation context, streams model output to the browser, then persists the assistant message. The LLM wrapper measures the call and emits an inference log to `/api/ingest/inference`.

The ingestion API validates payloads and publishes accepted events to Redis/BullMQ. A separate worker consumes those events and persists normalized logs to PostgreSQL.

## Schema Decisions

- `Conversation` owns the chat thread and status.
- `ChatMessage` stores durable user/assistant messages in chronological order.
- `InferenceLog` stores normalized observability data that dashboards can query efficiently.
- `IngestionEvent` stores accepted/rejected payloads so ingestion behavior can be audited.

Indexes are added around conversation timelines, recent logs, provider/model filtering, and status/time dashboard queries.

## Tradeoffs

- The SDK/wrapper lives inside the backend repo rather than a separately published package. This keeps the assignment focused while still showing the reusable boundary.
- Streaming token usage depends on provider support. OpenAI supports final usage with `stream_options.include_usage`; the mock provider does not emit tokens.
- Ingestion is synchronous enough for demo simplicity, but logging failures do not fail the chat request.
- PII redaction is regex-based and meant as a practical baseline, not a complete data loss prevention system.

## Kubernetes

Self-hosted Kubernetes manifests live in `k8s/`. They include Postgres, Redis, API, worker, frontend, ingress, config, and secrets examples.

## With More Time

- Add authentication and per-user conversation ownership.
- Add retry/backoff for ingestion delivery.
- Add provider adapters for Anthropic and local models.
- Add richer dashboards with time buckets and percentile latency.
- Add automated tests around ingestion validation and cancellation behavior.

## Screenshots 
<img width="1919" height="910" alt="image" src="https://github.com/user-attachments/assets/3c75182e-7ef0-403e-a4a5-90abd0456f03" />
<img width="1919" height="915" alt="image" src="https://github.com/user-attachments/assets/0870ab64-641f-4414-90f4-cbbbeab37556" />
<img width="604" height="629" alt="image" src="https://github.com/user-attachments/assets/fc8e7a42-f721-4ef5-aefe-5dd72f661238" />


