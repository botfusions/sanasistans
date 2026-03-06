-- 1. Staff Tablosu (Eksikse oluştur, varsa güncelle)
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Personnel',
    phone TEXT,
    is_marina BOOLEAN DEFAULT false,
    language TEXT DEFAULT 'ru',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Orders Tablosu
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_number TEXT,
    customer_name TEXT,
    delivery_date TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Order Items Tablosu ve İlişki
CREATE TABLE IF NOT EXISTS public.order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
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

-- İlişkiyi Zorla (PostgREST Join Sorunu Çözümü)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_items_order_id_fkey'
    ) THEN
        ALTER TABLE public.order_items 
        ADD CONSTRAINT order_items_order_id_fkey 
        FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. RLS ve Politikalar (Önce temizle sonra kur)
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON public.staff;
DROP POLICY IF EXISTS "Allow all" ON public.orders;
DROP POLICY IF EXISTS "Allow all" ON public.order_items;

CREATE POLICY "Allow all" ON public.staff FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

-- 5. Cache Yenileme için dummy bir tablo işlemi (Bazı durumlarda gerekir)
NOTIFY pgrst, 'reload schema';
