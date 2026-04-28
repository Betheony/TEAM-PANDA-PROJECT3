INSERT INTO ingredient (name, qty_in_stock, target_qty)
SELECT 'Coffee Jelly', 100, 100
WHERE NOT EXISTS (
  SELECT 1 FROM ingredient WHERE LOWER(name) = LOWER('Coffee Jelly')
);

INSERT INTO ingredient (name, qty_in_stock, target_qty)
SELECT 'Boba', 100, 100
WHERE NOT EXISTS (
  SELECT 1 FROM ingredient WHERE LOWER(name) = LOWER('Boba')
);

INSERT INTO ingredient (name, qty_in_stock, target_qty)
SELECT 'Mango Popping Boba', 100, 100
WHERE NOT EXISTS (
  SELECT 1 FROM ingredient WHERE LOWER(name) = LOWER('Mango Popping Boba')
);

INSERT INTO ingredient (name, qty_in_stock, target_qty)
SELECT 'Strawberry Popping Boba', 100, 100
WHERE NOT EXISTS (
  SELECT 1 FROM ingredient WHERE LOWER(name) = LOWER('Strawberry Popping Boba')
);

INSERT INTO ingredient (name, qty_in_stock, target_qty)
SELECT 'Coconut Jelly', 100, 100
WHERE NOT EXISTS (
  SELECT 1 FROM ingredient WHERE LOWER(name) = LOWER('Coconut Jelly')
);

INSERT INTO ingredient (name, qty_in_stock, target_qty)
SELECT 'Sago', 100, 100
WHERE NOT EXISTS (
  SELECT 1 FROM ingredient WHERE LOWER(name) = LOWER('Sago')
);

WITH topping_seed(name) AS (
  VALUES
    ('Coffee Jelly'),
    ('Boba'),
    ('Mango Popping Boba'),
    ('Strawberry Popping Boba'),
    ('Coconut Jelly'),
    ('Sago')
),
missing_toppings AS (
  SELECT
    seed.name,
    i.ingredient_id,
    ROW_NUMBER() OVER (ORDER BY seed.name) AS row_num
  FROM topping_seed seed
  JOIN ingredient i ON LOWER(i.name) = LOWER(seed.name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM topping t
    WHERE LOWER(t.name) = LOWER(seed.name)
  )
),
current_max AS (
  SELECT COALESCE(MAX(topping_id), 0) AS max_topping_id
  FROM topping
)
INSERT INTO topping (topping_id, qty_needed, ingredient_id, name)
SELECT
  current_max.max_topping_id + missing_toppings.row_num,
  1,
  missing_toppings.ingredient_id,
  missing_toppings.name
FROM missing_toppings
CROSS JOIN current_max;
