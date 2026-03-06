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
