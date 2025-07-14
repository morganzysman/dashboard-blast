-- Migration: Enable PostgreSQL extensions
-- Enable UUID extension for generating unique identifiers

CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; 