INSERT INTO suppliers (id, name, contact_info)
VALUES ('5077e001-0000-0000-0000-000000000001', 'TechVision Electronics', 'techvision@supplier.com, +40-21-555-0101'),
       ('5077e002-0000-0000-0000-000000000002', 'FashionHub Wholesale', 'orders@fashionhub.com, +40-21-555-0202'),
       ('5077e003-0000-0000-0000-000000000003', 'HomeBase Supplies', 'contact@homebase.com, +40-21-555-0303');

-- Electronics products -> TechVision Electronics
UPDATE products SET supplier_id = '5077e001-0000-0000-0000-000000000001'
WHERE id IN ('fade0001-0000-0000-0000-000000000001',
             'fade0002-0000-0000-0000-000000000002',
             'fade0003-0000-0000-0000-000000000003');

-- Clothing products -> FashionHub Wholesale
UPDATE products SET supplier_id = '5077e002-0000-0000-0000-000000000002'
WHERE id IN ('fade0004-0000-0000-0000-000000000004',
             'fade0005-0000-0000-0000-000000000005');

-- Home & Garden products -> HomeBase Supplies
UPDATE products SET supplier_id = '5077e003-0000-0000-0000-000000000003'
WHERE id IN ('fade0006-0000-0000-0000-000000000006',
             'fade0007-0000-0000-0000-000000000007');

-- Sports products -> HomeBase Supplies (yoga mat, running shoes)
UPDATE products SET supplier_id = '5077e003-0000-0000-0000-000000000003'
WHERE id IN ('fade0008-0000-0000-0000-000000000008',
             'fade0009-0000-0000-0000-000000000009');

-- Fitness Tracker -> TechVision Electronics
UPDATE products SET supplier_id = '5077e001-0000-0000-0000-000000000001'
WHERE id = 'fade000a-0000-0000-0000-00000000000a';
