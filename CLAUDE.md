# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a fullstack e-commerce application with:
- **Backend**: Spring Boot 4.0.6 API (`onlineshopapi/`)
- **Frontend**: Angular 21 SPA (`onlineshopui/`)
- **Database**: PostgreSQL 18

The application supports two user roles (Customer and Administrator) with features including product catalog, shopping cart, order management, and admin product CRUD operations.

## Development Setup

### Prerequisites
- Java 21 (backend)
- Node.js 24+ (frontend)
- Maven (backend build)
- Docker & Docker Compose (database)

### Database Setup

Start PostgreSQL database:
```bash
cd docker/development
docker-compose up -d
```

Database credentials (local):
- Host: localhost:5433
- Database: shopdb
- User: shopuser
- Password: shoppassword
- Schema: onlineshop

Flyway migrations run automatically on startup and create the schema and seed mock data.

### Backend (onlineshopapi)

**Run locally:**
```bash
cd onlineshopapi
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

The API runs on `http://localhost:3000/api` (note the `/api` context path).

**Build:**
```bash
mvn clean install
```

**Run tests:**
```bash
mvn test
```

**Environment variables required:**
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` - Database connection
- `CORS_ALLOWED_ORIGINS` - Allowed CORS origins (comma-separated)
- `JWT_SECRET` - Secret key for JWT token generation

For local development, use the `local` profile which has these pre-configured in `application-local.yml`.

### Frontend (onlineshopui)

**Install dependencies:**
```bash
cd onlineshopui
npm install
```

**Run development server (with real API):**
```bash
npm start
# or
ng serve
```

Runs on `http://localhost:4200/`

**Run with mock backend:**
```bash
npm run start:mock
# or
ng serve --configuration mock
```

**Build:**
```bash
npm run build
```

**Run tests:**
```bash
npm test
# or
ng test
```

**Lint:**
```bash
npm run lint
```

**Format code:**
```bash
npm run format
```

## Gotchas

### Database Port
Docker Compose maps PostgreSQL to **port 5433** (not default 5432) to avoid conflicts with local installations. Connection string in `application-local.yml` already uses the correct port.

### Lombok Annotation Processing
Backend compilation requires Lombok annotation processing enabled in your IDE:
- **IntelliJ IDEA**: Settings → Build, Execution, Deployment → Compiler → Annotation Processors → Enable annotation processing
- **Eclipse**: Install Lombok by running the `lombok.jar` installer
- **VS Code**: Install "Lombok Annotations Support" extension

Without this, you'll see compilation errors for generated getters/setters/constructors.

### Order Fulfillment Strategy
Switch between order processing strategies in `application.yml`:
```yaml
order:
  strategy: SINGLE_LOCATION      # Ship entire order from one warehouse (default)
  # strategy: MULTIPLE_LOCATIONS # Allow splitting order across warehouses
```

`SINGLE_LOCATION` throws `OrderNotProcessableException` if no single warehouse has all products in stock. `MULTIPLE_LOCATIONS` optimizes for fulfillment rate by splitting orders.

### Mock Mode
`npm run start:mock` uses Mock Service Worker (MSW) to intercept HTTP requests in the browser. Backend doesn't need to be running. Mock data defined in `onlineshopui/src/app/core/mocks/`.

## Architecture

### Backend Structure

```
onlineshopapi/src/main/java/msg/onlineshopapi/
├── config/          - Application configuration (OpenAPI, CORS)
├── controller/      - REST API endpoints
├── dto/             - Data Transfer Objects
│   └── mapper/      - Entity-DTO mappers
├── exception/       - Custom exceptions and handlers
├── model/           - JPA entities
├── repository/      - Spring Data JPA repositories
├── security/        - Security config, JWT filter, user details
└── service/         - Business logic
    └── strategy/    - Order processing strategies
```

**Key patterns:**
- REST controllers use DTOs for request/response
- Service layer contains business logic
- JWT-based authentication with Spring Security
- Strategy pattern for order processing (`SINGLE_LOCATION` vs `MULTIPLE_LOCATIONS`)
- Flyway for database migrations in `src/main/resources/db/migration/`

**API Documentation:**
Swagger UI available at `http://localhost:3000/api/swagger-ui.html` when running.

### Frontend Structure

```
onlineshopui/src/app/
├── clib/            - Shared component library (navbar, modals, cards, etc.)
│   ├── components/  - Reusable UI components
│   ├── layouts/     - Layout components (root-layout)
│   └── services/    - Shared services
├── core/            - Core app functionality
│   ├── config/      - Constants and navigation routes
│   ├── mocks/       - Mock data and MSW handlers for development
│   ├── providers/   - Dependency injection providers
│   ├── services/    - Core services (notifications, environment)
│   └── types/       - Shared types, DTOs, enums
└── features/        - Feature modules (lazy-loaded)
    ├── auth/        - Authentication (login, register, guards, interceptors)
    ├── cart/        - Shopping cart
    ├── orders/      - Order management
    └── products/    - Product catalog and management
```

**Key patterns:**
- Feature-based architecture with lazy-loaded routes
- Standalone components (no NgModules)
- Route guards: `authGuard` for authentication, `rolesGuard` for authorization, `guestGuard` for unauthenticated routes
- `AuthTokenInterceptor` adds JWT to requests
- Mock Service Worker (MSW) for API mocking in mock mode
- Signals for reactive state management
- Tailwind CSS 4 for styling
- Environment-based configuration with file replacements

**Environments:**
- `development` - Real backend at `${API_URL}` (set via environment variable)
- `mock` - Uses MSW to mock API responses
- `production` - Production build with real backend

### Authentication Flow

1. User logs in via `/api/auth/login` with username/password
2. Backend validates credentials and returns JWT token
3. Frontend stores token in localStorage
4. `AuthTokenInterceptor` adds `Authorization: Bearer {token}` header to all requests
5. Backend `JwtAuthFilter` validates token on protected endpoints

User roles (`ADMIN`, `CUSTOMER`) control access via `@PreAuthorize` annotations on backend and `hasRole` directive on frontend.

## Key Files

- `onlineshopapi/src/main/resources/application.yml` - Main backend configuration
- `onlineshopapi/src/main/resources/application-local.yml` - Local development overrides
- `onlineshopui/angular.json` - Angular build configurations
- `onlineshopui/src/environments/` - Environment-specific settings
- `onlineshopui/src/app/app.routes.ts` - Main routing configuration
- `onlineshopui/src/app/core/config/constants/navigation.constants.ts` - Route constants
- `docker/development/docker-compose.yml` - Local database setup

## Contributing

- All changes must go through a PR to the `main` branch
- Branch naming: `feat/<task_id>-<short-desc>`
- Backend uses Lombok - ensure annotation processing is enabled in your IDE
- Frontend uses Prettier - run `npm run format` before committing

## Test Credentials

Local mock data (`V1.1__populate_mock_data.sql`) seeds test users. All passwords are `password`.

**Admin account:**
- Email: `admin@onlineshop.com`
- Password: `password`
- Role: ADMIN

**Customer accounts:**
- Email: `john.doe@email.com` / Password: `password`
- Email: `jane.smith@email.com` / Password: `password`
- Role: CUSTOMER
