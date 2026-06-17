-- Migration: Persisted work contracts + in-app dual signatures
--
-- Contracts move from ephemeral PDF downloads to persisted, dual-signed records
-- so we can track which employees lack a valid contract and capture the worker
-- and employer-representative signatures in-app.
--
-- Generation params differ by contract type (service: area/hourly_rate vs
-- employment: position/monthly_salary), so the full param set is stored in a
-- generic JSONB blob; start/end dates are denormalised as columns for status
-- queries. The exact rendered PDF is snapshotted (bytea) at generation and at
-- full-signing so the signed document is immutable even if the template changes.
-- Storage is in Postgres (consistent with id_document_image) because the deploy
-- target has an ephemeral filesystem and no object storage.

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  company_token VARCHAR(255) NOT NULL,
  country VARCHAR(2) NOT NULL DEFAULT 'PE',
  contract_type VARCHAR(40),
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  start_date DATE,
  end_date DATE,
  employer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  employee_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  unsigned_pdf BYTEA,
  unsigned_pdf_sha256 VARCHAR(64),
  signed_pdf BYTEA,
  signed_pdf_sha256 VARCHAR(64),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_user ON contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_company ON contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

COMMENT ON TABLE contracts IS 'Persisted work contracts. status: pending (awaiting signatures), active (both signed, within term), expired (term ended), cancelled.';
COMMENT ON COLUMN contracts.params IS 'Full generation parameters (service: area_servicio/hourly_rate/monthly_reference; employment: position/monthly_salary/weekly_hours).';
COMMENT ON COLUMN contracts.unsigned_pdf IS 'Immutable snapshot of the rendered unsigned PDF at generation time.';
COMMENT ON COLUMN contracts.signed_pdf IS 'Immutable snapshot of the fully-signed PDF (both signature blocks + audit page); null until both parties sign.';

-- One signature row per party. Audit fields (ip, user_agent, doc hash at the
-- moment of signing) make the in-app signature defensible.
CREATE TABLE IF NOT EXISTS contract_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  signer_role VARCHAR(20) NOT NULL,
  signer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  signer_name VARCHAR(255),
  signature_png BYTEA NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip VARCHAR(64),
  user_agent TEXT,
  doc_sha256_at_signing VARCHAR(64),
  UNIQUE (contract_id, signer_role)
);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON contract_signatures(contract_id);

COMMENT ON TABLE contract_signatures IS 'In-app signatures for a contract. signer_role: employer | worker. Both required for a contract to become active.';
COMMENT ON COLUMN contract_signatures.doc_sha256_at_signing IS 'SHA-256 of the unsigned PDF the party saw when signing (proves what was agreed to).';
