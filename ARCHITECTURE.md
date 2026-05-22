# Architecture Notes

## Ingestion Flow

1. The React client posts a user message to `/api/chat`.
2. The backend stores the user message and builds short context from the latest messages.
3. `InstrumentedLlmClient` calls the configured provider and streams chunks back to the browser.
4. The wrapper records start time, completion time, latency, status, token usage, and redacted previews.
5. The wrapper emits a JSON payload to `/api/ingest/inference`.
6. The ingestion API validates the payload and publishes an event to Redis/BullMQ.
7. The ingestion worker consumes the queued event, records an `IngestionEvent`, and stores a normalized `InferenceLog`.

## Logging Strategy

The log captures operational metadata without storing full prompts or completions in the log table. Full chat content belongs in `ChatMessage`; logs keep short redacted previews so dashboard/debugging workflows remain useful without duplicating large text.

Accepted logs are queued before persistence. This decouples user-facing chat latency from ingestion durability and gives the worker retry/backoff behavior.

## Scaling Considerations

The ingestion path uses Redis/BullMQ so workers can scale independently from API replicas. For larger production workloads, the queue could be swapped for Kafka, SQS, or Redis Streams, and logs could be copied to a warehouse for analytics.

PostgreSQL is enough for the assignment scope. For larger analytics workloads, inference logs could be copied into a columnar store or warehouse.

## Failure Handling Assumptions

- LLM errors are returned to the client and logged with `ERROR`.
- Browser aborts are treated as `CANCELLED`.
- Ingestion failures are isolated from chat completion so observability outages do not break the user-facing chatbot.
- Queue jobs retry with exponential backoff and failed jobs are retained temporarily for inspection.
- Invalid ingestion payloads are stored as rejected `IngestionEvent` records for auditability.

## Provider Abstraction

The backend talks to a `LlmProvider` interface. Gemini, OpenAI, and the local mock implement the same methods, so adding Claude or another provider means adding a new adapter rather than rewriting chat logic.

Gemini is accessed through Google's OpenAI-compatible endpoint, which lets the existing OpenAI JavaScript SDK call Gemini by changing the API base URL, model, and key.
