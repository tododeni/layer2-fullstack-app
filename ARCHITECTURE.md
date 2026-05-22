# Architecture

A fullstack e-commerce platform enabling customers to browse products, manage shopping carts, and place orders while administrators manage product inventory.

**Stack**: Spring Boot 4.0.6 (Java 21) + Angular 21 + PostgreSQL 18

## System overview

```
┌─────────────┐      HTTPS/REST      ┌──────────────┐      JDBC       ┌────────────┐
│   Angular   │ ───────────────────> │  Spring Boot │ ──────────────> │ PostgreSQL │
│   Frontend  │ <─────────────────── │   Backend    │ <────────────── │  Database  │
│  (Port 4200)│      JSON + JWT      │ (Port 3000)  │   JPA/Hibernate │            │
└─────────────┘                       └──────────────┘                 └────────────┘
```

**User flows**:
- Browse product catalog by category
- Add products to cart and place orders
- View order history and details
- Admins create, update, and delete products
- JWT-based authentication with role-based access control

## Technology stack

**Backend**:
- Spring Boot 4.0.6 with Java 21
- Spring Security + JWT authentication
- Spring Data JPA + Hibernate
- PostgreSQL 18 database
- Flyway for database migrations
- Lombok for boilerplate reduction
- SpringDoc OpenAPI 3 for API documentation

**Frontend**:
- Angular 21 (standalone components)
- TypeScript with strict mode
- Tailwind CSS 4 for styling
- RxJS for reactive programming
- Signals for state management
- Mock Service Worker (MSW) for API mocking

**Infrastructure**:
- Docker Compose for local PostgreSQL
- Maven for backend build
- npm/Angular CLI for frontend build

## Project structure

```
layer2-fullstack-app/
├── onlineshopapi/                 # Spring Boot backend
│   └── src/main/
│       ├── java/msg/onlineshopapi/
│       │   ├── config/            # App configuration (OpenAPI, CORS)
│       │   ├── controller/        # REST API endpoints
│       │   ├── dto/               # Data Transfer Objects
│       │   │   └── mapper/        # Entity <-> DTO converters
│       │   ├── exception/         # Custom exceptions + global handler
│       │   ├── model/             # JPA entities (domain models)
│       │   ├── repository/        # Spring Data JPA repositories
│       │   ├── security/          # Security config, JWT filter, user details
│       │   └── service/           # Business logic layer
│       │       └── strategy/      # Order processing strategies
│       └── resources/
│           ├── application.yml         # Main configuration
│           ├── application-local.yml   # Local dev overrides
│           └── db/migration/           # Flyway SQL migrations
├── onlineshopui/                  # Angular frontend
│   └── src/app/
│       ├── clib/                  # Component library (shared UI)
│       │   ├── components/        # Reusable components (navbar, modal, card)
│       │   ├── layouts/           # Layout components
│       │   └── services/          # Shared services
│       ├── core/                  # Core functionality
│       │   ├── config/            # Constants and navigation
│       │   ├── mocks/             # MSW handlers for mock mode
│       │   ├── services/          # Core services (notifications, environment)
│       │   └── types/             # Shared types, DTOs, enums
│       └── features/              # Feature modules (lazy-loaded)
│           ├── auth/              # Authentication (login, register, guards)
│           ├── cart/              # Shopping cart management
│           ├── orders/            # Order history and details
│           └── products/          # Product catalog and admin CRUD
└── docker/development/
    └── docker-compose.yml         # PostgreSQL container setup
```

## Backend architecture

### N-Tier layering

The backend follows a clean 4-layer architecture with strict dependency direction:

```
Controller → Service → Repository → Database
   ↓           ↓          ↓
  DTO    Business Logic  JPA Entity
```

**Dependency rules**:
- Each layer depends only on the layer directly below
- Higher layers never depend on lower layer implementation details
- DTOs isolate API contracts from domain models

### Layer responsibilities

**Controller layer**: HTTP concerns only
- Maps HTTP requests to service calls
- Validates request data (`@Valid`)
- Converts entities to DTOs for responses
- Enforces authorization (`@PreAuthorize`)
- Never contains business logic

**Service layer**: Business logic and transactions
- Orchestrates business operations
- Manages transaction boundaries (`@Transactional`)
- Coordinates between repositories
- Throws domain exceptions
- No HTTP or persistence concerns

**Repository layer**: Data access abstraction
- Extends `JpaRepository` for CRUD operations
- Custom queries via `@Query` or method naming
- Returns JPA entities
- No business logic

**Model layer**: Domain entities
- JPA entities with `@Entity` annotations
- Defines relationships (`@ManyToOne`, `@OneToMany`)
- Lombok annotations reduce boilerplate
- Simple getters/setters, no complex behavior

### Key components

**Controller example** (ProductController.java:23-76):
```java
@RestController
@RequestMapping("/products")
@RequiredArgsConstructor  // Constructor injection via Lombok
public class ProductController {
    private final ProductService productService;
    private final ProductMapper productMapper;

    @GetMapping
    public List<ProductResponseDto> getAll() {
        // Delegate to service, map to DTOs
        return productService.findAll().stream()
                .map(productMapper::toDto)
                .toList();
    }

    @PreAuthorize("hasRole('ADMIN')")  // Authorization at controller
    @PostMapping
    public ProductResponseDto create(@RequestBody ProductRequestDto dto) {
        // Service handles business logic, mapper converts Entity <-> DTO
        return productMapper.toDto(productService.save(productMapper.toEntity(dto)));
    }
}
```

**Service example** (ProductService.java:13-46):
```java
@Service
@RequiredArgsConstructor
public class ProductService {
    private final ProductRepository productRepository;

    public List<Product> findAll() {
        return productRepository.findAll();
    }

    @Transactional  // Transaction boundary at service method
    public Product update(UUID id, Product product) {
        Product existing = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        // Business logic: update fields
        existing.setName(product.getName());
        existing.setPrice(product.getPrice());
        return productRepository.save(existing);
    }
}
```

**Repository example** (ProductRepository.java:8-9):
```java
@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {
    // Spring Data JPA provides implementations for standard CRUD
    // Custom queries added via method naming or @Query
}
```

**Entity example** (Product.java:9-38):
```java
@Entity
@Table(name = "products")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private BigDecimal price;

    @ManyToOne(fetch = FetchType.LAZY)  // Relationship to category
    @JoinColumn(name = "category_id")
    private ProductCategory category;
}
```

**DTO + Mapper pattern**: Controllers use DTOs, not entities
```java
// DTO exposed in REST API
public record ProductResponseDto(UUID id, String name, BigDecimal price, ...) {}

// Mapper converts Entity <-> DTO
@Component
public class ProductMapper {
    public ProductResponseDto toDto(Product entity) { ... }
    public Product toEntity(ProductRequestDto dto) { ... }
}
```

### Security architecture

**Authentication flow**:
1. User sends credentials to `/auth/login`
2. `AuthService` validates and generates JWT via `JwtService`
3. Frontend stores token in localStorage
4. `AuthTokenInterceptor` (Angular) adds `Authorization: Bearer {token}` to all requests
5. `JwtAuthFilter` (Spring) validates token before controller execution

**JWT token structure** (JwtService.java):
- Subject: user email
- Claim: role (ADMIN or CUSTOMER)
- Expiration: configurable via `jwt.expiration-ms`
- Signed with HMAC SHA-256

**Authorization enforcement** (SecurityConfig.java:40-52):
```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // Enables @PreAuthorize
public class SecurityConfig {
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) {
        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/auth/register", "/auth/login").permitAll()
                .anyRequest().authenticated()  // All other endpoints require auth
            )
            .sessionManagement(session -> 
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
```

Method-level authorization:
```java
@PreAuthorize("hasRole('ADMIN')")
@PostMapping
public ProductResponseDto create(@RequestBody ProductRequestDto dto) { ... }
```

## Frontend architecture

### Feature-based structure

Angular application organized by features, each lazy-loaded for performance:

```
app/
├── clib/          # Shared component library (presentation components)
├── core/          # Singletons (services, guards, types, config)
└── features/      # Feature modules (auth, cart, orders, products)
    └── products/
        ├── components/  # Feature-specific UI
        ├── services/    # Feature API/state services
        ├── types/       # Feature types
        └── products.routes.ts
```

### Component hierarchy

**Page components**: Routable containers, coordinate data and views
- `ProductCatalogPageComponent` - displays product grid
- `ProductDetailPageComponent` - single product view
- `CartOverviewPageComponent` - shopping cart

**View components**: Pure presentation, receive data via `@Input`
- `ProductCardComponent` - product summary card
- `CartItemRowComponent` - cart item display

**Shared components** (in `clib/`): Reusable across features
- `NavbarComponent` - navigation bar
- `ModalComponent` - modal dialogs
- `SpinnerComponent` - loading indicator

### State management with signals

Services use Angular signals for reactive state (ProductService.ts:10-26):

```typescript
@Injectable({ providedIn: 'root' })
export class ProductService {
    private readonly _products = signal<ProductDto[]>([]);
    private readonly _loading = signal(false);
    private readonly _error = signal<string | null>(null);

    // Expose read-only signals
    readonly products = this._products.asReadonly();
    readonly loading = this._loading.asReadonly();
    readonly error = this._error.asReadonly();

    loadAll(): Observable<void> {
        this._loading.set(true);
        return this.http.get<ProductDto[]>(this.productsUrl).pipe(
            tap(products => this._products.set(products)),
            finalize(() => this._loading.set(false))
        );
    }
}
```

Components consume signals in templates:
```html
@if (productService.loading()) {
    <app-spinner />
} @else {
    @for (product of productService.products(); track product.id) {
        <app-product-card [product]="product" />
    }
}
```

### Routing and guards

**Lazy-loaded routes** (app.routes.ts:6-37):
```typescript
export const routes: Routes = [
    {
        path: 'auth',
        loadChildren: () => import('./features/auth/auth.routes')
    },
    {
        path: '',
        component: RootLayoutComponent,
        canActivate: [authGuard],  // Requires authentication
        children: [
            {
                path: 'products',
                loadChildren: () => import('./features/products/products.routes')
            },
            // ... other feature routes
        ]
    }
];
```

**Route guards**:
- `authGuard` - requires JWT token, redirects to login if missing
- `rolesGuard` - checks user role (ADMIN/CUSTOMER)
- `guestGuard` - allows only unauthenticated users (login/register pages)

**Interceptor** (AuthTokenInterceptor):
```typescript
// Adds JWT to all outgoing requests
intercept(req: HttpRequest<any>, next: HttpHandler) {
    const token = localStorage.getItem('token');
    if (token) {
        req = req.clone({
            setHeaders: { Authorization: `Bearer ${token}` }
        });
    }
    return next.handle(req);
}
```

### Mock mode with MSW

Development mode switches between real API and mocked responses:

**Environment configuration**:
- `npm start` → real backend at `http://localhost:3000/api`
- `npm run start:mock` → MSW intercepts and mocks API calls

**Mock handlers** (core/mocks/interceptors/):
```typescript
export const productHandlers = [
    http.get(`${API_URL}/products`, () => {
        return HttpResponse.json(mockProducts);
    }),
    http.post(`${API_URL}/products`, async ({ request }) => {
        const newProduct = await request.json();
        return HttpResponse.json({ id: uuid(), ...newProduct });
    })
];
```

## Database design

**Schema**: `onlineshop`

### Entity relationships

```
┌──────────┐       ┌──────────┐       ┌──────────────┐
│   User   │───┐   │  Order   │──┬───>│ OrderDetail  │
└──────────┘   │   └──────────┘  │    └──────────────┘
               │          │       │            │
               └──────────┘       │            │
                                  │            ├───> Product
                                  │            └───> Location (shipped_from)
                                  └───> Address

┌──────────┐       ┌───────────────┐       ┌──────────┐
│ Product  │<──────│     Stock     │──────>│ Location │
└──────────┘       └───────────────┘       └──────────┘
     │                 (quantity)
     └──> ProductCategory
```

### Key tables

**users**: User accounts with roles
```sql
id UUID PRIMARY KEY
email VARCHAR(255) UNIQUE NOT NULL
password VARCHAR(255) NOT NULL  -- BCrypt hashed
role VARCHAR(50) NOT NULL       -- 'ADMIN' or 'CUSTOMER'
```

**products**: Product catalog
```sql
id UUID PRIMARY KEY
name VARCHAR(255) NOT NULL
description TEXT
price DECIMAL(10,2) NOT NULL
weight DOUBLE
category_id UUID FK -> product_categories
image_url VARCHAR(500)
```

**orders**: Customer orders
```sql
id UUID PRIMARY KEY
user_id UUID FK -> users
address_id UUID FK -> addresses
created_at TIMESTAMP
```

**order_details**: Line items (composite key)
```sql
order_id UUID FK -> orders
product_id UUID FK -> products
PRIMARY KEY (order_id, product_id)
quantity INTEGER NOT NULL
shipped_from UUID FK -> locations  -- Fulfillment location
```

**stock**: Product inventory by location (composite key)
```sql
location_id UUID FK -> locations
product_id UUID FK -> products
PRIMARY KEY (location_id, product_id)
quantity INTEGER NOT NULL  -- Available stock
```

### Migrations

Flyway manages schema evolution via SQL scripts in `src/main/resources/db/migration/`:

- `V1__create_tables.sql` - Initial schema
- `local/V1.1__populate_mock_data.sql` - Seed data (local profile only)

Migrations run automatically on application startup.

## API design

Base URL: `http://localhost:3000/api`

### Authentication endpoints

```
POST /auth/register
Body: { email, password, role }
Response: { token, user: { id, email, role } }

POST /auth/login
Body: { email, password }
Response: { token, user: { id, email, role } }
```

### Product endpoints

```
GET /products
Response: ProductResponseDto[]

GET /products/{id}
Response: ProductResponseDto

POST /products          [ADMIN only]
Body: ProductRequestDto
Response: ProductResponseDto

PUT /products/{id}      [ADMIN only]
Body: ProductRequestDto
Response: ProductResponseDto

DELETE /products/{id}   [ADMIN only]
Response: 204 No Content
```

### Order endpoints

```
GET /orders             [Authenticated]
Response: OrderResponseDto[]

GET /orders/{id}        [Authenticated]
Response: OrderDetailResponseDto

POST /orders            [CUSTOMER only]
Body: OrderRequestDto
Response: OrderResponseDto
```

### Product category endpoints

```
GET /products/categories
Response: ProductCategoryDto[]
```

**API Documentation**: Swagger UI available at `http://localhost:3000/api/swagger-ui.html`

## Design patterns

### Repository pattern

Spring Data JPA repositories abstract database access:

```java
public interface OrderRepository extends JpaRepository<Order, UUID> {
    // Method naming convention generates query
    List<Order> findByUserEmail(String email);

    // Custom JPQL query
    @Query("SELECT o FROM Order o JOIN FETCH o.orderDetails WHERE o.id = :id")
    Optional<Order> findByIdWithDetails(@Param("id") UUID id);
}
```

### DTO pattern

Controllers never expose entities directly:

```
Request → DTO → Mapper → Entity → Service → Repository
Response ← DTO ← Mapper ← Entity ← Service ← Repository
```

**Benefits**:
- API contracts independent of database schema
- Hide internal entity relationships from clients
- Version APIs without changing domain models

### Strategy pattern

Order fulfillment strategies select inventory allocation algorithm (OrderService.java:27):

```java
@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderStrategy orderStrategy;  // Injected based on config

    @Transactional
    public Order createOrder(Order order, String email) {
        // Strategy determines which location(s) fulfill the order
        List<Stock> stocks = orderStrategy.findStocks(order.getOrderDetails());
        // ... deduct stock and create order details
    }
}
```

**Implementations**:

**SingleLocationStrategy** (service/strategy/SingleLocationStrategy.java):
- Ships entire order from one location
- Minimizes shipping complexity
- Throws exception if no single location has all products

**MostAbundantStrategy**:
- Ships from multiple locations
- Maximizes order fulfillment rate
- Splits order across locations if needed

Configured via `application.yml`:
```yaml
order:
  strategy: SINGLE_LOCATION  # or MULTIPLE_LOCATIONS
```

### Dependency injection

Constructor injection with Lombok's `@RequiredArgsConstructor`:

```java
@Service
@RequiredArgsConstructor  // Generates constructor for final fields
public class ProductService {
    private final ProductRepository productRepository;
    // Spring injects ProductRepository automatically
}
```

**Why constructor injection**:
- Makes dependencies explicit
- Enables immutability (final fields)
- Simplifies testing (pass mocks to constructor)
- Compile-time safety (missing dependency = compiler error)

### Builder pattern

Lombok's `@Builder` simplifies complex object construction:

```java
Product product = Product.builder()
    .name("Laptop")
    .price(new BigDecimal("999.99"))
    .category(category)
    .build();
```

## Authentication & authorization

### JWT flow

1. **Login** (AuthService.java):
   ```java
   public AuthResponseDto login(LoginRequestDto request) {
       // Authenticate via Spring Security
       Authentication auth = authenticationManager.authenticate(
           new UsernamePasswordAuthenticationToken(
               request.getEmail(), request.getPassword()));

       // Generate JWT
       String token = jwtService.generateToken(user);
       return new AuthResponseDto(token, userMapper.toDto(user));
   }
   ```

2. **Frontend stores token** (auth.service.ts):
   ```typescript
   login(credentials: LoginRequest): Observable<void> {
       return this.http.post<AuthResponse>('/auth/login', credentials).pipe(
           tap(response => {
               localStorage.setItem('token', response.token);
               this._currentUser.set(response.user);
           })
       );
   }
   ```

3. **Request with token** (AuthTokenInterceptor):
   ```typescript
   intercept(req: HttpRequest<any>, next: HttpHandler) {
       const token = localStorage.getItem('token');
       if (token) {
           req = req.clone({
               setHeaders: { Authorization: `Bearer ${token}` }
           });
       }
       return next.handle(req);
   }
   ```

4. **Backend validates token** (JwtAuthFilter.java):
   ```java
   @Override
   protected void doFilterInternal(HttpServletRequest request, ...) {
       String token = extractTokenFromHeader(request);
       if (token != null && jwtService.validateToken(token)) {
           String email = jwtService.extractEmail(token);
           UserDetails userDetails = userDetailsService.loadUserByUsername(email);
           // Set authentication in SecurityContext
           SecurityContextHolder.getContext().setAuthentication(...);
       }
       filterChain.doFilter(request, response);
   }
   ```

### Role-based access control

**Backend**: `@PreAuthorize` on controller methods
```java
@PreAuthorize("hasRole('ADMIN')")
@PostMapping
public ProductResponseDto create(@RequestBody ProductRequestDto dto) { ... }
```

**Frontend**: `*hasRole` directive on templates
```html
<button *hasRole="'ADMIN'" (click)="deleteProduct()">Delete</button>
```

**Route guards**: Prevent navigation based on role
```typescript
{
    path: 'products/create',
    component: ProductCreatePageComponent,
    canActivate: [authGuard, rolesGuard],
    data: { roles: ['ADMIN'] }
}
```

## Development workflow

### Local setup

1. **Start database**:
   ```bash
   cd docker/development
   docker-compose up -d
   ```

2. **Start backend** (runs on port 3000):
   ```bash
   cd onlineshopapi
   mvn spring-boot:run -Dspring-boot.run.profiles=local
   ```

3. **Start frontend** (runs on port 4200):
   ```bash
   cd onlineshopui
   npm install
   npm start              # Real API
   npm run start:mock     # Mock API
   ```

### Testing

**Backend tests**:
```bash
cd onlineshopapi
mvn test                           # Unit + integration tests
mvn test -Dtest=ProductServiceTest # Single test class
```

**Frontend tests**:
```bash
cd onlineshopui
npm test                           # Karma + Jasmine
npm test -- --include='**/product.service.spec.ts'
```

### Code quality

**Backend**:
- Lombok annotation processing (enable in IDE)
- Maven enforces compilation

**Frontend**:
```bash
cd onlineshopui
npm run lint          # ESLint
npm run format        # Prettier
ng build              # TypeScript compilation
```

## Reference

### Quick commands

```bash
# Database
docker-compose up -d
docker-compose down

# Backend
mvn clean install
mvn spring-boot:run -Dspring-boot.run.profiles=local
mvn test

# Frontend
npm install
npm start
npm run start:mock
npm test
npm run lint
npm run format
ng build
```

### Environment variables

**Backend** (application-local.yml has defaults):
- `DB_HOST`, `DB_PORT`, `DB_NAME` - Database connection
- `DB_USERNAME`, `DB_PASSWORD` - Database credentials
- `JWT_SECRET` - JWT signing key
- `JWT_EXPIRATION_MS` - Token validity period
- `CORS_ALLOWED_ORIGINS` - Allowed CORS origins

**Frontend** (environment files):
- `API_URL` - Backend base URL (default: `http://localhost:3000/api`)

### Test credentials (local mock data)

**Admin**:
- Email: `admin@example.com`
- Password: `admin123`

**Customer**:
- Email: `customer@example.com`
- Password: `customer123`

### Ports

- Frontend: `http://localhost:4200`
- Backend: `http://localhost:3000`
- Backend API: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/api/swagger-ui.html`
- PostgreSQL: `localhost:5432`
