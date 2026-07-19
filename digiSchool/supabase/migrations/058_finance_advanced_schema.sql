-- 058_finance_advanced_schema.sql
-- Finance Module Advanced Overhaul (Phase 1+2+3 core tables)

-- 1. Finance Audit Log
CREATE TABLE IF NOT EXISTS public.finance_audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  details TEXT,
  amount NUMERIC(10, 2),
  user_name TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.finance_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.finance_audit_log;
CREATE POLICY "school isolation" ON public.finance_audit_log
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

-- 2. Payment Plans
CREATE TABLE IF NOT EXISTS public.payment_plans (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'Active',
  installments JSONB NOT NULL DEFAULT '[]',
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.payment_plans;
CREATE POLICY "school isolation" ON public.payment_plans
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

-- 3. Payrolls
CREATE TABLE IF NOT EXISTS public.payrolls (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL,
  total_gross NUMERIC(12, 2) DEFAULT 0,
  total_deductions NUMERIC(12, 2) DEFAULT 0,
  total_net NUMERIC(12, 2) DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  staff_count INTEGER DEFAULT 0,
  generated_by TEXT,
  approved_by TEXT,
  paid_by TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.payrolls;
CREATE POLICY "school isolation" ON public.payrolls
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

-- 4. Payroll Entries (Includes basic labourers and support staff)
CREATE TABLE IF NOT EXISTS public.payroll_entries (
  id TEXT PRIMARY KEY,
  payroll_id TEXT REFERENCES public.payrolls(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL,
  role TEXT,
  category TEXT DEFAULT 'Teaching', -- 'Teaching', 'Admin', 'Support Staff' (Labourers)
  base_salary NUMERIC(10, 2) DEFAULT 0,
  allowances NUMERIC(10, 2) DEFAULT 0,
  deductions NUMERIC(10, 2) DEFAULT 0,
  net_pay NUMERIC(10, 2) DEFAULT 0,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.payroll_entries;
CREATE POLICY "school isolation" ON public.payroll_entries
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

-- 5. Purchase Orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id TEXT PRIMARY KEY,
  vendor TEXT NOT NULL,
  items TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  requested_by TEXT,
  status TEXT DEFAULT 'Pending Approval',
  date DATE DEFAULT CURRENT_DATE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.purchase_orders;
CREATE POLICY "school isolation" ON public.purchase_orders
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

-- 6. Tenders (Venbid style publishing)
CREATE TABLE IF NOT EXISTS public.tenders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  deadline DATE NOT NULL,
  status TEXT DEFAULT 'Open',
  published BOOLEAN DEFAULT FALSE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.tenders;
CREATE POLICY "school isolation" ON public.tenders
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

-- 7. Budgets
CREATE TABLE IF NOT EXISTS public.budgets (
  id TEXT PRIMARY KEY,
  academic_year TEXT NOT NULL,
  term TEXT NOT NULL,
  total_allocated NUMERIC(12, 2) DEFAULT 0,
  status TEXT DEFAULT 'Draft',
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.budgets;
CREATE POLICY "school isolation" ON public.budgets
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

-- 8. Budget Items
CREATE TABLE IF NOT EXISTS public.budget_items (
  id TEXT PRIMARY KEY,
  budget_id TEXT REFERENCES public.budgets(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  category TEXT NOT NULL,
  allocated_amount NUMERIC(12, 2) DEFAULT 0,
  spent_amount NUMERIC(12, 2) DEFAULT 0,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.budget_items;
CREATE POLICY "school isolation" ON public.budget_items
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

-- 9. Fixed Assets
CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  purchase_date DATE,
  purchase_value NUMERIC(10, 2) DEFAULT 0,
  current_value NUMERIC(10, 2) DEFAULT 0,
  location TEXT,
  status TEXT DEFAULT 'Active',
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.fixed_assets;
CREATE POLICY "school isolation" ON public.fixed_assets
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

-- 10. Journal Entries
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id TEXT PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  reference TEXT,
  description TEXT,
  account_type TEXT NOT NULL,
  debit NUMERIC(12, 2) DEFAULT 0,
  credit NUMERIC(12, 2) DEFAULT 0,
  status TEXT DEFAULT 'Posted',
  recorded_by TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.journal_entries;
CREATE POLICY "school isolation" ON public.journal_entries
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

-- 11. Tax Records
CREATE TABLE IF NOT EXISTS public.tax_records (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  tax_type TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'Pending',
  due_date DATE,
  filed_date DATE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.tax_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.tax_records;
CREATE POLICY "school isolation" ON public.tax_records
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));
