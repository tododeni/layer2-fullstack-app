# Plan: Add Supplier Support to Products

## Context

The e-commerce application needs to track which supplier provides each product. Currently, products only have a category relationship. We need to add a `suppliers` table, link products to suppliers via FK, expose GET endpoints for suppliers, include supplier data in product responses, and add a supplier dropdown to the product creation/update form.

The implementation follows the exact same patterns as the existing `ProductCategory` feature (entity, DTO, mapper, repository, service, controller).

---

## Subtask 1: Database Schema Migration

**Create:** `onlineshopapi/src/main/resources/db/migration/V2__add_suppliers.sql`

- Create `suppliers` table: `id` (UUID PK), `name` (VARCHAR 255 NOT NULL), `contact_info` (VARCHAR 500 nullable)
- Add nullable `supplier_id` (UUID) column to `products` table with FK to `suppliers(id)`

---

## Subtask 2: Mock Data Migration

**Create:** `onlineshopapi/src/main/resources/db/migration/local/V2.1__populate_suppliers_mock_data.sql`

- Insert 3 suppliers (TechVision Electronics, FashionHub Wholesale, HomeBase Supplies)
- Update existing 10 products to assign supplier_id based on their category

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
- `model/Product.java` - add `@ManyToOne @JoinColumn(name = "supplier_id") Supplier supplier`
- `dto/ProductRequestDto.java` - add `UUID supplierId` field
- `dto/ProductResponseDto.java` - add `SupplierDto supplier` field
- `dto/mapper/ProductMapper.java` - inject `SupplierMapper`, map supplier in toDto() (null-safe) and toEntity()
- `service/ProductService.java` - add `existing.setSupplier(product.getSupplier())` in update()

---

## Subtask 5: Backend - Supplier Controller (GET only)

**Create:** `controller/SupplierController.java`

- `GET /suppliers` - returns `List<SupplierDto>` (no auth required)
- `GET /suppliers/{id}` - returns `SupplierDto` or 404
- OpenAPI annotations following `ProductCategoryController` pattern

---

## Subtask 6: Frontend Changes

**Modify types:** `core/types/dtos/product.dto.ts`
- Add `SupplierDto` type (id, name, contactInfo)
- Add `supplier: SupplierDto | null` to `ProductDto`
- Add `supplierId` to `CreateProductRequest` and `UpdateProductRequest`

**Modify service:** `features/products/services/product.service.ts`
- Add `_suppliers` signal, `suppliers` readonly, `suppliersUrl`
- Add `loadSuppliers()` method (same pattern as `loadCategories()`)

**Modify form types:** `features/products/types/product-form.types.ts`
- Add `supplierId: FormControl<string>` to `ProductFormControls`

**Modify form utils:** `features/products/utils/product-form.utils.ts`
- Add `supplierId` FormControl with `Validators.required`

**Modify form component:** `features/products/components/views/product-form/`
- Add `suppliers` input signal (same as `categories`)
- Add supplier `<select>` dropdown in template (after category)

**Modify create page:** `features/products/components/pages/product-create-page/`
- Expose `suppliers` from service, call `loadSuppliers()` in ngOnInit
- Pass `[suppliers]="suppliers()"` to form, include `supplierId` in submit data

**Modify update page:** `features/products/components/pages/product-update-page/`
- Same changes: load suppliers, pass to form, patch supplierId, include in submit

**Modify mock handler:** `core/mocks/interceptors/handlers/products-handler.mock.ts`
- Add `MOCK_SUPPLIERS` data and `supplier` to `MOCK_PRODUCTS`
- Add handlers for `GET /suppliers` and `GET /suppliers/{id}`
- Update create/update handlers to resolve supplierId to supplier object

**Modify mock interceptor:** `core/mocks/interceptors/mock-api.interceptor.ts`
- Add supplier route dispatch (or handle within existing products handler since suppliers are product-related)

---

## Subtask 7: Tests

**Create:** `controller/SupplierControllerTest.java`
- WebMvcTest following `ProductCategoryControllerTest` pattern
- Test GET all, GET by id, 404 for not found

**Modify:** `controller/ProductControllerTest.java`
- Update product response fixtures to include supplier field
- Verify supplier is present in GET responses

---

## Verification

1. Start database: `cd docker/development && docker-compose up -d`
2. Run backend: `cd onlineshopapi && mvn spring-boot:run -Dspring-boot.run.profiles=local`
   - Verify Flyway migrations apply successfully
   - Test `GET /api/suppliers` returns 3 suppliers
   - Test `GET /api/products` returns products with supplier data
3. Run frontend: `cd onlineshopui && npm start`
   - Navigate to product creation form as admin
   - Verify supplier dropdown is populated and required
   - Create a product with supplier selected
4. Run backend tests: `cd onlineshopapi && mvn test`
5. Run frontend in mock mode: `npm run start:mock` - verify mock handlers work
