ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS size TEXT;

UPDATE order_items
SET size = COALESCE(size, 'medium');

ALTER TABLE order_items
ALTER COLUMN size SET DEFAULT 'medium';
