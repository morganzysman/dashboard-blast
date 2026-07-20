-- Migration: generalize the per-order combo ledger into a full order ledger.
--
-- `combo_order_facts` started life as a combo/burger counter but it is really a
-- per-order fact table. We now also use it as the source of truth for revenue
-- and payment analytics (replacing the private by_payment_methods scrape), so:
--   1. Rename combo_order_facts -> order_facts.
--   2. Add order-level revenue columns. Most of these come from the CHEAP order
--      list endpoint (total, total_paid, total_tips, total_discounts,
--      service_fee_price), so the skeleton upsert can fill them without a detail
--      fetch. service_type also comes from the list.
--   3. Add order_payment_facts: one row per payment on an order (an order can be
--      split across multiple methods). Populated from the order DETAIL endpoint
--      (payments[]) and replaced wholesale whenever the order is re-fetched.
--
-- Grain unchanged for order_facts: one row per (company_token, order_id).
-- Grain for order_payment_facts: one row per (company_token, order_id, seq).

ALTER TABLE combo_order_facts RENAME TO order_facts;

ALTER TABLE order_facts ADD COLUMN IF NOT EXISTS total_paid NUMERIC(12,2);
ALTER TABLE order_facts ADD COLUMN IF NOT EXISTS tips_total NUMERIC(12,2);
ALTER TABLE order_facts ADD COLUMN IF NOT EXISTS discounts_total NUMERIC(12,2);
ALTER TABLE order_facts ADD COLUMN IF NOT EXISTS service_fee NUMERIC(12,2);
ALTER TABLE order_facts ADD COLUMN IF NOT EXISTS service_type VARCHAR(64);
ALTER TABLE order_facts ADD COLUMN IF NOT EXISTS payment_count INTEGER;
ALTER TABLE order_facts ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

COMMENT ON TABLE order_facts IS 'Per-order ledger (revenue, combos/burgers, sales channel). Idempotent/resumable source for order analytics, replacing the private by_payment_methods scrape.';
COMMENT ON COLUMN order_facts.order_total IS 'Order gross total (OlaClick order.total).';
COMMENT ON COLUMN order_facts.total_paid IS 'Amount actually paid (order.total_paid).';
COMMENT ON COLUMN order_facts.tips_total IS 'Sum of tips on the order (order.total_tips).';
COMMENT ON COLUMN order_facts.discounts_total IS 'Sum of discounts on the order (order.total_discounts).';
COMMENT ON COLUMN order_facts.service_fee IS 'Service fee charged (order.service_fee_price).';
COMMENT ON COLUMN order_facts.service_type IS 'ONSITE / TABLE / TAKEAWAY / DELIVERY.';
COMMENT ON COLUMN order_facts.payment_count IS 'Number of (non-canceled) payments on the order; null until detail fetched.';
COMMENT ON COLUMN order_facts.closed_at IS 'Order close time (order.closed_at) when available.';

-- One row per payment method used on an order. seq disambiguates split payments
-- (and repeated same-method payments). Replaced wholesale on every detail fetch.
CREATE TABLE IF NOT EXISTS order_payment_facts (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_token VARCHAR(255) NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  seq INTEGER NOT NULL,

  day_local DATE NOT NULL,
  method VARCHAR(64) NOT NULL,        -- payment_method.code, lowercased (cash/card/yape/...)
  bill_amount NUMERIC(12,2),          -- amount applied to the bill
  received_amount NUMERIC(12,2),      -- amount received (may exceed bill for cash change)
  tip_amount NUMERIC(12,2),
  fee_amount NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (company_token, order_id, seq),
  FOREIGN KEY (company_token, order_id)
    REFERENCES order_facts(company_token, order_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_payments_token_day_method
  ON order_payment_facts(company_token, day_local, method);

CREATE INDEX IF NOT EXISTS idx_order_payments_company_day
  ON order_payment_facts(company_id, day_local);

COMMENT ON TABLE order_payment_facts IS 'Per-payment rows for an order (supports split / multi-method payments). Replaced wholesale whenever the parent order detail is re-fetched.';
COMMENT ON COLUMN order_payment_facts.method IS 'payment_method.code from OlaClick, lowercased (cash, card, yape, plin, ...).';
COMMENT ON COLUMN order_payment_facts.bill_amount IS 'Amount of this payment applied to the bill; use this for revenue-by-method sums.';
