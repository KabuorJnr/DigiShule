-- Payment pledges and payment-in-kind support.
--
-- Schools frequently receive commitments to pay (pledges) and contributions in
-- kind (maize, building materials, labour) rather than only cash. These need to
-- be tracked distinctly from settled cash payments.

-- 1) In-kind support on the existing cash-payment ledger.
--    A payment can now be flagged in-kind with a human description of what was
--    contributed; `amount` holds its assessed monetary value.
ALTER TABLE finance_payments ADD COLUMN IF NOT EXISTS in_kind BOOLEAN DEFAULT false;
ALTER TABLE finance_payments ADD COLUMN IF NOT EXISTS description TEXT;

-- 2) Dedicated pledges ledger — commitments, not yet settled.
CREATE TABLE IF NOT EXISTS payment_pledges (
    id TEXT PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id TEXT,
    student_name TEXT,
    pledged_by TEXT,                 -- parent/guardian or sponsor name
    kind TEXT NOT NULL DEFAULT 'cash', -- 'cash' | 'in_kind'
    amount NUMERIC DEFAULT 0,        -- pledged cash amount, or assessed value of in-kind
    item TEXT,                       -- description of an in-kind pledge
    pledge_date DATE DEFAULT CURRENT_DATE,
    expected_date DATE,
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending' | 'Fulfilled' | 'Cancelled'
    fulfilled_amount NUMERIC DEFAULT 0,
    payment_id TEXT,                 -- link to the finance_payments row on fulfilment
    notes TEXT,
    recorded_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_pledges_school ON payment_pledges (school_id, status);

ALTER TABLE payment_pledges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school isolation" ON payment_pledges
    FOR ALL USING (school_id = ANY(my_school_ids()))
    WITH CHECK (school_id = ANY(my_school_ids()));
