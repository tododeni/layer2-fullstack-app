# Architecture Evaluation Criteria

Metrics and criteria for assessing software architecture quality.

## Layer Separation Assessment

### Clean Layer Separation

**Indicators of clean separation**:
- Controllers only contain HTTP handling logic (request parsing, response building)
- Services contain business logic and transaction boundaries
- Repositories only perform database operations
- Models are pure data structures with JPA annotations
- DTOs are used for all API contracts
- No database queries in controllers
- No HTTP concerns in services

**Scoring**:
- **Clean**: All layers respect boundaries, no violations found
- **Moderate**: Minor violations (1-2 instances of misplaced logic)
- **Violated**: Multiple violations, logic in wrong layers

### Dependency Direction

**Correct dependency flow**:
```
Controller → Service → Repository → Database
    ↓           ↓
   DTO      Mapper
```

**Check for violations**:
- Services depending on controllers (reverse dependency)
- Repositories importing DTOs
- Models depending on services
- Circular dependencies between layers

**Scoring**:
- **Correct**: All dependencies flow downward, no circular refs
- **Mixed**: Some correct, some violations
- **Reversed**: Significant upward or circular dependencies

## Code Organization Assessment

### Package Structure

**Well-organized backend**:
```
com.company.project/
├── config/          # Configuration beans
├── controller/      # REST controllers
├── dto/            # Request/response DTOs
│   └── mapper/     # Entity-DTO mappers
├── exception/      # Custom exceptions
├── model/          # JPA entities
├── repository/     # Spring Data repositories
├── security/       # Auth filters, configs
└── service/        # Business logic
    └── strategy/   # Strategy implementations
```

**Red flags**:
- Mixed concerns in same package (controllers and services together)
- Generic package names ("utils", "helpers", "common")
- Deeply nested packages (>4 levels)
- Inconsistent naming conventions

**Scoring**:
- **Clear**: Logical grouping, consistent naming, easy navigation
- **Moderate**: Some organization but inconsistencies
- **Confused**: Mixed concerns, hard to find components

## Design Pattern Assessment

### Pattern Implementation Quality

**Repository Pattern**:
- ✓ Interfaces extend `JpaRepository`
- ✓ Custom queries use `@Query` or derived methods
- ✓ No business logic in repositories
- ✗ Services directly calling `EntityManager`
- ✗ Raw JDBC in service layer

**DTO Pattern**:
- ✓ Separate request/response DTOs
- ✓ Validation annotations on request DTOs
- ✓ Mappers handle entity-DTO conversion
- ✗ Entities exposed in REST responses
- ✗ DTOs containing business logic

**Strategy Pattern**:
- ✓ Interface defines contract
- ✓ Multiple implementations exist
- ✓ Selection via configuration or factory
- ✗ If/else chains instead of strategy
- ✗ Strategies containing shared state

**Dependency Injection**:
- ✓ Constructor injection with `@RequiredArgsConstructor`
- ✓ Dependencies are `final` fields
- ✓ No field injection
- ✗ Field injection with `@Autowired`
- ✗ Setter injection

**Scoring**:
- **Well-applied**: Patterns used correctly, clear benefits
- **Inconsistent**: Mix of good and poor implementations
- **Missing**: Patterns not used where they should be

## SOLID Principles Assessment

### Single Responsibility Principle

**Check**:
- Controllers have single responsibility (HTTP handling)
- Services have focused scope (e.g., `UserService` only manages users)
- Classes have <10 methods (guideline, not hard rule)
- Methods have <30 lines (guideline)

**Violations**:
- Controllers handling multiple resources
- God services (e.g., `ApplicationService`)
- Classes with >15 dependencies

### Open/Closed Principle

**Check**:
- Strategy pattern for varying behavior
- Interface-based design allows extension
- Configuration-driven behavior changes

**Violations**:
- Long if/else or switch statements
- Modifying existing classes to add features
- Hardcoded logic that can't be extended

### Liskov Substitution Principle

**Check**:
- Implementations can replace interfaces without breaking
- Derived classes don't weaken preconditions
- Exceptions are consistent across implementations

### Interface Segregation Principle

**Check**:
- Interfaces are focused and small
- Clients don't depend on unused methods
- Repository interfaces expose only needed methods

**Violations**:
- Fat interfaces with many methods
- Interfaces used by only one class

### Dependency Inversion Principle

**Check**:
- High-level modules depend on abstractions
- Use of interfaces for dependencies
- Spring dependency injection throughout

**Violations**:
- Direct instantiation (`new Service()`)
- Concrete classes in constructor parameters
- Static method calls to other layers

## Security Assessment

### Authentication & Authorization

**Check**:
- JWT properly validated on each request
- Tokens have expiration
- Passwords hashed (BCrypt, Argon2)
- Role-based access control implemented
- `@PreAuthorize` on sensitive endpoints

**Violations**:
- Plaintext passwords
- Missing authorization checks
- JWT without expiration
- Roles not enforced

### Input Validation

**Check**:
- `@Valid` on request bodies
- JSR-303 validation annotations
- Custom validators for complex rules
- SQL injection prevention (parameterized queries)

**Violations**:
- No validation on user input
- String concatenation in queries
- Missing `@Valid` annotations

### CORS Configuration

**Check**:
- CORS properly configured
- Allowed origins explicitly listed
- Credentials handling correct

**Violations**:
- `allowedOrigins = "*"` with credentials
- Missing CORS config

## Transaction Management Assessment

### Proper Usage

**Check**:
- `@Transactional` on service methods
- `readOnly = true` for read operations
- Transaction boundaries at service level
- Proper propagation settings

**Violations**:
- `@Transactional` on controllers
- Missing transactions for writes
- Transactions span multiple services
- Long-running transactions

## Data Access Assessment

### JPA Entity Quality

**Check**:
- Proper `@Id` and generation strategy
- Lazy loading for associations
- `equals()` and `hashCode()` based on ID
- `toString()` excludes lazy collections
- Audit fields (`createdAt`, `updatedAt`)

**Violations**:
- Eager fetching by default
- Missing cascade settings
- N+1 query problems
- `equals()` based on mutable fields

### Query Optimization

**Check**:
- Use of projections for large entities
- Join fetching to avoid N+1
- Pagination for large results
- Proper indexing in database

**Violations**:
- Loading entire entities for one field
- Missing join fetches causing N+1
- No pagination on unbounded queries

## Exception Handling Assessment

### Proper Error Handling

**Check**:
- Global exception handler (`@RestControllerAdvice`)
- Custom exceptions for domain errors
- Proper HTTP status codes
- Structured error responses

**Violations**:
- Generic `Exception` catches
- Exceptions with stack traces exposed
- Inconsistent error formats
- Missing exception handling

## Testing Assessment

### Test Coverage

**Check**:
- Unit tests for service layer
- Integration tests for repositories
- Controller tests with MockMvc
- Testcontainers for database tests

**Violations**:
- No tests
- Only testing controllers
- Missing integration tests
- Hard-coded test data in production code

## Configuration Assessment

### Proper Configuration Management

**Check**:
- Externalized configuration
- Profile-specific properties
- Environment variables for secrets
- No hardcoded credentials

**Violations**:
- Passwords in `application.properties`
- Same config for all environments
- Hardcoded URLs and credentials

## Anti-Pattern Identification

### Common Anti-Patterns

**God Object**:
- Class with >20 methods
- Class with >10 dependencies
- Class handling multiple concerns

**Anemic Domain Model**:
- Entities with only getters/setters
- All logic in services
- No domain behavior

**Service Locator**:
- Manual lookup of beans
- Static access to Spring context
- Not using dependency injection

**Fat Controller**:
- Business logic in controllers
- Direct database access from controller
- Complex calculations in controller methods

**Magic Numbers/Strings**:
- Hardcoded values instead of constants
- Unnamed configuration values
- Status codes as numbers

## Scoring Summary

For each criterion, assign:
- **Excellent**: Best practices followed, no violations
- **Good**: Generally correct, minor issues
- **Fair**: Some problems, needs improvement
- **Poor**: Significant violations, major refactoring needed

### Overall Architecture Quality

Calculate based on:
- Layer Separation (30%)
- Design Patterns (20%)
- SOLID Principles (20%)
- Security (15%)
- Code Organization (10%)
- Other factors (5%)

**Final rating**:
- **A**: >85%, production-ready architecture
- **B**: 70-85%, good architecture with minor improvements needed
- **C**: 55-70%, adequate but needs refactoring
- **D**: 40-55%, significant problems, major refactoring required
- **F**: <40%, poor architecture, consider redesign

## Recommendations Framework

### High Priority (Must Fix)

Issues that:
- Introduce security vulnerabilities
- Violate core architectural principles
- Make code unmaintainable
- Create performance problems

### Medium Priority (Should Fix)

Issues that:
- Reduce code quality
- Make testing difficult
- Create technical debt
- Violate best practices

### Low Priority (Nice to Have)

Issues that:
- Improve consistency
- Enhance readability
- Follow conventions
- Optimize performance

## Example Evaluation Report

```markdown
# Architecture Evaluation: E-Commerce Application

## Summary

Overall Quality: **B (78%)**

The architecture follows N-tier layering with clear separation between controllers,
services, and repositories. JWT authentication is properly implemented and DTOs are
used consistently. Some improvements needed in transaction management and exception
handling.

## Strengths

- Clean layer separation with controllers delegating to services
- Proper use of Spring Data JPA repositories
- DTOs separate API contracts from domain models
- JWT authentication with role-based access control
- Constructor injection throughout codebase

## Concerns

### High Priority

**Missing transaction boundaries** (Security/Correctness)
- Several service methods modify data without `@Transactional`
- Example: `OrderService.updateStatus()` at line 145
- Risk: Partial updates if exceptions occur
- Fix: Add `@Transactional` to all write operations

**Exposed entity in REST response** (Architecture Violation)
- `OrderController.getOrder()` returns `Order` entity directly
- File: `OrderController.java:78`
- Risk: Exposes internal structure, causes lazy loading issues
- Fix: Return `OrderResponseDto` instead

### Medium Priority

**God service detected** (Design)
- `ProductService` has 18 methods and 8 dependencies
- Consider splitting into `ProductQueryService` and `ProductCommandService`
- Apply CQRS pattern for better separation

**N+1 query problem** (Performance)
- `OrderService.findAll()` causes N+1 queries for order details
- Fix: Use `@EntityGraph` or join fetch

### Low Priority

**Inconsistent exception handling** (Code Quality)
- Some services throw `RuntimeException`, others use custom exceptions
- Standardize on domain exceptions

## Recommendations

1. Add missing `@Transactional` annotations (1-2 hours)
2. Create OrderResponseDto and update controller (2-3 hours)
3. Split ProductService into query/command services (4-6 hours)
4. Fix N+1 queries with join fetching (2-3 hours)
5. Standardize exception handling (3-4 hours)

## Architecture Metrics

- **Layer separation**: Clean
- **Dependency direction**: Correct
- **Design patterns**: Well-applied
- **Code organization**: Clear
- **SOLID adherence**: Good (minor violations)
- **Security**: Good (JWT, RBAC implemented)
- **Transaction management**: Fair (some missing)
- **Exception handling**: Fair (inconsistent)
```
