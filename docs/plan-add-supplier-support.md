# Plan: Add Supplier Support to Products

## Context

The e-commerce application needs to track which supplier provides each product. Currently, products only have a category relationship. We need to add a `suppliers` table, link products to suppliers via FK, expose GET endpoints for suppliers, include supplier data in product responses, and add a supplier dropdown to the product creation/update form.

The implementation follows the exact same patterns as the existing `ProductCategory` feature (entity, DTO, mapper, repository, service, controller).

---

## Design Decisions

### Nullability Strategy

The `supplier_id` column is **nullable** in the DB (to allow the ALTER TABLE on existing data), but the **frontend form requires supplier selection** for both create and update. This means:

- Existing mock data will be backfilled with suppliers in `V2.1` (no NULLs in local dev)
- The backend must handle `supplier = null` gracefully in responses (returns `"supplier": null` in JSON)
- The frontend detail page and product card must null-check `supplier` before rendering
- The update form shows "Select a supplier" as default when editing a product with no supplier

### Type Safety

- `CreateProductRequest` must explicitly omit `supplier` (the nested object) alongside `id` and `category`
- `UpdateProductRequest` must also omit `supplier` and use `supplierId?: string` instead
- This prevents accidentally sending a nested supplier object to the backend

### Mock Handler Architecture

Create a **separate** `suppliers-handler.mock.ts` file and register it in `mock-api.interceptor.ts` — this keeps the handler responsibilities aligned with the API resource boundaries.

---

## Subtask 1: Database Schema Migration

**Create:** `onlineshopapi/src/main/resources/db/migration/V2__add_suppliers.sql`

- Create `suppliers` table: `id` (UUID PK), `name` (VARCHAR 255 NOT NULL), `contact_info` (VARCHAR 500 nullable)
- Add nullable `supplier_id` (UUID) column to `products` table with FK to `suppliers(id)`

---

## Subtask 2: Mock Data Migration

**Create:** `onlineshopapi/src/main/resources/db/migration/local/V2.1__populate_suppliers_mock_data.sql`

- Insert 3 suppliers (TechVision Electronics, FashionHub Wholesale, HomeBase Supplies)
- Update ALL existing 10 products to assign supplier_id (no NULLs left in local dev data)

---

## Subtask 3: Backend - Supplier Entity, Repository, DTO, Mapper, Service

**Create (following ProductCategory pattern):**
- `model/Supplier.java` - JPA entity with `@Entity`, Lombok annotations, fields: id, name, contactInfo
- `repository/SupplierRepository.java` - extends `JpaRepository<Supplier, UUID>`
- `dto/SupplierDto.java` - fields: id, name, contactInfo (Lombok @Builder etc.)
- `dto/mapper/SupplierMapper.java` - `@Component`, toDto/toEntity methods
- `service/SupplierService.java` - `@Service`, findAll() and findById() only

---

## Subtask 4: Backend - Wire Supplier into Product

**Modify:**
- `model/Product.java` - add `@ManyToOne @JoinColumn(name = "supplier_id") Supplier supplier` (no `nullable = false` — this is nullable unlike category)
- `dto/ProductRequestDto.java` - add `UUID supplierId` field
- `dto/ProductResponseDto.java` - add `SupplierDto supplier` field
- `dto/mapper/ProductMapper.java`:
  - Inject `SupplierMapper`
  - In `toDto()`: use ternary — `product.getSupplier() != null ? supplierMapper.toDto(product.getSupplier()) : null`
  - In `toEntity()`: use ternary — `dto.getSupplierId() != null ? Supplier.builder().id(dto.getSupplierId()).build() : null`
- `service/ProductService.java` - in `update()` method add `existing.setSupplier(product.getSupplier());`

**Note:** `OrderDetailResponseDto` embeds `ProductResponseDto` — after this change, order responses will include a `supplier` field (or null). This is a backwards-compatible additive change, no action needed.

---

## Subtask 5: Backend - Supplier Controller (GET only)

**Create:** `controller/SupplierController.java`

- `GET /suppliers` - returns `List<SupplierDto>` (no auth required)
- `GET /suppliers/{id}` - returns `SupplierDto` or 404
- OpenAPI annotations following `ProductCategoryController` pattern

---

## Subtask 6: Frontend Changes

**Modify types:** `core/types/dtos/product.dto.ts`
- Add `SupplierDto` type: `{ id: string; name: string; contactInfo: string }`
- Add `supplier: SupplierDto | null` to `ProductDto`
- Change `CreateProductRequest` to: `Omit<ProductDto, 'id' | 'category' | 'supplier'> & { categoryId: string; supplierId: string }`
- Change `UpdateProductRequest` to: `Partial<Omit<ProductDto, 'id' | 'category' | 'supplier'>> & { categoryId?: string; supplierId?: string }`

**Modify service:** `features/products/services/product.service.ts`
- Add `private readonly suppliersUrl = \`${this.environmentConfig.apiUrl}/suppliers\``
- Add `private readonly _suppliers = signal<SupplierDto[]>([])`
- Add `readonly suppliers = this._suppliers.asReadonly()`
- Add `loadSuppliers()` method (same pattern as `loadCategories()`)
- Update `create()` and `update()` type signatures to match new DTOs

**Modify form types:** `features/products/types/product-form.types.ts`
- Add `supplierId: FormControl<string>` to `ProductFormControls`

**Modify form utils:** `features/products/utils/product-form.utils.ts`
- Add `supplierId` FormControl with `Validators.required`, default `product?.supplier?.id ?? ''`

**Modify form component:** `features/products/components/views/product-form/`
- Add `suppliers = input.required<SupplierDto[]>()` input
- Add supplier `<select>` dropdown in template (after category, same HTML pattern)

**Modify create page:** `features/products/components/pages/product-create-page/`
- Add `readonly suppliers = this.productService.suppliers;`
- In `ngOnInit()`: call `this.productService.loadSuppliers().pipe(take(1)).subscribe()`
- In template: pass `[suppliers]="suppliers()"` to form
- In `onSubmit()`: include `supplierId: formValue.supplierId` in productData
- In template loading guard: also check `suppliers().length > 0`

**Modify update page:** `features/products/components/pages/product-update-page/`
- Add `readonly suppliers = this.productService.suppliers;`
- In `ngOnInit()`: call `this.productService.loadSuppliers().pipe(take(1)).subscribe()`
- In form-patch effect: add `supplierId: prod.supplier?.id ?? ''`
- In `onSubmit()`: include `supplierId: formValue.supplierId`
- In `retry()`: also reload suppliers
- In template: pass `[suppliers]="suppliers()"` to form, adjust guard to also check `suppliers().length > 0`

**Modify detail page:** `features/products/components/pages/product-detail-page/product-detail-page.component.html`
- Add supplier display below category badge, wrapped in `@if (product()!.supplier)` null check

**Modify product card:** `features/products/components/views/product-card/`
- Optionally show supplier name, null-checked

**Create:** `core/mocks/interceptors/handlers/suppliers-handler.mock.ts`
- Export `MOCK_SUPPLIERS` array (3 suppliers)
- Handle `GET /suppliers` → return all
- Handle `GET /suppliers/{id}` → return one or 404

**Modify:** `core/mocks/data/products.mock.ts`
- Add `MOCK_SUPPLIERS` import/export
- Add `supplier` field to each product in `MOCK_PRODUCTS`

**Modify:** `core/mocks/interceptors/handlers/products-handler.mock.ts`
- Update `handleCreateProduct` and `handleUpdateProduct` to resolve `supplierId` → supplier object from `MOCK_SUPPLIERS`

**Modify:** `core/mocks/interceptors/mock-api.interceptor.ts`
- Import `handleSuppliersFeature` from new handler
- Add dispatch block for suppliers (between products and orders)

---

## Subtask 7: Tests

**Create:** `controller/SupplierControllerTest.java`
- WebMvcTest following `ProductCategoryControllerTest` pattern
- Test GET all, GET by id, 404 for not found

**Modify:** `controller/ProductControllerTest.java`
- Update `productResponse()` helper to include `.supplier(SupplierDto.builder().id(supplierId).name("Acme").build())`
- Add a test that verifies a product response with `supplier: null` serializes correctly (simulating legacy product)

---

## Edge Cases Addressed

| Edge Case | Resolution |
|-----------|-----------|
| Existing products have NULL supplier | DB column is nullable; mapper null-checks; frontend null-checks display |
| Update form for product with no supplier | Form defaults to `''` which shows "Select a supplier" placeholder |
| Frontend `create()` type includes unwanted `supplier` object | Type explicitly omits `supplier` alongside `category` |
| `UpdateProductRequest` could send nested supplier | Type explicitly omits `supplier`, uses `supplierId` string |
| Mock interceptor won't match `/suppliers` path | Separate handler file registered in interceptor |
| Loading race condition (categories + suppliers) | Both set `_loading` but `finalize` resets it — acceptable since we gate on `categories().length > 0 && suppliers().length > 0` in templates |
| OrderDetailResponseDto side-effect | Additive field (supplier or null), backwards compatible, no action |
| Invalid supplierId sent to backend | Same behavior as invalid categoryId today — DB FK violation returns 500. Pre-existing pattern, not regressed. |

---

## Manual Testing Instructions

### Prerequisites

```bash
# 1. Start database
cd docker/development
docker-compose up -d

# 2. Start backend
cd onlineshopapi
mvn spring-boot:run -Dspring-boot.run.profiles=local

# 3. Start frontend
cd onlineshopui
npm start
```

### Test 1: Verify Migrations Applied

```bash
# Check Flyway applied V2 and V2.1
curl http://localhost:3000/api/suppliers
```

**Expected:** JSON array with 3 suppliers (TechVision Electronics, FashionHub Wholesale, HomeBase Supplies)

### Test 2: Products Include Supplier

```bash
curl http://localhost:3000/api/products
```

**Expected:** Each product JSON object includes a `"supplier"` field with `{ "id": "...", "name": "...", "contactInfo": "..." }`

### Test 3: Get Supplier by ID

```bash
curl http://localhost:3000/api/suppliers/{id-from-test-1}
```

**Expected:** Single supplier object, 200 OK

```bash
curl http://localhost:3000/api/suppliers/00000000-0000-0000-0000-000000000000
```

**Expected:** 404 Not Found

### Test 4: Create Product with Supplier (Admin)

1. Open browser at `http://localhost:4200`
2. Log in as `admin@onlineshop.com` / `password`
3. Navigate to Products → "Add New Product"
4. Fill in all fields
5. **Verify:** Supplier dropdown is visible and populated with 3 options
6. **Verify:** Submitting without selecting a supplier shows validation error
7. Select a supplier and submit
8. **Verify:** Product appears in catalog with correct supplier info

### Test 5: Update Product (Admin)

1. As admin, click Edit on any existing product
2. **Verify:** Supplier dropdown shows the product's current supplier pre-selected
3. Change supplier to a different one, submit
4. **Verify:** Product detail page shows updated supplier

### Test 6: Product Detail Page (Customer)

1. Log in as `john.doe@email.com` / `password`
2. Click on any product to view details
3. **Verify:** Supplier name is displayed (near category badge)
4. **Verify:** No errors in browser console

### Test 7: Mock Mode

```bash
cd onlineshopui
npm run start:mock
```

1. Repeat Tests 4-6 using mock mode
2. **Verify:** Mock handlers return suppliers correctly
3. **Verify:** Creating a product in mock mode resolves supplier

### Test 8: Backend Unit Tests

```bash
cd onlineshopapi
mvn test
```

**Expected:** All tests pass, including new `SupplierControllerTest` and updated `ProductControllerTest`

### Test 9: Edge Case - Product with No Supplier

```bash
# Manually null out a product's supplier to simulate legacy data
docker exec -it development-postgres-1 psql -U shopuser -d shopdb -c \
  "UPDATE products SET supplier_id = NULL WHERE id = 'fade0001-0000-0000-0000-000000000001';"
```

1. Refresh product catalog in browser
2. **Verify:** Product still renders without errors (supplier area is hidden or shows nothing)
3. Click into product detail page
4. **Verify:** No crash, supplier section absent
5. Edit the product as admin
6. **Verify:** Supplier dropdown shows "Select a supplier" (nothing pre-selected), form still submittable after selecting one
