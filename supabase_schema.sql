-- 0. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Staff Table
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Personnel',
    phone TEXT,
    is_marina BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_number TEXT,
    customer_name TEXT,
    delivery_date TEXT, -- Stored as string to match existing code logic
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    product TEXT,
    department TEXT,
    quantity TEXT,
    details TEXT,
    source TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'pending',
    assigned_worker TEXT,
    fabric_name TEXT,
    fabric_amount TEXT,
    fabric_arrived BOOLEAN DEFAULT false,
    fabric_issue_note TEXT,
    last_reminder_at TEXT,
    distributed_at TIMESTAMPTZ,
    row_index INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Note: No strict foreign key constraint was found in error logs,
-- but the error "Searched for a foreign key relationship" confirms
-- that one is expected by PostgREST when doing joins.

-- Enable RLS (Service Role key will bypass this)
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Allow all for everyone (Since we are using service role anyway)
CREATE POLICY "Allow all" ON public.staff FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

-- 4. Visual Memory Table (Vector Storage)
CREATE TABLE IF NOT EXISTS public.visual_memory (
    id TEXT PRIMARY KEY,
    product_name TEXT,
    customer_name TEXT,
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    vector vector(1024),
    file_path TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for visual_memory
ALTER TABLE public.visual_memory ENABLE ROW LEVEL SECURITY;

-- Allow all for everyone (Soft RLS)
-- Allow all for everyone (Soft RLS)
CREATE POLICY "Allow all" ON public.visual_memory FOR ALL USING (true) WITH CHECK (true);

-- 5. Search Function for Visual Memory
CREATE OR REPLACE FUNCTION match_visual_memory (
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id TEXT,
  product_name TEXT,
  customer_name TEXT,
  order_id TEXT,
  tags TEXT[],
  file_path TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vm.id,
    vm.product_name,
    vm.customer_name,
    vm.order_id,
    vm.tags,
    vm.file_path,
    1 - (vm.vector <=> query_embedding) AS similarity
  FROM public.visual_memory vm
  WHERE 1 - (vm.vector <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
