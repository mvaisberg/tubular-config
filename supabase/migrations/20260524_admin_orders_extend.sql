-- Extend admin_orders for full order management:
--  - observations (notes)
--  - shipping_type ('pickup' | 'delivery') + conditional shipping_address
--  - payment_method ('transfer' | 'cash' | 'other') — drives automatic discount
--  - source ('manual' | 'woocommerce')
--  - woo_order_id — unique reference for orders pulled from WooCommerce

ALTER TABLE admin_orders
    ADD COLUMN IF NOT EXISTS observations TEXT,
    ADD COLUMN IF NOT EXISTS shipping_type TEXT DEFAULT 'pickup' CHECK (shipping_type IN ('pickup', 'delivery')),
    ADD COLUMN IF NOT EXISTS shipping_address TEXT,
    ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'other' CHECK (payment_method IN ('transfer', 'cash', 'other')),
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'woocommerce')),
    ADD COLUMN IF NOT EXISTS woo_order_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS admin_orders_woo_order_id_idx
    ON admin_orders(woo_order_id)
    WHERE woo_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS admin_orders_source_idx ON admin_orders(source);
CREATE INDEX IF NOT EXISTS admin_orders_status_idx ON admin_orders(status);
