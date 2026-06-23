-- Migration: Back side of the employee ID document for contracts.
-- The existing id_document_image/id_document_mime columns hold the FRONT.
-- A complete identity now requires both front and back scans. Stored in
-- Postgres (bytea) for the same reasons as the front (ephemeral FS, no object
-- storage). Images are compressed client-side before upload to keep rows small.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS id_document_image_back BYTEA,
  ADD COLUMN IF NOT EXISTS id_document_mime_back VARCHAR(64);

COMMENT ON COLUMN users.id_document_image_back IS 'Employee identity document back-side scan/photo (compressed JPEG/PNG) for contracts.';
COMMENT ON COLUMN users.id_document_mime_back IS 'MIME type of id_document_image_back (e.g. image/jpeg, image/png).';
