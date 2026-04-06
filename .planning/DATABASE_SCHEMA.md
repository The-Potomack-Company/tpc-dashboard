# TPC Dashboard — Database Schema

> For PM review. This schema lives in the **shared Supabase project** alongside TPC App and Cataloger extension tables.

## Existing Tables (Read-Only from Dashboard)

These tables already exist in Supabase from TPC App. The dashboard reads but never writes to them.

| Table | Owner | Dashboard Use |
|-------|-------|---------------|
| `profiles` | TPC App | User names, roles for activity views |
| `sessions` | TPC App | Session counts, status tracking, specialist assignments |
| `items` | TPC App | Items cataloged, AI processing stats |
| `export_history` | TPC App | Export frequency, volume |
| `photos` | TPC App | Photo upload counts |

### Coming from TPC AI Cataloger v2.0

| Table | Owner | Dashboard Use |
|-------|-------|---------------|
| `analytics_events` | Cataloger Extension | All 5 workflow event types (W1-W5) — catalog generation, batch runs, photo uploads, spreadsheet imports, app data imports |

---

## New Tables (Dashboard-Owned)

### `sales`

Top-level record for each auction sale (one per PDF / one per RFC scrape).

```sql
CREATE TABLE sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number     TEXT NOT NULL UNIQUE,        -- e.g., "103", "1000", "13606"
  sale_date       DATE NOT NULL,
  title           TEXT NOT NULL,               -- e.g., "Asian, European & American Works of Art Live Auction"
  
  -- All Departments summary (page 1 of PDF)
  auctioned_lots      INTEGER,
  lots_sold           INTEGER,
  sell_through_pct    DECIMAL(5,2),            -- calculated: lots_sold / auctioned_lots * 100
  total_sold_value    DECIMAL(12,2),
  total_unsold_value  DECIMAL(12,2),
  
  -- Estimates
  total_estimate_low  DECIMAL(12,2),           -- low end of range
  total_estimate_high DECIMAL(12,2),           -- high end of range
  estimate_sold_low   DECIMAL(12,2),
  estimate_sold_high  DECIMAL(12,2),
  lots_within_estimate INTEGER,
  lots_above_estimate  INTEGER,
  lots_below_estimate  INTEGER,
  
  -- Reserves
  total_reserve           DECIMAL(12,2),
  total_reserve_sold      DECIMAL(12,2),
  lots_at_or_above_reserve INTEGER,
  lots_below_reserve       INTEGER,
  
  -- Participants
  registered_bidders      INTEGER,
  number_of_buyers        INTEGER,
  number_of_sellers       INTEGER,
  number_of_receipts      INTEGER,
  successful_bidders_not_registered INTEGER,
  
  -- Payment status
  paid_invoices       INTEGER,
  unpaid_invoices     INTEGER,
  lots_paid           INTEGER,
  lots_not_paid       INTEGER,
  total_hammer_paid   DECIMAL(12,2),
  total_hammer_unpaid DECIMAL(12,2),
  
  -- Settlements
  paid_settlements    INTEGER,
  unpaid_settlements  INTEGER,
  lots_settled        INTEGER,
  lots_not_settled    INTEGER,
  total_hammer_settled     DECIMAL(12,2),
  total_hammer_not_settled DECIMAL(12,2),
  
  -- Revenue projection
  premium         DECIMAL(12,2),
  commission      DECIMAL(12,2),
  insurance       DECIMAL(12,2),
  lot_charges     DECIMAL(12,2),
  other_charges_buyers  DECIMAL(12,2),
  other_charges_sellers DECIMAL(12,2),
  referral_fees   DECIMAL(12,2),
  level_up        DECIMAL(12,2),
  total_net_revenue DECIMAL(12,2),
  
  -- Metadata
  source          TEXT NOT NULL DEFAULT 'pdf', -- 'pdf' or 'scraper'
  pdf_filename    TEXT,                        -- original filename if imported from PDF
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_number ON sales(sale_number);
```

### `sale_departments`

Per-department breakdown within each sale (pages 2-N of PDF).

```sql
CREATE TABLE sale_departments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  
  department_code TEXT NOT NULL,               -- e.g., "ASN", "PNT", "PER", "SIL"
  department_name TEXT NOT NULL,               -- e.g., "Asian (Fine)", "Paintings (Fine)"
  
  auctioned_lots      INTEGER,
  lots_sold           INTEGER,
  sell_through_pct    DECIMAL(5,2),
  total_sold_value    DECIMAL(12,2),
  total_unsold_value  DECIMAL(12,2),
  
  total_estimate_low  DECIMAL(12,2),
  total_estimate_high DECIMAL(12,2),
  estimate_sold_low   DECIMAL(12,2),
  estimate_sold_high  DECIMAL(12,2),
  lots_within_estimate INTEGER,
  lots_above_estimate  INTEGER,
  lots_below_estimate  INTEGER,
  
  total_reserve           DECIMAL(12,2),
  total_reserve_sold      DECIMAL(12,2),
  lots_at_or_above_reserve INTEGER,
  lots_below_reserve       INTEGER,
  
  number_of_sellers   INTEGER,
  number_of_receipts  INTEGER,
  number_of_buyers    INTEGER,
  
  -- Revenue
  premium         DECIMAL(12,2),
  commission      DECIMAL(12,2),
  insurance       DECIMAL(12,2),
  lot_charges     DECIMAL(12,2),
  total_revenue   DECIMAL(12,2),
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(sale_id, department_code)
);

CREATE INDEX idx_sale_departments_sale ON sale_departments(sale_id);
CREATE INDEX idx_sale_departments_dept ON sale_departments(department_code);
```

### `departments`

Reference table for department codes and display names.

```sql
CREATE TABLE departments (
  code    TEXT PRIMARY KEY,                    -- "ASN", "PNT", etc.
  name    TEXT NOT NULL,                       -- "Asian (Fine)", "Paintings (Fine)"
  category TEXT                                -- optional grouping: "Asian", "Paintings", "Furniture", etc.
);

-- Seed with known departments from PDFs:
INSERT INTO departments (code, name, category) VALUES
  ('AMER', 'American Historical/Folk', 'American'),
  ('ASD',  'Asian (Decorative)', 'Asian'),
  ('ASN',  'Asian (Fine)', 'Asian'),
  ('ASNP', 'Asian (Paintings & Prints)', 'Asian'),
  ('BKS',  'Books', 'Books & Maps'),
  ('CER',  'Ceramics', 'Decorative Arts'),
  ('CLK',  'Clocks', 'Decorative Arts'),
  ('DEC',  'Dec Arts', 'Decorative Arts'),
  ('DRW',  'Drawings, Prints & Photographs', 'Works on Paper'),
  ('ENT',  'Entertainment', 'Entertainment'),
  ('FRN',  'Furniture (General)', 'Furniture'),
  ('GEN',  'General (Unassigned)', 'General'),
  ('GLS',  'Glassware', 'Decorative Arts'),
  ('MAP',  'Maps & Atlases', 'Books & Maps'),
  ('MDF',  'Furniture (Modern/Designer)', 'Furniture'),
  ('MUS',  'Musical Instruments', 'Musical'),
  ('PER',  'Furniture (Period)', 'Furniture'),
  ('PND',  'Paintings (Decorative)', 'Paintings'),
  ('PNT',  'Paintings (Fine)', 'Paintings'),
  ('RUG',  'Rugs & Carpets', 'Textiles'),
  ('SIL',  'Silver', 'Silver & Metalwork'),
  ('SPT',  'Sculpture', 'Sculpture'),
  ('TXTL', 'Other textiles', 'Textiles');
```

### `scraper_runs`

Track automated RFC scraping activity.

```sql
CREATE TABLE scraper_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'running',  -- 'running', 'success', 'failed', 'partial'
  sales_found     INTEGER DEFAULT 0,
  sales_imported  INTEGER DEFAULT 0,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `saved_reports`

User-saved report configurations for quick access.

```sql
CREATE TABLE saved_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  name            TEXT NOT NULL,
  description     TEXT,
  report_type     TEXT NOT NULL,                -- 'sale_comparison', 'department_trend', 'revenue_report', 'activity_summary'
  config          JSONB NOT NULL,               -- filters, date range, selected departments, chart type, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_reports_user ON saved_reports(created_by);
```

---

## RLS Policies

```sql
-- Sales & departments: all authenticated users can read
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read sales" ON sales FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE sale_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read departments" ON sale_departments FOR SELECT USING (auth.role() = 'authenticated');

-- Only service role (scraper/import) can insert/update sale data
CREATE POLICY "Service role can manage sales" ON sales FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage departments" ON sale_departments FOR ALL USING (auth.role() = 'service_role');

-- Saved reports: users manage their own
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reports" ON saved_reports FOR ALL USING (auth.uid() = created_by);

-- Scraper runs: read for all, write for service role
ALTER TABLE scraper_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read runs" ON scraper_runs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role can manage runs" ON scraper_runs FOR ALL USING (auth.role() = 'service_role');
```

---

## Entity Relationship Summary

```
sales (1) ──< sale_departments (many)
                    │
                    └── department_code ──> departments (reference)

profiles (existing, TPC App) ──< saved_reports (many)

scraper_runs (independent, tracks import jobs)

-- Read-only from dashboard:
sessions ──< items ──< photos      (TPC App)
analytics_events                    (TPC AI Cataloger v2.0)
```

---

## Notes for PM Review

1. **No duplication**: Dashboard stores auction profile data in its own tables. TPC App and Cataloger tables are read-only.
2. **Sale number is unique**: Each PDF maps to one `sales` row + N `sale_departments` rows.
3. **Scraper uses service role key**: Not exposed to frontend. Runs server-side (Vercel cron or external).
4. **Financial precision**: All money fields are `DECIMAL(12,2)` — handles up to $9,999,999,999.99.
5. **Extensible**: `saved_reports.config` is JSONB — any future report parameters can be added without schema changes.
6. **Department codes**: Seeded from the 457 PDFs. New departments discovered by scraper get auto-added.
