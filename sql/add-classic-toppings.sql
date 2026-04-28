INSERT INTO ingredient (name, qty_in_stock, target_qty)
SELECT 'Jelly', 100, 100
WHERE NOT EXISTS (
  SELECT 1 FROM ingredient WHERE LOWER(name) = LOWER('Jelly')
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

INSERT INTO topping (name, ingredient_id, qty_needed)
SELECT 'Jelly', i.ingredient_id, 1
FROM ingredient i
WHERE LOWER(i.name) = LOWER('Jelly')
  AND NOT EXISTS (
    SELECT 1 FROM topping t WHERE LOWER(t.name) = LOWER('Jelly')
  );

INSERT INTO topping (name, ingredient_id, qty_needed)
SELECT 'Boba', i.ingredient_id, 1
FROM ingredient i
WHERE LOWER(i.name) = LOWER('Boba')
  AND NOT EXISTS (
    SELECT 1 FROM topping t WHERE LOWER(t.name) = LOWER('Boba')
  );

INSERT INTO topping (name, ingredient_id, qty_needed)
SELECT 'Mango Popping Boba', i.ingredient_id, 1
FROM ingredient i
WHERE LOWER(i.name) = LOWER('Mango Popping Boba')
  AND NOT EXISTS (
    SELECT 1 FROM topping t WHERE LOWER(t.name) = LOWER('Mango Popping Boba')
  );

INSERT INTO topping (name, ingredient_id, qty_needed)
SELECT 'Strawberry Popping Boba', i.ingredient_id, 1
FROM ingredient i
WHERE LOWER(i.name) = LOWER('Strawberry Popping Boba')
  AND NOT EXISTS (
    SELECT 1 FROM topping t WHERE LOWER(t.name) = LOWER('Strawberry Popping Boba')
  );
