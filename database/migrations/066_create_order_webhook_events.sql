-- Audit + idempotency log for OlaClick webhook deliveries.
--
-- OlaClick may deliver the same event more than once (it retries up to max_retry
-- on non-2xx). We store every delivery keyed by event_id so we can:
--   • deduplicate (skip already-processed events),
--   • keep the raw payload for debugging / replay,
--   • see what was handled vs errored.
--
-- We intentionally do NOT foreign-key to order_facts: a webhook can arrive for an
-- order we have not ledgered yet (or ever), and the raw record is still useful.

CREATE TABLE IF NOT EXISTS order_webhook_events (
  event_id     VARCHAR(255) PRIMARY KEY,
  event_type   VARCHAR(64) NOT NULL,
  merchant_id  VARCHAR(128),
  company_token VARCHAR(255),
  order_id     VARCHAR(255),
  payload      JSONB,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error        TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_webhook_events_received
  ON order_webhook_events(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_webhook_events_order
  ON order_webhook_events(company_token, order_id);
