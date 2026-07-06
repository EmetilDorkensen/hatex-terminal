-- Retrè pwofi biznis (lè admin retire lajan nan bank la)
CREATE TABLE IF NOT EXISTS business_profit_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  admin_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_profit_withdrawals_created
  ON business_profit_withdrawals(created_at DESC);

ALTER TABLE business_profit_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read business profit withdrawals" ON business_profit_withdrawals;
CREATE POLICY "Admin read business profit withdrawals"
  ON business_profit_withdrawals
  FOR SELECT
  USING (lower(auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com');

DROP POLICY IF EXISTS "Admin insert business profit withdrawals" ON business_profit_withdrawals;
CREATE POLICY "Admin insert business profit withdrawals"
  ON business_profit_withdrawals
  FOR INSERT
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'adminhatexcard@gmail.com');
