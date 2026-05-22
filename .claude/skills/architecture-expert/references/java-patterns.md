# Java/Spring Boot Architecture Patterns

Detailed patterns and best practices for Java backend architectures.

## Controller Layer Patterns

### REST Controller Structure

**Basic CRUD controller**:
```java
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {
    private final ProductService productService;
    
    @GetMapping
    public ResponseEntity<List<ProductDto>> getAllProducts() {
        return ResponseEntity.ok(productService.findAll());
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<ProductDto> getProduct(@PathVariable UUID id) {
        return ResponseEntity.ok(productService.findById(id));
    }
    
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductDto> createProduct(
            @Valid @RequestBody ProductRequestDto request) {
        ProductDto created = productService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
    
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductDto> updateProduct(
            @PathVariable UUID id,
            @Valid @RequestBody ProductRequestDto request) {
        return ResponseEntity.ok(productService.update(id, request));
    }
    
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteProduct(@PathVariable UUID id) {
        productService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

**Key principles**:
- Use `@RequiredArgsConstructor` for constructor injection
- Return `ResponseEntity<T>` for explicit HTTP status control
- Use `@Valid` for request body validation
- Keep authorization at controller level with `@PreAuthorize`
- Delegate all logic to service layer
- Use DTOs for request/response, never expose entities

### Exception Handling

**Global exception handler**:
```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        ErrorResponse error = new ErrorResponse(
            HttpStatus.NOT_FOUND.value(),
            ex.getMessage(),
            LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }
    
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
            .collect(Collectors.toMap(
                FieldError::getField,
                FieldError::getDefaultMessage
            ));
        
        ErrorResponse error = new ErrorResponse(
            HttpStatus.BAD_REQUEST.value(),
            "Validation failed",
            LocalDateTime.now(),
            errors
        );
        return ResponseEntity.badRequest().body(error);
    }
}
```

## Service Layer Patterns

### Transactional Service

**Service with transaction management**:
```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)  // Default for read operations
public class OrderService {
    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final StockRepository stockRepository;
    private final OrderMapper orderMapper;
    
    public List<OrderDto> findAll() {
        return orderRepository.findAll().stream()
            .map(orderMapper::toDto)
            .toList();
    }
    
    public OrderDto findById(UUID id) {
        Order order = orderRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + id));
        return orderMapper.toDto(order);
    }
    
    @Transactional  // Write operation needs transaction
    public OrderDto create(OrderRequestDto request) {
        // Validate stock availability
        for (OrderItemRequest item : request.items()) {
            validateStock(item.productId(), item.quantity());
        }
        
        // Create order
        Order order = orderMapper.toEntity(request);
        order.setCreatedAt(LocalDateTime.now());
        
        // Reduce stock
        for (OrderItemRequest item : request.items()) {
            reduceStock(item.productId(), item.quantity());
        }
        
        Order saved = orderRepository.save(order);
        return orderMapper.toDto(saved);
    }
    
    private void validateStock(UUID productId, int quantity) {
        Stock stock = stockRepository.findByProductId(productId)
            .orElseThrow(() -> new ResourceNotFoundException("Stock not found"));
        
        if (stock.getQuantity() < quantity) {
            throw new InsufficientStockException("Not enough stock for product: " + productId);
        }
    }
    
    private void reduceStock(UUID productId, int quantity) {
        Stock stock = stockRepository.findByProductId(productId).orElseThrow();
        stock.setQuantity(stock.getQuantity() - quantity);
        stockRepository.save(stock);
    }
}
```

**Key principles**:
- Use `@Transactional(readOnly = true)` as default for read-heavy services
- Override with `@Transactional` for write operations
- Throw domain exceptions, let controller advice handle HTTP mapping
- Keep business logic encapsulated in service methods
- Use private helper methods for complex operations

### Strategy Pattern Implementation

**Order fulfillment with strategy**:
```java
public interface OrderStrategy {
    void fulfillOrder(Order order, List<OrderItem> items);
}

@Component
@RequiredArgsConstructor
public class SingleLocationStrategy implements OrderStrategy {
    private final StockRepository stockRepository;
    
    @Override
    public void fulfillOrder(Order order, List<OrderItem> items) {
        // Find location that can fulfill entire order
        Location location = findBestLocation(items);
        
        for (OrderItem item : items) {
            item.setShippedFrom(location);
            reduceStock(location, item.getProduct(), item.getQuantity());
        }
    }
    
    private Location findBestLocation(List<OrderItem> items) {
        // Logic to find location with all items in stock
        // ...
    }
}

@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository;
    private final OrderStrategy orderStrategy;  // Injected based on config
    
    @Transactional
    public OrderDto create(OrderRequestDto request) {
        Order order = orderMapper.toEntity(request);
        List<OrderItem> items = mapOrderItems(request.items());
        
        orderStrategy.fulfillOrder(order, items);
        
        Order saved = orderRepository.save(order);
        return orderMapper.toDto(saved);
    }
}

@Configuration
public class OrderStrategyConfig {
    
    @Bean
    public OrderStrategy orderStrategy(
            @Value("${order.strategy:SINGLE_LOCATION}") String strategyType,
            List<OrderStrategy> strategies) {
        
        return switch (strategyType) {
            case "SINGLE_LOCATION" -> strategies.stream()
                .filter(s -> s instanceof SingleLocationStrategy)
                .findFirst()
                .orElseThrow();
            case "MULTIPLE_LOCATIONS" -> strategies.stream()
                .filter(s -> s instanceof MultipleLocationStrategy)
                .findFirst()
                .orElseThrow();
            default -> throw new IllegalArgumentException("Unknown strategy: " + strategyType);
        };
    }
}
```

## Repository Layer Patterns

### Custom Query Methods

**Spring Data JPA derived queries**:
```java
@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {
    
    // Derived query methods
    List<Product> findByCategoryId(UUID categoryId);
    List<Product> findByNameContainingIgnoreCase(String name);
    List<Product> findByPriceBetween(Double minPrice, Double maxPrice);
    Optional<Product> findByNameAndCategoryId(String name, UUID categoryId);
    
    // Count queries
    long countByCategoryId(UUID categoryId);
    boolean existsByName(String name);
    
    // Delete queries
    void deleteByCreatedAtBefore(LocalDateTime date);
    
    // Sorting and pagination
    List<Product> findByCategoryIdOrderByPriceAsc(UUID categoryId);
    Page<Product> findByCategory(Category category, Pageable pageable);
}
```

**Custom JPQL queries**:
```java
@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {
    
    @Query("SELECT o FROM Order o WHERE o.user.id = :userId AND o.createdAt > :since")
    List<Order> findRecentOrdersByUser(
        @Param("userId") UUID userId,
        @Param("since") LocalDateTime since
    );
    
    @Query("SELECT o FROM Order o JOIN FETCH o.orderDetails WHERE o.id = :id")
    Optional<Order> findByIdWithDetails(@Param("id") UUID id);
    
    @Query(value = "SELECT * FROM orders WHERE status = :status AND created_at > :date",
           nativeQuery = true)
    List<Order> findByStatusNative(
        @Param("status") String status,
        @Param("date") LocalDateTime date
    );
    
    @Modifying
    @Query("UPDATE Order o SET o.status = :status WHERE o.id = :id")
    void updateStatus(@Param("id") UUID id, @Param("status") OrderStatus status);
}
```

## DTO and Mapper Patterns

### DTO Design

**Request DTOs** (validation):
```java
public record ProductRequestDto(
    @NotBlank(message = "Name is required")
    @Size(min = 3, max = 100, message = "Name must be between 3 and 100 characters")
    String name,
    
    @NotBlank(message = "Description is required")
    @Size(max = 500, message = "Description cannot exceed 500 characters")
    String description,
    
    @NotNull(message = "Price is required")
    @DecimalMin(value = "0.01", message = "Price must be greater than 0")
    Double price,
    
    @NotNull(message = "Weight is required")
    @Min(value = 1, message = "Weight must be at least 1 gram")
    Double weight,
    
    @NotNull(message = "Category is required")
    UUID categoryId,
    
    @Pattern(regexp = "^https?://.*", message = "Image URL must be valid HTTP/HTTPS URL")
    String imageUrl
) {}
```

**Response DTOs** (projection):
```java
public record ProductResponseDto(
    UUID id,
    String name,
    String description,
    Double price,
    Double weight,
    String categoryName,
    String imageUrl,
    LocalDateTime createdAt
) {}

// Nested DTOs
public record OrderResponseDto(
    UUID id,
    String customerName,
    List<OrderItemDto> items,
    Double total,
    OrderStatus status,
    LocalDateTime createdAt
) {}

public record OrderItemDto(
    UUID productId,
    String productName,
    Integer quantity,
    Double price
) {}
```

### Mapper Pattern

**MapStruct mapper**:
```java
@Mapper(componentModel = "spring")
public interface ProductMapper {
    
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "category", source = "categoryId")
    @Mapping(target = "createdAt", ignore = true)
    Product toEntity(ProductRequestDto dto);
    
    @Mapping(target = "categoryName", source = "category.name")
    ProductResponseDto toDto(Product entity);
    
    List<ProductResponseDto> toDtoList(List<Product> entities);
    
    @AfterMapping
    default void linkOrderItems(@MappingTarget Order order) {
        order.getOrderDetails().forEach(item -> item.setOrder(order));
    }
}
```

**Manual mapper**:
```java
@Component
@RequiredArgsConstructor
public class ProductMapper {
    private final CategoryRepository categoryRepository;
    
    public Product toEntity(ProductRequestDto dto) {
        Category category = categoryRepository.findById(dto.categoryId())
            .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
        
        return Product.builder()
            .name(dto.name())
            .description(dto.description())
            .price(dto.price())
            .weight(dto.weight())
            .category(category)
            .imageUrl(dto.imageUrl())
            .build();
    }
    
    public ProductResponseDto toDto(Product entity) {
        return new ProductResponseDto(
            entity.getId(),
            entity.getName(),
            entity.getDescription(),
            entity.getPrice(),
            entity.getWeight(),
            entity.getCategory().getName(),
            entity.getImageUrl(),
            entity.getCreatedAt()
        );
    }
}
```

## Entity Patterns

### JPA Entity Best Practices

**Well-structured entity**:
```java
@Entity
@Table(name = "products", schema = "shop")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")  // Only use ID for equals/hashCode
@ToString(exclude = {"category", "stocks"})  // Avoid lazy loading in toString
public class Product {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @Column(nullable = false, length = 100)
    private String name;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;
    
    @Column(nullable = false)
    private Double weight;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private ProductCategory category;
    
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Stock> stocks = new ArrayList<>();
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    // Helper methods for bidirectional relationships
    public void addStock(Stock stock) {
        stocks.add(stock);
        stock.setProduct(this);
    }
    
    public void removeStock(Stock stock) {
        stocks.remove(stock);
        stock.setProduct(null);
    }
}
```

**Key principles**:
- Use `@EqualsAndHashCode(of = "id")` to avoid infinite loops
- Use `@ToString(exclude = {...})` for lazy collections
- Default fetch is `LAZY` for `@ManyToOne` and `@OneToOne`
- Use `@PrePersist` and `@PreUpdate` for audit fields
- Helper methods for bidirectional relationships maintain consistency

### Handling Relationships

**One-to-Many with cascade**:
```java
@Entity
@Table(name = "orders")
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @OneToMany(
        mappedBy = "order",
        cascade = CascadeType.ALL,
        orphanRemoval = true,
        fetch = FetchType.LAZY
    )
    private List<OrderDetail> orderDetails = new ArrayList<>();
    
    // Helper methods
    public void addOrderDetail(OrderDetail detail) {
        orderDetails.add(detail);
        detail.setOrder(this);
    }
    
    public void removeOrderDetail(OrderDetail detail) {
        orderDetails.remove(detail);
        detail.setOrder(null);
    }
}

@Entity
@Table(name = "order_details")
public class OrderDetail {
    @EmbeddedId
    private OrderDetailId id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("orderId")
    @JoinColumn(name = "order_id")
    private Order order;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("productId")
    @JoinColumn(name = "product_id")
    private Product product;
    
    @Column(nullable = false)
    private Integer quantity;
}

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderDetailId implements Serializable {
    private UUID orderId;
    private UUID productId;
}
```

## Security Patterns

### JWT Authentication

**JWT service**:
```java
@Service
public class JwtService {
    
    @Value("${jwt.secret}")
    private String secret;
    
    @Value("${jwt.expiration}")
    private long expirationMs;
    
    public String generateToken(UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("roles", userDetails.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .toList());
        
        return Jwts.builder()
            .setClaims(claims)
            .setSubject(userDetails.getUsername())
            .setIssuedAt(new Date())
            .setExpiration(new Date(System.currentTimeMillis() + expirationMs))
            .signWith(getSigningKey(), SignatureAlgorithm.HS256)
            .compact();
    }
    
    public boolean validateToken(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }
    
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }
    
    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }
    
    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }
    
    private <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }
    
    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
            .setSigningKey(getSigningKey())
            .build()
            .parseClaimsJws(token)
            .getBody();
    }
    
    private Key getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secret);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
```

**JWT filter**:
```java
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    
    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        
        final String authHeader = request.getHeader("Authorization");
        
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }
        
        final String jwt = authHeader.substring(7);
        final String username = jwtService.extractUsername(jwt);
        
        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            
            if (jwtService.validateToken(jwt, userDetails)) {
                UsernamePasswordAuthenticationToken authToken = 
                    new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities()
                    );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }
        
        filterChain.doFilter(request, response);
    }
}
```

**Security configuration**:
```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthFilter jwtAuthFilter;
    private final AuthenticationProvider authenticationProvider;
    
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .authenticationProvider(authenticationProvider)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        
        return http.build();
    }
    
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList("http://localhost:4200"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(true);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
```

## Configuration Patterns

### Application configuration**:
```java
@Configuration
@EnableTransactionManagement
@EnableJpaAuditing
public class JpaConfig {
    
    @Bean
    public AuditorAware<String> auditorProvider() {
        return () -> Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
            .map(Authentication::getName);
    }
}

@Configuration
public class OpenApiConfig {
    
    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("Online Shop API")
                .version("1.0")
                .description("E-commerce REST API"))
            .components(new Components()
                .addSecuritySchemes("bearer-jwt",
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")));
    }
}
```

## Testing Patterns

**Service layer test**:
```java
@ExtendWith(MockitoExtension.class)
class ProductServiceTest {
    
    @Mock
    private ProductRepository productRepository;
    
    @Mock
    private ProductMapper productMapper;
    
    @InjectMocks
    private ProductService productService;
    
    @Test
    void findById_whenProductExists_returnsProduct() {
        // Given
        UUID id = UUID.randomUUID();
        Product product = Product.builder().id(id).name("Test").build();
        ProductResponseDto expected = new ProductResponseDto(id, "Test", null, null, null, null, null, null);
        
        when(productRepository.findById(id)).thenReturn(Optional.of(product));
        when(productMapper.toDto(product)).thenReturn(expected);
        
        // When
        ProductResponseDto result = productService.findById(id);
        
        // Then
        assertThat(result).isEqualTo(expected);
        verify(productRepository).findById(id);
        verify(productMapper).toDto(product);
    }
    
    @Test
    void findById_whenProductNotExists_throwsException() {
        // Given
        UUID id = UUID.randomUUID();
        when(productRepository.findById(id)).thenReturn(Optional.empty());
        
        // When & Then
        assertThatThrownBy(() -> productService.findById(id))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessageContaining("Product not found");
    }
}
```

**Integration test with Testcontainers**:
```java
@SpringBootTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ProductRepositoryIntegrationTest {
    
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:18")
        .withDatabaseName("testdb")
        .withUsername("test")
        .withPassword("test");
    
    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
    
    @Autowired
    private ProductRepository productRepository;
    
    @Autowired
    private CategoryRepository categoryRepository;
    
    @Test
    void findByCategoryId_returnsProductsInCategory() {
        // Given
        Category category = categoryRepository.save(
            Category.builder().name("Electronics").build()
        );
        
        Product product1 = productRepository.save(
            Product.builder()
                .name("Laptop")
                .price(BigDecimal.valueOf(999.99))
                .category(category)
                .build()
        );
        
        // When
        List<Product> results = productRepository.findByCategoryId(category.getId());
        
        // Then
        assertThat(results).hasSize(1);
        assertThat(results.get(0).getName()).isEqualTo("Laptop");
    }
}
```
