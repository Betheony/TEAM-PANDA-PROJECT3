ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS size text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS sugar_level text NOT NULL DEFAULT '100%',
  ADD COLUMN IF NOT EXISTS ice_level text NOT NULL DEFAULT 'less ice';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_size_check'
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_size_check
      CHECK (size IN ('medium', 'large')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_sugar_level_check'
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_sugar_level_check
      CHECK (sugar_level IN ('0%', '50%', '100%')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_ice_level_check'
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_ice_level_check
      CHECK (ice_level IN ('hot', 'less ice', 'more ice')) NOT VALID;
  END IF;
END $$;
