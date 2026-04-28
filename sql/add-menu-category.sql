ALTER TABLE menu_item
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'cold';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'menu_item_category_check'
  ) THEN
    ALTER TABLE menu_item
    ADD CONSTRAINT menu_item_category_check
    CHECK (category IN ('hot', 'cold', 'special'));
  END IF;
END $$;
