# Architecture Refactoring Guide

Common refactoring scenarios for improving architecture quality.

## Layer Boundary Violations

### Problem: Business Logic in Controller

**Before** (❌ Violation):
```java
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    
    @PostMapping
    public ResponseEntity<OrderDto> createOrder(@RequestBody OrderRequestDto request) {
        // Business logic in controller
        Order order = new Order();
        order.setUserId(request.userId());
        order.setCreatedAt(LocalDateTime.now());
        
        double total = 0;
        for (OrderItemRequest item : request.items()) {
            Product product = productRepository.findById(item.productId())
                .orElseThrow(() -> new NotFoundException("Product not found"));
            
            if (product.getStock() < item.quantity()) {
                throw new InsufficientStockException("Not enough stock");
            }
            
            total += product.getPrice() * item.quantity();
            product.setStock(product.getStock() - item.quantity());
            productRepository.save(product);
        }
        
        order.setTotal(total);
        Order saved = orderRepository.save(order);
        
        return ResponseEntity.ok(toDto(saved));
    }
}
```

**After** (✓ Clean):
```java
// Controller - only HTTP concerns
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orderService;
    
    @PostMapping
    public ResponseEntity<OrderDto> createOrder(@RequestBody OrderRequestDto request) {
        OrderDto created = orderService.createOrder(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}

// Service - business logic
@Service
@RequiredArgsConstructor
@Transactional
public class OrderService {
    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final OrderMapper orderMapper;
    
    public OrderDto createOrder(OrderRequestDto request) {
        validateStockAvailability(request.items());
        
        Order order = buildOrder(request);
        reduceStock(request.items());
        
        Order saved = orderRepository.save(order);
        return orderMapper.toDto(saved);
    }
    
    private void validateStockAvailability(List<OrderItemRequest> items) {
        for (OrderItemRequest item : items) {
            Product product = productRepository.findById(item.productId())
                .orElseThrow(() -> new NotFoundException("Product not found"));
            
            if (product.getStock() < item.quantity()) {
                throw new InsufficientStockException("Not enough stock for: " + product.getName());
            }
        }
    }
    
    private Order buildOrder(OrderRequestDto request) {
        double total = calculateTotal(request.items());
        
        return Order.builder()
            .userId(request.userId())
            .total(total)
            .createdAt(LocalDateTime.now())
            .build();
    }
    
    private double calculateTotal(List<OrderItemRequest> items) {
        return items.stream()
            .mapToDouble(item -> {
                Product product = productRepository.findById(item.productId()).orElseThrow();
                return product.getPrice() * item.quantity();
            })
            .sum();
    }
    
    private void reduceStock(List<OrderItemRequest> items) {
        for (OrderItemRequest item : items) {
            Product product = productRepository.findById(item.productId()).orElseThrow();
            product.setStock(product.getStock() - item.quantity());
            productRepository.save(product);
        }
    }
}
```

### Problem: Repository Bypassing

**Before** (❌ Violation):
```java
@RestController
@RequiredArgsConstructor
public class ProductController {
    private final ProductRepository productRepository;  // Direct repository access
    private final ProductMapper productMapper;
    
    @PostMapping("/api/products")
    public ResponseEntity<ProductDto> create(@RequestBody ProductRequestDto request) {
        Product product = productMapper.toEntity(request);
        Product saved = productRepository.save(product);
        return ResponseEntity.ok(productMapper.toDto(saved));
    }
}
```

**After** (✓ Clean):
```java
@RestController
@RequiredArgsConstructor
public class ProductController {
    private final ProductService productService;  // Service layer
    
    @PostMapping("/api/products")
    public ResponseEntity<ProductDto> create(@RequestBody ProductRequestDto request) {
        ProductDto created = productService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}

@Service
@RequiredArgsConstructor
@Transactional
public class ProductService {
    private final ProductRepository productRepository;
    private final ProductMapper productMapper;
    
    public ProductDto create(ProductRequestDto request) {
        Product product = productMapper.toEntity(request);
        Product saved = productRepository.save(product);
        return productMapper.toDto(saved);
    }
}
```

## Entity Exposure

### Problem: Returning Entities from REST APIs

**Before** (❌ Violation):
```java
@RestController
@RequiredArgsConstructor
public class OrderController {
    private final OrderRepository orderRepository;
    
    @GetMapping("/api/orders/{id}")
    public ResponseEntity<Order> getOrder(@PathVariable UUID id) {
        Order order = orderRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Order not found"));
        return ResponseEntity.ok(order);  // Returns entity directly
    }
}
```

**Problems**:
- Exposes internal structure
- Causes lazy loading exceptions
- Tight coupling between API and database
- Can't evolve API independently

**After** (✓ Clean):
```java
@RestController
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orderService;
    
    @GetMapping("/api/orders/{id}")
    public ResponseEntity<OrderResponseDto> getOrder(@PathVariable UUID id) {
        OrderResponseDto order = orderService.findById(id);
        return ResponseEntity.ok(order);
    }
}

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrderService {
    private final OrderRepository orderRepository;
    private final OrderMapper orderMapper;
    
    public OrderResponseDto findById(UUID id) {
        Order order = orderRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Order not found"));
        return orderMapper.toDto(order);
    }
}

// DTO with clean API contract
public record OrderResponseDto(
    UUID id,
    String customerName,
    List<OrderItemDto> items,
    Double total,
    OrderStatus status,
    LocalDateTime createdAt
) {}
```

## God Classes

### Problem: Service with Too Many Responsibilities

**Before** (❌ God Service):
```java
@Service
@RequiredArgsConstructor
public class ProductService {
    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final StockRepository stockRepository;
    private final PriceHistoryRepository priceHistoryRepository;
    private final ReviewRepository reviewRepository;
    private final ImageRepository imageRepository;
    
    // Product CRUD
    public ProductDto create(ProductRequestDto request) { ... }
    public ProductDto update(UUID id, ProductRequestDto request) { ... }
    public void delete(UUID id) { ... }
    public List<ProductDto> findAll() { ... }
    
    // Category management
    public void assignCategory(UUID productId, UUID categoryId) { ... }
    public void removeCategory(UUID productId) { ... }
    
    // Stock management
    public void updateStock(UUID productId, int quantity) { ... }
    public int getAvailableStock(UUID productId) { ... }
    
    // Price management
    public void updatePrice(UUID productId, Double price) { ... }
    public List<PriceHistoryDto> getPriceHistory(UUID productId) { ... }
    
    // Review management
    public void addReview(UUID productId, ReviewDto review) { ... }
    public List<ReviewDto> getReviews(UUID productId) { ... }
    
    // Image management
    public void uploadImage(UUID productId, MultipartFile file) { ... }
    public void deleteImage(UUID productId, UUID imageId) { ... }
}
```

**After** (✓ Focused Services):
```java
// Core product operations
@Service
@RequiredArgsConstructor
@Transactional
public class ProductService {
    private final ProductRepository productRepository;
    private final ProductMapper productMapper;
    
    public ProductDto create(ProductRequestDto request) { ... }
    public ProductDto update(UUID id, ProductRequestDto request) { ... }
    public void delete(UUID id) { ... }
    
    @Transactional(readOnly = true)
    public List<ProductDto> findAll() { ... }
    
    @Transactional(readOnly = true)
    public ProductDto findById(UUID id) { ... }
}

// Stock operations
@Service
@RequiredArgsConstructor
@Transactional
public class StockService {
    private final StockRepository stockRepository;
    
    public void updateStock(UUID productId, int quantity) { ... }
    
    @Transactional(readOnly = true)
    public int getAvailableStock(UUID productId) { ... }
}

// Price operations
@Service
@RequiredArgsConstructor
@Transactional
public class PriceService {
    private final ProductRepository productRepository;
    private final PriceHistoryRepository priceHistoryRepository;
    
    public void updatePrice(UUID productId, Double price) { ... }
    
    @Transactional(readOnly = true)
    public List<PriceHistoryDto> getPriceHistory(UUID productId) { ... }
}

// Review operations
@Service
@RequiredArgsConstructor
@Transactional
public class ReviewService {
    private final ReviewRepository reviewRepository;
    
    public void addReview(UUID productId, ReviewDto review) { ... }
    
    @Transactional(readOnly = true)
    public List<ReviewDto> getReviews(UUID productId) { ... }
}
```

## Strategy Pattern Refactoring

### Problem: Long If/Else Chains

**Before** (❌ Procedural):
```java
@Service
@RequiredArgsConstructor
public class OrderService {
    
    @Transactional
    public void fulfillOrder(Order order, String strategy) {
        if (strategy.equals("SINGLE_LOCATION")) {
            // Logic for single location fulfillment
            Location best = findLocationWithAllItems(order.getItems());
            for (OrderItem item : order.getItems()) {
                item.setShippedFrom(best);
                reduceStock(best, item.getProduct(), item.getQuantity());
            }
        } else if (strategy.equals("MULTIPLE_LOCATIONS")) {
            // Logic for multiple location fulfillment
            for (OrderItem item : order.getItems()) {
                Location closest = findClosestLocation(order.getShippingAddress(), item.getProduct());
                item.setShippedFrom(closest);
                reduceStock(closest, item.getProduct(), item.getQuantity());
            }
        } else if (strategy.equals("MOST_ABUNDANT")) {
            // Logic for most abundant fulfillment
            for (OrderItem item : order.getItems()) {
                Location mostStock = findLocationWithMostStock(item.getProduct());
                item.setShippedFrom(mostStock);
                reduceStock(mostStock, item.getProduct(), item.getQuantity());
            }
        } else {
            throw new IllegalArgumentException("Unknown strategy: " + strategy);
        }
    }
}
```

**After** (✓ Strategy Pattern):
```java
// Strategy interface
public interface OrderFulfillmentStrategy {
    void fulfillOrder(Order order, List<OrderItem> items);
}

// Single location implementation
@Component
@RequiredArgsConstructor
public class SingleLocationStrategy implements OrderFulfillmentStrategy {
    private final LocationService locationService;
    private final StockService stockService;
    
    @Override
    public void fulfillOrder(Order order, List<OrderItem> items) {
        Location best = locationService.findLocationWithAllItems(items);
        for (OrderItem item : items) {
            item.setShippedFrom(best);
            stockService.reduceStock(best, item.getProduct(), item.getQuantity());
        }
    }
}

// Multiple locations implementation
@Component
@RequiredArgsConstructor
public class MultipleLocationsStrategy implements OrderFulfillmentStrategy {
    private final LocationService locationService;
    private final StockService stockService;
    
    @Override
    public void fulfillOrder(Order order, List<OrderItem> items) {
        for (OrderItem item : items) {
            Location closest = locationService.findClosestLocation(
                order.getShippingAddress(),
                item.getProduct()
            );
            item.setShippedFrom(closest);
            stockService.reduceStock(closest, item.getProduct(), item.getQuantity());
        }
    }
}

// Strategy factory
@Component
@RequiredArgsConstructor
public class OrderFulfillmentStrategyFactory {
    private final List<OrderFulfillmentStrategy> strategies;
    
    public OrderFulfillmentStrategy getStrategy(String strategyType) {
        return switch (strategyType) {
            case "SINGLE_LOCATION" -> getStrategy(SingleLocationStrategy.class);
            case "MULTIPLE_LOCATIONS" -> getStrategy(MultipleLocationsStrategy.class);
            case "MOST_ABUNDANT" -> getStrategy(MostAbundantStrategy.class);
            default -> throw new IllegalArgumentException("Unknown strategy: " + strategyType);
        };
    }
    
    private OrderFulfillmentStrategy getStrategy(Class<? extends OrderFulfillmentStrategy> clazz) {
        return strategies.stream()
            .filter(clazz::isInstance)
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("Strategy not found: " + clazz));
    }
}

// Service using strategy
@Service
@RequiredArgsConstructor
@Transactional
public class OrderService {
    private final OrderFulfillmentStrategyFactory strategyFactory;
    
    @Value("${order.fulfillment.strategy:SINGLE_LOCATION}")
    private String defaultStrategy;
    
    public void fulfillOrder(Order order) {
        OrderFulfillmentStrategy strategy = strategyFactory.getStrategy(defaultStrategy);
        strategy.fulfillOrder(order, order.getItems());
    }
}
```

## Transaction Management

### Problem: Missing Transaction Boundaries

**Before** (❌ No Transaction):
```java
@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    
    // Missing @Transactional - partial updates possible
    public void updateOrderAndStock(UUID orderId, List<OrderItemUpdate> updates) {
        Order order = orderRepository.findById(orderId).orElseThrow();
        
        for (OrderItemUpdate update : updates) {
            OrderItem item = order.getItem(update.productId());
            item.setQuantity(update.newQuantity());
            
            Product product = productRepository.findById(update.productId()).orElseThrow();
            product.setStock(product.getStock() + (item.getQuantity() - update.newQuantity()));
            productRepository.save(product);  // If this fails, order already updated!
        }
        
        orderRepository.save(order);
    }
}
```

**After** (✓ Proper Transaction):
```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)  // Default for read operations
public class OrderService {
    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    
    @Transactional  // All-or-nothing semantics
    public void updateOrderAndStock(UUID orderId, List<OrderItemUpdate> updates) {
        Order order = orderRepository.findById(orderId).orElseThrow();
        
        for (OrderItemUpdate update : updates) {
            OrderItem item = order.getItem(update.productId());
            int oldQuantity = item.getQuantity();
            item.setQuantity(update.newQuantity());
            
            Product product = productRepository.findById(update.productId()).orElseThrow();
            int stockDelta = oldQuantity - update.newQuantity();
            product.setStock(product.getStock() + stockDelta);
            productRepository.save(product);
        }
        
        orderRepository.save(order);
        // If any operation fails, everything rolls back
    }
}
```

## N+1 Query Problems

### Problem: Loading Associations in Loop

**Before** (❌ N+1 Queries):
```java
@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository;
    
    public List<OrderDto> findAll() {
        List<Order> orders = orderRepository.findAll();
        
        return orders.stream()
            .map(order -> {
                // Triggers separate query for each order's items (N+1 problem)
                List<OrderItemDto> items = order.getOrderDetails().stream()
                    .map(this::toItemDto)
                    .toList();
                
                return new OrderDto(
                    order.getId(),
                    order.getCustomerName(),
                    items,
                    order.getTotal()
                );
            })
            .toList();
    }
}
```

**After** (✓ Join Fetch):
```java
@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {
    
    @Query("SELECT DISTINCT o FROM Order o LEFT JOIN FETCH o.orderDetails")
    List<Order> findAllWithDetails();
    
    // Or using EntityGraph
    @EntityGraph(attributePaths = {"orderDetails", "orderDetails.product"})
    List<Order> findAll();
}

@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository;
    
    public List<OrderDto> findAll() {
        // Single query fetches orders and their items
        List<Order> orders = orderRepository.findAllWithDetails();
        
        return orders.stream()
            .map(this::toDto)
            .toList();
    }
}
```

## Exception Handling

### Problem: Generic Exception Handling

**Before** (❌ Generic):
```java
@Service
public class ProductService {
    
    public ProductDto findById(UUID id) {
        try {
            Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Product not found"));
            return productMapper.toDto(product);
        } catch (Exception e) {
            throw new RuntimeException("Error loading product", e);
        }
    }
}

@RestController
public class ProductController {
    
    @GetMapping("/api/products/{id}")
    public ResponseEntity<ProductDto> getProduct(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(productService.findById(id));
        } catch (RuntimeException e) {
            // Can't distinguish between different error types
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
```

**After** (✓ Domain Exceptions):
```java
// Custom exceptions
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}

public class InsufficientStockException extends RuntimeException {
    public InsufficientStockException(String message) {
        super(message);
    }
}

// Service throws domain exceptions
@Service
@RequiredArgsConstructor
public class ProductService {
    
    public ProductDto findById(UUID id) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + id));
        return productMapper.toDto(product);
    }
}

// Global exception handler
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
    
    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<ErrorResponse> handleInsufficientStock(InsufficientStockException ex) {
        ErrorResponse error = new ErrorResponse(
            HttpStatus.BAD_REQUEST.value(),
            ex.getMessage(),
            LocalDateTime.now()
        );
        return ResponseEntity.badRequest().body(error);
    }
}

// Controller stays clean
@RestController
@RequiredArgsConstructor
public class ProductController {
    private final ProductService productService;
    
    @GetMapping("/api/products/{id}")
    public ResponseEntity<ProductDto> getProduct(@PathVariable UUID id) {
        // Exception handler takes care of error responses
        return ResponseEntity.ok(productService.findById(id));
    }
}
```

## Anemic Domain Model

### Problem: Entities with No Behavior

**Before** (❌ Anemic):
```java
@Entity
public class Order {
    @Id
    private UUID id;
    private Double total;
    private OrderStatus status;
    
    @OneToMany(mappedBy = "order")
    private List<OrderItem> items;
    
    // Only getters and setters, no behavior
}

@Service
public class OrderService {
    // All business logic in service
    public void addItem(UUID orderId, OrderItem item) {
        Order order = orderRepository.findById(orderId).orElseThrow();
        order.getItems().add(item);
        
        // Recalculate total
        double total = order.getItems().stream()
            .mapToDouble(i -> i.getPrice() * i.getQuantity())
            .sum();
        order.setTotal(total);
        
        orderRepository.save(order);
    }
}
```

**After** (✓ Rich Domain Model):
```java
@Entity
public class Order {
    @Id
    private UUID id;
    private Double total;
    private OrderStatus status;
    
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();
    
    // Domain behavior
    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
        recalculateTotal();
    }
    
    public void removeItem(OrderItem item) {
        items.remove(item);
        item.setOrder(null);
        recalculateTotal();
    }
    
    public void confirm() {
        if (items.isEmpty()) {
            throw new IllegalStateException("Cannot confirm empty order");
        }
        if (status != OrderStatus.DRAFT) {
            throw new IllegalStateException("Only draft orders can be confirmed");
        }
        this.status = OrderStatus.CONFIRMED;
    }
    
    public boolean canBeCancelled() {
        return status == OrderStatus.DRAFT || status == OrderStatus.CONFIRMED;
    }
    
    private void recalculateTotal() {
        this.total = items.stream()
            .mapToDouble(item -> item.getPrice() * item.getQuantity())
            .sum();
    }
}

@Service
@RequiredArgsConstructor
@Transactional
public class OrderService {
    private final OrderRepository orderRepository;
    
    // Service coordinates, entity enforces rules
    public void addItem(UUID orderId, OrderItem item) {
        Order order = orderRepository.findById(orderId).orElseThrow();
        order.addItem(item);  // Entity handles logic
        orderRepository.save(order);
    }
    
    public void confirmOrder(UUID orderId) {
        Order order = orderRepository.findById(orderId).orElseThrow();
        order.confirm();  // Entity enforces business rules
        orderRepository.save(order);
    }
}
```

## Configuration Hardcoding

### Problem: Hardcoded Values

**Before** (❌ Hardcoded):
```java
@Service
public class EmailService {
    
    public void sendWelcomeEmail(String to) {
        String from = "noreply@mycompany.com";  // Hardcoded
        String subject = "Welcome!";
        int maxRetries = 3;  // Magic number
        int timeoutMs = 5000;  // Magic number
        
        // Send email logic
    }
}
```

**After** (✓ Externalized):
```java
// Configuration class
@Configuration
@ConfigurationProperties(prefix = "email")
@Data
public class EmailProperties {
    private String from;
    private String welcomeSubject = "Welcome!";
    private int maxRetries = 3;
    private int timeoutMs = 5000;
}

// application.yml
/*
email:
  from: noreply@mycompany.com
  welcome-subject: Welcome to Our Platform!
  max-retries: 3
  timeout-ms: 5000
*/

// Service uses configuration
@Service
@RequiredArgsConstructor
public class EmailService {
    private final EmailProperties emailProperties;
    
    public void sendWelcomeEmail(String to) {
        String from = emailProperties.getFrom();
        String subject = emailProperties.getWelcomeSubject();
        int maxRetries = emailProperties.getMaxRetries();
        int timeoutMs = emailProperties.getTimeoutMs();
        
        // Send email logic
    }
}
```
