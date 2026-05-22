---
name: architecture-expert
description: Analyze, evaluate, and document software architecture with focus on layer-based patterns and Java backend principles. Use when users ask about "project structure", "architecture", "layering", "design patterns", want to "evaluate architecture", "show architecture diagram", "document architecture", or need guidance on "backend architecture", "Java best practices", or "N-tier architecture". Also trigger when users want to understand how components interact, assess architectural quality, or create architecture documentation.
license: MIT
---

# Architecture Expert

## Overview

Evaluate, document, and improve software architecture with emphasis on layer-based patterns, separation of concerns, and Java/Spring Boot best practices. This skill helps assess existing architectures against industry standards and create comprehensive architecture documentation.

## Core Capabilities

- **Analyze** existing project structure and identify architectural patterns
- **Evaluate** architecture quality against layer-based principles
- **Document** architecture with diagrams and detailed component descriptions
- **Recommend** improvements based on SOLID principles and design patterns
- **Assess** Java backend architectures (Spring Boot, JPA, REST APIs)

## When to Use This Skill

Trigger this skill when the user:
- Asks to "show the architecture" or "explain the project structure"
- Wants to evaluate if their architecture follows best practices
- Needs to create or update ARCHITECTURE.md documentation
- Asks about "layering", "separation of concerns", or "design patterns"
- Wants guidance on Java backend architecture (controllers, services, repositories)
- Needs to understand component interactions and dependencies
- Wants to assess architectural quality or identify code smells

## Architecture Analysis Workflow

### Step 1: Discover Project Structure

Start by understanding the codebase structure:

1. **Identify technology stack**: Check `pom.xml`, `package.json`, `build.gradle` for frameworks
2. **Map directory structure**: Use Glob to find key directories:
   - Backend: `src/main/java/**`, `src/main/resources/**`
   - Frontend: `src/app/**`, `src/components/**`
   - Database: Migration files, schema definitions
3. **Identify layers**: Look for controller, service, repository, model packages
4. **Find configuration**: Application configs, security configs, database configs

### Step 2: Analyze Architecture Pattern

**For Java/Spring Boot backends**, identify:
- **Controller layer**: REST endpoints, request/response handling
- **Service layer**: Business logic, transaction management
- **Repository layer**: Data access, JPA repositories
- **Model layer**: JPA entities, domain objects
- **DTO layer**: Data transfer objects, mappers
- **Security layer**: Authentication, authorization, filters
- **Configuration**: Bean definitions, property management

**Key checks**:
- ✓ Controllers only handle HTTP concerns, delegate to services
- ✓ Services contain business logic, manage transactions
- ✓ Repositories abstract database access
- ✓ DTOs separate API contracts from domain models
- ✓ Models use JPA annotations correctly
- ✓ Security configured with proper filters and authentication

### Step 3: Evaluate Against Best Practices

#### Layer-Based Architecture Principles

**Separation of Concerns**:
- Each layer has a single, well-defined responsibility
- No business logic in controllers
- No HTTP concerns in services
- No database queries in controllers

**Dependency Direction**:
- Controller → Service → Repository → Database
- Higher layers depend on lower layers, never reverse
- Use dependency injection (constructor injection preferred)

**Data Flow**:
- Request → Controller (validates) → Service (processes) → Repository (persists) → Database
- Response: Database → Entity → Mapper → DTO → Controller → JSON

#### Java/Spring Boot Best Practices

**Controllers**:
```java
@RestController
@RequestMapping("/api/resources")
@RequiredArgsConstructor  // Constructor injection
public class ResourceController {
    private final ResourceService service;
    
    @GetMapping
    public List<ResourceDto> getAll() {
        return service.findAll();  // Delegate to service
    }
    
    @PreAuthorize("hasRole('ADMIN')")  // Authorization at controller
    @PostMapping
    public ResourceDto create(@Valid @RequestBody ResourceRequest request) {
        return service.create(request);
    }
}
```

**Services**:
```java
@Service
@RequiredArgsConstructor
@Transactional  // Transaction boundary
public class ResourceService {
    private final ResourceRepository repository;
    private final ResourceMapper mapper;
    
    public ResourceDto create(ResourceRequest request) {
        Resource entity = mapper.toEntity(request);
        Resource saved = repository.save(entity);
        return mapper.toDto(saved);
    }
}
```

**Repositories**:
```java
@Repository
public interface ResourceRepository extends JpaRepository<Resource, UUID> {
    List<Resource> findByStatus(Status status);
    
    @Query("SELECT r FROM Resource r WHERE r.createdAt > :date")
    List<Resource> findRecent(@Param("date") LocalDateTime date);
}
```

**Models**:
```java
@Entity
@Table(name = "resources", schema = "myschema")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Resource {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @Column(nullable = false)
    private String name;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;
}
```

#### Design Pattern Assessment

Identify and evaluate usage of:

**Repository Pattern**: Data access abstraction via Spring Data JPA
**DTO Pattern**: Separation of API contracts from domain models
**Strategy Pattern**: Swappable business logic implementations
**Factory Pattern**: Object creation abstraction
**Dependency Injection**: Constructor injection with `@RequiredArgsConstructor`
**Builder Pattern**: Complex object construction (Lombok `@Builder`)

### Step 4: Generate Architecture Documentation

Create comprehensive documentation following this structure:

```markdown
# Architecture

[One-sentence description of what the application enables users to do]

**Stack**: [Key technologies - backend, frontend, database]

## System overview

[ASCII diagram showing high-level component interaction]

**Capabilities**:
- [User-facing features with action verbs]

## Technology stack

**Backend**:
- [List key backend technologies with versions]

**Frontend**:
- [List key frontend technologies with versions]

## Project structure

[Annotated directory tree showing key components]

## Backend architecture

**N-Tier layering**:
```
Controller → Service → Repository → Database
```

[Explanation of each layer's responsibility]

### Key components

[Code examples showing typical patterns for each layer]

## Frontend architecture

[If applicable - component hierarchy, state management, routing]

## Database design

Schema: `[schema-name]`

### Entity relationships

[ER diagram or description of table relationships]

### Tables

[Key table definitions with columns and constraints]

## API design

[REST endpoint documentation organized by resource]

## Authentication & authorization

[How auth works - JWT flow, role-based access control]

## Design patterns

[Patterns used in the codebase with code examples]

## Development workflow

### Local setup
[Commands to start database, backend, frontend]

### Testing
[How to run tests]

### Code quality
[Linting, formatting, type checking commands]

## Reference

### Commands
[Quick reference for common operations]

### Test credentials
[If applicable]
```

**Documentation principles**:
- Lead with value (what users can do) not implementation
- Use sentence case for headers
- Consolidate examples with inline comments
- Cut redundancy - every sentence adds new information
- Keep code examples focused and realistic

## Architecture Evaluation Report

When explicitly asked to evaluate architecture, provide a structured report:

### Quality Assessment

**Strengths**:
- [What the architecture does well]
- [Adherence to best practices]
- [Good separation of concerns]

**Concerns**:
- [Violations of layer boundaries]
- [Missing abstractions]
- [Tight coupling]
- [Code smells]

**Recommendations**:
- [Specific improvements with rationale]
- [Refactoring suggestions]
- [Pattern implementations]

### Architecture Metrics

- **Layer separation**: [Clean | Moderate | Violated]
- **Dependency direction**: [Correct | Mixed | Reversed]
- **Design patterns**: [Well-applied | Inconsistent | Missing]
- **Code organization**: [Clear | Moderate | Confused]

## Common Anti-Patterns to Identify

**Business logic in controllers**:
```java
// ❌ Bad
@GetMapping("/orders/{id}")
public OrderDto getOrder(@PathVariable UUID id) {
    Order order = repository.findById(id).orElseThrow();
    // Business logic in controller
    if (order.getTotal() > 1000) {
        order.setDiscount(0.1);
    }
    return mapper.toDto(order);
}
```

**Service bypassing**:
```java
// ❌ Bad - Controller calling repository directly
@PostMapping
public ResourceDto create(@RequestBody ResourceDto dto) {
    Resource entity = mapper.toEntity(dto);
    return mapper.toDto(repository.save(entity));
}
```

**God classes**: Services with too many dependencies (>5) or too many methods (>15)

**Anemic domain models**: Entities with only getters/setters, no behavior

**Missing DTOs**: Exposing entities directly in REST APIs

## Interaction Patterns

**User asks: "Show me the architecture"**
1. Discover project structure
2. Generate ASCII diagram showing component interaction
3. Explain each layer's role
4. Show code examples of typical patterns

**User asks: "Evaluate the architecture"**
1. Analyze layers and dependencies
2. Check against best practices
3. Identify violations and anti-patterns
4. Provide structured evaluation report
5. Recommend specific improvements

**User asks: "Document the architecture"**
1. Analyze project structure
2. Create comprehensive ARCHITECTURE.md
3. Include diagrams, code examples, setup instructions
4. Apply technical writing principles for clarity

**User asks: "Is this good architecture?"**
1. Assess layer separation
2. Check dependency direction
3. Evaluate design pattern usage
4. Identify code smells
5. Provide verdict with specific evidence

## Reference Files

When needed, consult:
- `references/java-patterns.md` - Detailed Java/Spring Boot patterns
- `references/evaluation-criteria.md` - Architecture quality metrics
- `references/refactoring-guide.md` - Common refactoring scenarios

## Notes

- Focus on practical, actionable feedback over academic theory
- Provide code examples showing both problems and solutions
- When documenting, follow technical-writer skill principles
- For complex evaluations, read actual code files to verify patterns
- Architecture varies by project size - adjust recommendations accordingly
