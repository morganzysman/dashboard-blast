-- Per-account kitchen prep SLA targets (minutes). Keys like DELIVERY:RAPPI_TURBO, ONSITE:*

CREATE TABLE IF NOT EXISTS kitchen_sla_targets (
  company_token TEXT PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  targets JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_sla_targets_company_id ON kitchen_sla_targets(company_id);

COMMENT ON TABLE kitchen_sla_targets IS 'Optional per-restaurant overrides for kitchen prep SLA minute targets; merged with app defaults when scoring.';
