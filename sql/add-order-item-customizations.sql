ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS ice_level TEXT;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS sugar_level TEXT;

UPDATE order_items
SET
  ice_level = COALESCE(ice_level, '100%'),
  sugar_level = COALESCE(sugar_level, '100%');

ALTER TABLE order_items
ALTER COLUMN ice_level SET DEFAULT '100%';

ALTER TABLE order_items
ALTER COLUMN sugar_level SET DEFAULT '100%';
