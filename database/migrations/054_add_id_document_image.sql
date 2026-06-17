-- Migration: Employee ID document image for contracts
-- Stored in Postgres (bytea) because the deploy target has an ephemeral
-- filesystem and no object storage configured. Images are compressed
-- client-side before upload to keep rows small.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS id_document_image BYTEA,
  ADD COLUMN IF NOT EXISTS id_document_mime VARCHAR(64);

COMMENT ON COLUMN users.id_document_image IS 'Employee identity document scan/photo (compressed JPEG/PNG) for contracts.';
COMMENT ON COLUMN users.id_document_mime IS 'MIME type of id_document_image (e.g. image/jpeg, image/png).';
