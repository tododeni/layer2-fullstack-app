# Architecture

A fullstack e-commerce application enabling product catalog management, shopping cart operations, and order processing with role-based access control.

**Stack**: Spring Boot 4 (backend), Angular 21 (frontend), PostgreSQL 18 (database)

## System overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Angular 21 Frontend (Port 4200)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Features   │  │     Core     │  │     Clib     │      │
│  │  (Lazy Load) │  │  (Services)  │  │ (Components) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API (JSON)
                         │ JWT Bearer Token
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           Spring Boot 4 Backend (Port 3000/api)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Controllers  │  │   Services   │  │ Repositories │      │
│  │    (REST)    │─▶│  (Business)  │─▶│     (JPA)    │      │
│  └──────────────┘  └──────────────┘  └──────┬───────┘      │
│                                               │              │
│  ┌──────────────┐  ┌──────────────┐         │              │
│  │   Security   │  │    DTOs      │         │              │
│  │ (JWT/Spring) │  │   Mappers    │         │              │
│  └──────────────┘  └──────────────┘         │              │
└──────────────────────────────────────────────┼──────────────┘
                                               │ JDBC
                                               ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL 18 (Port 5432/5433)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Schema: onlineshop                                  │   │
│  │  ┌────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐   │   │
│  │  │ users  │ │ products │ │ orders │ │  stocks  │   │   │
│  │  └────────┘ └──────────┘ └────────┘ └──────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Capabilities**:

- Register and authenticate users with JWT tokens
- Browse products by category with search and filtering
- Manage shopping cart with real-time price calculations
- Place orders with multi-location inventory fulfillment
- Administer products, categories, and stock (admin only)

---

## Technology stack

**Backend**:
- Java 21 with Spring Boot 4.0.3
- Spring Security + JWT (jjwt 0.13.0) for authentication
- Spring Data JPA with PostgreSQL 18
- Flyway for schema migrations
- Lombok for code generation
- Maven for builds
- Testcontainers 2.0.5 for integration tests

**Frontend**:
- Angular 21.2.0 with TypeScript 5.9.2
- RxJS 7.8.0 for reactive state
- Tailwind CSS 4.1.12 for styling
- Vitest 4.0.8 for unit tests
- ESLint 10.0.2 + Prettier 3.8.1 for code quality

**Infrastructure**:
- Docker + Docker Compose for local database
- Swagger UI (SpringDoc OpenAPI 3.0.3) for API docs

---

## Project structure

```
layer2-fullstack-app/
├── onlineshopapi/                    # Backend (Spring Boot 4)
│   ├── src/main/java/msg/onlineshopapi/
│   │   ├── config/                   # OpenAPI, CORS config
│   │   ├── controller/               # REST endpoints
│   │   ├── dto/                      # Request/response DTOs
│   │   │   └── mapper/               # Entity-DTO mappers
│   │   ├── exception/                # Custom exceptions, handlers
│   │   ├── model/                    # JPA entities
│   │   ├── repository/               # Spring Data repositories
│   │   ├── security/                 # JWT filter, SecurityConfig
│   │   └── service/                  # Business logic
│   │       └── strategy/             # Order fulfillment strategies
│   ├── src/main/resources/
│   │   ├── application.yml           # Base config
│   │   ├── application-local.yml     # Local overrides
│   │   └── db/migration/             # Flyway SQL migrations
│   └── pom.xml
│
├── onlineshopui/                     # Frontend (Angular 21)
│   ├── src/app/
│   │   ├── features/                 # Lazy-loaded feature modules
│   │   │   ├── auth/                 # Login, register, guards
│   │   │   ├── cart/                 # Cart management
│   │   │   ├── orders/               # Order history
│   │   │   └── products/             # Product catalog + admin
│   │   ├── core/
│   │   │   ├── config/               # Route constants, API URLs
│   │   │   ├── mocks/                # MSW handlers
│   │   │   ├── providers/            # DI config
│   │   │   ├── services/             # Notifications, environment
│   │   │   └── types/                # Shared DTOs, enums
│   │   └── clib/                     # Shared UI components
│   │       ├── components/           # Navbar, modals, cards
│   │       ├── layouts/              # Root layout
│   │       └── services/             # Shared services
│   ├── angular.json
│   └── package.json
│
├── docker/development/
│   └── docker-compose.yml            # PostgreSQL 18 setup
│
└── docs/
    └── ARCHITECTURE.md               # This file
```

---

## Backend architecture

**N-Tier layering**:

```
Controller → Service → Repository → Database
   (REST)    (Logic)      (JPA)    (PostgreSQL)
```

Controllers expose REST endpoints, services contain business logic and transaction boundaries, repositories abstract database access via Spring Data JPA, and Flyway manages schema evolution.

### Key components

**Controllers** (`controller/`) expose REST endpoints with DTOs and `@PreAuthorize` role checks:

```java
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {
    private final ProductService productService;
    
    @GetMapping
    public List<ProductResponseDto> getAllProducts() {
        return productService.findAll();
    }
    
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ProductResponseDto createProduct(@RequestBody ProductRequestDto dto) {
        return productService.create(dto);
    }
}
```

**Services** (`service/`) handle business logic, transactions, and entity-DTO mapping:

```java
@Service
@RequiredArgsConstructor
public class ProductService {
    private final ProductRepository productRepository;
    private final ProductMapper productMapper;
    
    public ProductResponseDto create(ProductRequestDto dto) {
        Product product = productMapper.toEntity(dto);
        Product saved = productRepository.save(product);
        return productMapper.toDto(saved);
    }
}
```

**Repositories** (`repository/`) use Spring Data JPA for database access:

```java
public interface ProductRepository extends JpaRepository<Product, UUID> {
    List<Product> findByCategoryId(UUID categoryId);
    Optional<Product> findByName(String name);
}
```

**Models** (`model/`) define JPA entities with Lombok annotations:

```java
@Entity
@Table(name = "products", schema = "onlineshop")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Product {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    private String name;
    private Double price;
    
    @ManyToOne
    @JoinColumn(name = "category_id")
    private ProductCategory category;
}
```

**DTOs** (`dto/`) use Java records for immutable API contracts.

**Security** (`security/`) implements JWT authentication:
- `JwtService` generates and validates tokens
- `JwtAuthFilter` extracts JWT from `Authorization` header
- `SecurityConfig` configures security filter chain

---

## Frontend architecture

Feature-based architecture with lazy-loaded routes, standalone components, and reactive state via Angular signals:

```
src/app/
├── features/              # Feature modules (lazy-loaded)
│   ├── auth/             # Authentication feature
│   │   ├── components/
│   │   ├── guards/       # authGuard, guestGuard
│   │   ├── interceptors/ # authTokenInterceptor
│   │   ├── services/     # authService
│   │   └── auth.routes.ts
│   │
│   ├── products/         # Product catalog feature
│   │   ├── components/
│   │   ├── services/     # productService
│   │   └── products.routes.ts
│   │
│   ├── cart/             # Shopping cart feature
│   │   ├── components/
│   │   ├── services/     # cartService
│   │   └── cart.routes.ts
│   │
│   └── orders/           # Order management feature
│       ├── components/
│       ├── services/     # ordersService
│       └── orders.routes.ts
│
├── core/                 # Core application functionality
│   ├── config/
│   │   └── constants/    # Route constants, API URLs
│   ├── services/         # Core services (notifications, environment)
│   ├── types/            # Shared types, DTOs, enums
│   ├── mocks/            # MSW mock handlers
│   └── providers/        # DI providers
│
├── clib/                 # Shared component library
│   ├── components/       # Reusable UI components
│   │   ├── navbar/
│   │   ├── modals/
│   │   ├── cards/
│   │   └── buttons/
│   ├── layouts/          # Layout components
│   │   └── root-layout/
│   └── services/         # Shared services
│
├── app.routes.ts         # Main routing configuration
└── app.ts                # Root component
```

### Component patterns

**Smart components** (feature modules) fetch data and manage state:

```typescript
@Component({
  selector: 'app-products-page',
  template: `<app-product-list [products]="products()" (addToCart)="onAddToCart($event)">`
})
export class ProductsPageComponent {
  private productService = inject(ProductService);
  products = signal<Product[]>([]);
  
  ngOnInit() {
    this.productService.getAll().subscribe(products => this.products.set(products));
  }
  
  onAddToCart(product: Product) {
    this.cartService.addItem(product);
  }
}
```

**Presentational components** (`clib/`) receive data via `@Input()` and emit events via `@Output()`.

**Services** communicate with the API:

```typescript
@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private apiUrl = inject(ENVIRONMENT_CONFIG).apiUrl;
  
  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/products`);
  }
}
```

**Route guards** control access:

```typescript
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (authService.isAuthenticated()) return true;
  
  router.navigate(['/auth/login']);
  return false;
};
```

**HTTP interceptors** add JWT tokens to requests:

```typescript
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  
  return next(req);
};
```

---

## Database design

Schema: `onlineshop`

### Entity relationships

```
┌─────────────┐
│    users    │
│─────────────│
│ id (PK)     │───┐
│ email       │   │
│ password    │   │
│ first_name  │   │
│ last_name   │   │
│ role        │   │
└─────────────┘   │
                  │
                  │ 1:N
                  │
                  ▼
         ┌─────────────┐
         │   orders    │
         │─────────────│
    ┌────│ id (PK)     │
    │    │ user_id(FK) │
    │    │ created_at  │
    │    │ country     │
    │    │ city        │
    │    │ county      │
    │    │ address     │
    │    └─────────────┘
    │           │
    │ 1:N       │ 1:N
    │           │
    │           ▼
    │   ┌──────────────────┐
    │   │ order_details    │
    │   │──────────────────│
    │   │ order_id (FK,PK) │
    └──▶│ product_id(FK,PK)│◀──┐
        │ location_id (FK) │   │
        │ quantity         │   │ 1:N
        └──────────────────┘   │
                               │
┌──────────────────┐           │
│product_categories│           │
│──────────────────│           │
│ id (PK)          │───┐       │
│ name             │   │       │
│ description      │   │       │
└──────────────────┘   │       │
                       │ 1:N   │
                       │       │
                       ▼       │
               ┌─────────────┐ │
               │  products   │ │
               │─────────────│ │
          ┌────│ id (PK)     │─┘
          │    │category_id  │
          │    │ name        │
          │    │ description │
          │    │ price       │
          │    │ weight      │
          │    │ image_url   │
          │    └─────────────┘
          │           │
          │ N:M       │ 1:N
          │           │
          │           ▼
          │    ┌─────────────────┐
          │    │     stocks      │
          │    │─────────────────│
          └───▶│ product_id (FK) │
               │ location_id(FK) │
          ┌───▶│ quantity        │
          │    └─────────────────┘
          │ 1:N
          │
   ┌──────────────┐
   │  locations   │
   │──────────────│
   │ id (PK)      │
   │ name         │
   │ country      │
   │ city         │
   │ county       │
   │ address      │
   └──────────────┘
```

### Tables

**users**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | User identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email |
| password | VARCHAR(255) | NOT NULL | Hashed password |
| first_name | VARCHAR(100) | NOT NULL | First name |
| last_name | VARCHAR(100) | NOT NULL | Last name |
| role | VARCHAR(20) | NOT NULL | User role (ADMIN/CUSTOMER) |

**product_categories**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Category identifier |
| name | VARCHAR(100) | UNIQUE, NOT NULL | Category name |
| description | TEXT | | Category description |

**products**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Product identifier |
| category_id | UUID | FOREIGN KEY | Reference to category |
| name | VARCHAR(255) | NOT NULL | Product name |
| description | TEXT | | Product description |
| price | DECIMAL(10,2) | NOT NULL | Product price |
| weight | DOUBLE | NOT NULL | Product weight (grams) |
| image_url | VARCHAR(500) | | Product image URL |

**locations**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Location identifier |
| name | VARCHAR(100) | NOT NULL | Location name |
| country | VARCHAR(100) | NOT NULL | Country |
| city | VARCHAR(100) | NOT NULL | City |
| county | VARCHAR(100) | | County |
| street_address | VARCHAR(255) | NOT NULL | Street address |

**stocks**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| product_id | UUID | PRIMARY KEY, FOREIGN KEY | Reference to product |
| location_id | UUID | PRIMARY KEY, FOREIGN KEY | Reference to location |
| quantity | INTEGER | NOT NULL | Available quantity |

**orders**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Order identifier |
| user_id | UUID | FOREIGN KEY | Reference to user |
| created_at | TIMESTAMP | NOT NULL | Order creation time |
| country | VARCHAR(100) | NOT NULL | Shipping country |
| city | VARCHAR(100) | NOT NULL | Shipping city |
| county | VARCHAR(100) | | Shipping county |
| street_address | VARCHAR(255) | NOT NULL | Shipping address |

**order_details**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| order_id | UUID | PRIMARY KEY, FOREIGN KEY | Reference to order |
| product_id | UUID | PRIMARY KEY, FOREIGN KEY | Reference to product |
| shipped_from_id | UUID | FOREIGN KEY | Reference to location |
| quantity | INTEGER | NOT NULL | Order quantity |

### Migrations

Flyway SQL scripts in `onlineshopapi/src/main/resources/db/migration/` run automatically on startup.

---

## API design

All endpoints run on `http://localhost:3000/api`.

**Authentication** (`/api/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login and receive JWT | No |
| GET | `/api/auth/profile` | Get current user profile | Yes |

**Products** (`/api/products`)

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/api/products` | Get all products | No | - |
| GET | `/api/products/{id}` | Get product by ID | No | - |
| POST | `/api/products` | Create product | Yes | ADMIN |
| PUT | `/api/products/{id}` | Update product | Yes | ADMIN |
| DELETE | `/api/products/{id}` | Delete product | Yes | ADMIN |

**Product Categories** (`/api/product-categories`)

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/api/product-categories` | Get all categories | No | - |
| GET | `/api/product-categories/{id}` | Get category by ID | No | - |
| POST | `/api/product-categories` | Create category | Yes | ADMIN |
| PUT | `/api/product-categories/{id}` | Update category | Yes | ADMIN |
| DELETE | `/api/product-categories/{id}` | Delete category | Yes | ADMIN |

**Orders** (`/api/orders`)

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/api/orders` | Get user's orders | Yes | CUSTOMER/ADMIN |
| GET | `/api/orders/{id}` | Get order details | Yes | CUSTOMER/ADMIN |
| POST | `/api/orders` | Create new order | Yes | CUSTOMER |

**Swagger UI** at `http://localhost:3000/api/swagger-ui.html` provides interactive API docs with request/response schemas and JWT auth support.

---

## Authentication & authorization

### JWT flow

```
1. User Login Request
   ┌──────────┐                    ┌──────────┐
   │  Client  │───POST /login────▶ │  Backend │
   └──────────┘                    └──────────┘
                                         │
                                         │ Validate credentials
                                         │
                                         ▼
                                   Generate JWT
                                   ┌────────────────┐
                                   │ Header.Payload │
                                   │   .Signature   │
                                   └────────────────┘
                                         │
   ┌──────────┐                    ┌──────────┐
   │  Client  │◀───JWT Token───────│  Backend │
   └──────────┘                    └──────────┘
        │
        │ Store token (localStorage)
        │

2. Authenticated Request
   ┌──────────┐                    ┌──────────┐
   │  Client  │─Authorization:─────▶│  Backend │
   │          │  Bearer {token}     │          │
   └──────────┘                    └──────────┘
                                         │
                                         │ JwtAuthFilter
                                         │ validates token
                                         │
                                         ▼
                                   Extract user info
                                   Set SecurityContext
                                         │
   ┌──────────┐                    ┌──────────┐
   │  Client  │◀───Response─────────│  Backend │
   └──────────┘                    └──────────┘
```

### Backend security

**JwtService** (`security/JwtService.java`):
```java
@Service
public class JwtService {
    public String generateToken(UserDetails userDetails) {
        return Jwts.builder()
            .setSubject(userDetails.getUsername())
            .setIssuedAt(new Date())
            .setExpiration(new Date(System.currentTimeMillis() + 1000 * 60 * 60 * 10))
            .signWith(getSigningKey(), SignatureAlgorithm.HS256)
            .compact();
    }
    
    public boolean validateToken(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }
}
```

**JwtAuthFilter** (`security/JwtAuthFilter.java`):
```java
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    
    @Override
    protected void doFilterInternal(HttpServletRequest request, 
                                    HttpServletResponse response, 
                                    FilterChain filterChain) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String jwt = authHeader.substring(7);
            String username = jwtService.extractUsername(jwt);
            
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                if (jwtService.validateToken(jwt, userDetails)) {
                    UsernamePasswordAuthenticationToken authToken = 
                        new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        }
        filterChain.doFilter(request, response);
    }
}
```

### Frontend authentication

**AuthService** (`features/auth/services/auth.service.ts`):
```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  userProfile = signal<User | null>(null);
  
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', credentials)
      .pipe(tap(response => {
        localStorage.setItem(this.TOKEN_KEY, response.token);
        this.userProfile.set(response.user);
      }));
  }
  
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }
  
  isAuthenticated(): boolean {
    return !!this.getToken();
  }
  
  hasRole(role: string): boolean {
    return this.userProfile()?.role === role;
  }
}
```

**authTokenInterceptor** (`features/auth/interceptors/auth-token.interceptor.ts`):
```typescript
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  
  if (token && !req.url.includes('/auth/')) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }
  
  return next(req);
};
```

### Role-based access control

**Backend**:
```java
@PreAuthorize("hasRole('ADMIN')")
@PostMapping("/api/products")
public ProductResponseDto createProduct(@RequestBody ProductRequestDto dto) {
    return productService.create(dto);
}
```

**Frontend**:
```typescript
// Route guard
{
  path: 'products/create',
  component: ProductCreateComponent,
  canActivate: [authGuard, rolesGuard(['ADMIN'])]
}

// Template directive
<button *hasRole="'ADMIN'" (click)="deleteProduct()">Delete</button>
```

---

## Design patterns

### Backend

**Repository pattern** abstracts data access:

```java
public interface ProductRepository extends JpaRepository<Product, UUID> {
    List<Product> findByCategoryId(UUID categoryId);
    Optional<Product> findByName(String name);
    
    @Query("SELECT p FROM Product p WHERE p.price < :maxPrice")
    List<Product> findCheapProducts(@Param("maxPrice") Double maxPrice);
}
```

**DTO pattern** separates API contracts from domain models:

```java
// Request DTO
public record ProductRequestDto(
    String name,
    String description,
    Double price,
    Double weight,
    UUID categoryId,
    String imageUrl
) {}

// Response DTO
public record ProductResponseDto(
    UUID id,
    String name,
    String description,
    Double price,
    Double weight,
    String categoryName,
    String imageUrl
) {}

// Mapper
@Component
public class ProductMapper {
    public Product toEntity(ProductRequestDto dto) { ... }
    public ProductResponseDto toDto(Product entity) { ... }
}
```

**Strategy pattern** enables swappable order fulfillment logic:

```java
public interface OrderStrategy {
    void processOrder(Order order, List<OrderItem> items);
}

@Component
public class SingleLocationStrategy implements OrderStrategy {
    @Override
    public void processOrder(Order order, List<OrderItem> items) {
        // Fulfill entire order from one location
    }
}

@Component
public class MostAbundantStrategy implements OrderStrategy {
    @Override
    public void processOrder(Order order, List<OrderItem> items) {
        // Fulfill from location with most stock
    }
}

@Configuration
public class OrderStrategyConfig {
    @Bean
    public OrderStrategy orderStrategy() {
        return new SingleLocationStrategy(); // or MostAbundantStrategy
    }
}
```

**Dependency injection** via constructor with Lombok's `@RequiredArgsConstructor`.

### Frontend

**Facade pattern** simplifies API interactions:

```typescript
@Injectable({ providedIn: 'root' })
export class ProductFacade {
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private notificationService = inject(NotificationService);
  
  addToCart(product: Product, quantity: number): Observable<void> {
    return this.cartService.addItem(product, quantity).pipe(
      tap(() => this.notificationService.success('Added to cart')),
      catchError(err => {
        this.notificationService.error('Failed to add to cart');
        return throwError(() => err);
      })
    );
  }
}
```

**Observer pattern** (RxJS) for reactive state:

```typescript
@Injectable({ providedIn: 'root' })
export class CartService {
  private cartItems$ = new BehaviorSubject<CartItem[]>([]);
  
  getItems(): Observable<CartItem[]> {
    return this.cartItems$.asObservable();
  }
  
  addItem(product: Product, quantity: number): Observable<void> {
    const current = this.cartItems$.value;
    const updated = [...current, { product, quantity }];
    this.cartItems$.next(updated);
    return of(void 0);
  }
}
```

**Singleton pattern** via `providedIn: 'root'` ensures single service instances.

**Lazy loading** for feature modules:

```typescript
const routes: Routes = [
  {
    path: 'products',
    loadChildren: () => import('./features/products/products.routes')
      .then(m => m.ProductsRoutes)
  }
];
```

---

## Development workflow

### Local setup

**Database**:
```bash
cd docker/development
docker-compose up -d
# PostgreSQL on port 5433, database: shopdb, user: shopuser, password: shoppassword
```

**Backend**:
```bash
cd onlineshopapi
mvn spring-boot:run -Dspring-boot.run.profiles=local
# Runs on http://localhost:3000/api
```

**Frontend**:
```bash
cd onlineshopui
npm install
npm start                # Real API
npm run start:mock       # MSW mocks
# Runs on http://localhost:4200
```

### Testing

```bash
# Backend (Testcontainers + PostgreSQL)
cd onlineshopapi && mvn test

# Frontend (Vitest)
cd onlineshopui && npm test
```

### Code quality

```bash
# Frontend
cd onlineshopui
npm run lint
npm run format
npx tsc --noEmit
```

Backend: Enable Lombok annotation processing in your IDE.

---

## Deployment architecture

### Production strategy

```
┌───────────────────────────────────────────────────────────┐
│                      Load Balancer / CDN                   │
│                         (HTTPS)                            │
└────────────────────────┬──────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌──────────────────┐           ┌──────────────────┐
│  Angular SPA     │           │  Spring Boot API │
│  (Static Files)  │           │   (Container)    │
│  - Nginx/CDN     │           │   - Docker       │
│  - S3 + CloudFront          │   - K8s Pod      │
└──────────────────┘           └────────┬─────────┘
                                        │
                                        ▼
                               ┌──────────────────┐
                               │   PostgreSQL     │
                               │   (Managed DB)   │
                               │   - RDS/Cloud SQL│
                               └──────────────────┘
```

### Environment variables

**Backend**: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`

**Frontend**: Set `apiUrl` in `environment.production.ts`

### Docker deployment

**Backend Dockerfile**:
```dockerfile
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 3000
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**Frontend Dockerfile**:
```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

---

## Reference

### Commands

**Database**:
```bash
docker exec -it postgres psql -U shopuser -d shopdb
\dt onlineshop.*
docker exec postgres pg_dump -U shopuser shopdb > backup.sql
```

**Backend**:
```bash
mvn clean install
mvn test
mvn spring-boot:run -Dspring-boot.run.profiles=prod
mvn package
```

**Frontend**:
```bash
npm install
npm start
npm run build
npm test
npm run lint -- --fix
npm run format
```

### Test credentials

| Email | Password | Role |
|-------|----------|------|
| `admin@onlineshop.com` | `password` | ADMIN |
| `john.doe@email.com` | `password` | CUSTOMER |
| `jane.smith@email.com` | `password` | CUSTOMER |

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-22  
**Maintained By**: Development Team  
**Project**: Layer 2 Fullstack E-Commerce Application
