# Code Review

## 1. Types

### Actionable Items / Refactoring Checklist

- [ ] **Consolidate Supabase type definitions**
  - **Files:** `packages/server/src/types/supabase.d.ts`, `packages/shared/src/types/supabase.d.ts`
  - **Action:** Unify and deduplicate Supabase/Postgrest types between server and shared. Ensure all client/server code uses a single source of truth for DB types.
  - **Rationale:** Prevents drift, reduces maintenance, and ensures type safety across the stack.

- [ ] **Remove duplication in material type extensions**
  - **Files:** `packages/server/src/types/material.ts`, `packages/client/src/types/material.ts`, `packages/shared/src/types/material.ts`
  - **Action:** Refactor to minimize duplication between shared, server, and client material types. Use extension/augmentation patterns only where strictly necessary.
  - **Rationale:** Reduces risk of inconsistency and simplifies future changes.

- [ ] **Align ML package types with shared types**
  - **Files:** `packages/ml/src/types/services.d.ts`, `packages/shared/src/types/material.ts`, `packages/shared/src/types/recognition.ts`
  - **Action:** Update ML types to import and use shared types where possible. Remove local redefinitions.
  - **Rationale:** Ensures consistency and type safety for ML-related data structures.

- [ ] **Add missing Zod validation for recognition types**
  - **Files:** `packages/shared/src/types/recognition.ts`
  - **Action:** Ensure all recognition-related types have corresponding Zod schemas for runtime validation.
  - **Rationale:** Prevents invalid data from propagating through the system.

- [ ] **Audit and document all type extension points**
  - **Files:** All `types/*.ts` files
  - **Action:** Add comments and documentation for all extension/augmentation points in type definitions, especially where server/client diverge from shared.
  - **Rationale:** Makes extension mechanisms explicit and maintainable.

- [ ] **Review and update user model for completeness and security**
  - **Files:** `packages/shared/src/types/user.ts`
  - **Action:** Ensure all sensitive fields are properly typed, documented, and not leaked to client. Add comments for any fields with special handling (e.g., tokens, audit logs).
  - **Rationale:** Prevents accidental exposure of sensitive data and clarifies model intent.

### Summary Table

| Area         | Issue/Opportunity                                 | File(s) Affected                                      | Action/Recommendation                  |
|--------------|---------------------------------------------------|-------------------------------------------------------|-----------------------------------------|
| Supabase     | Type duplication/drift                            | server/shared supabase.d.ts                           | Consolidate to single source of truth   |
| Material     | Duplication in extensions                         | shared/server/client material.ts                      | Refactor, minimize duplication          |
| ML Types     | Not aligned with shared types                     | ml/services.d.ts, shared/material.ts, recognition.ts  | Align, import shared types              |
| Recognition  | Missing Zod validation                            | shared/recognition.ts                                 | Add Zod schemas                        |
| Extensions   | Extension points not documented                   | all types/*.ts                                        | Add comments, document extension points |
| User Model   | Sensitive fields, completeness, documentation     | shared/user.ts                                        | Audit, document, secure                |

---

## 2. Services/Modules

### Actionable Items / Refactoring Checklist

- [ ] **Centralize and document environment variable usage**
  - **Files:** `services/auth/sessionManager.service.ts`, `services/auth/apiKeyManager.service.ts`, `services/analytics/analyticsService.ts`, and all other services using `process.env`
  - **Action:** Refactor to use a typed config module for all environment variables (e.g., JWT_SECRET), with validation and documentation.
  - **Rationale:** Prevents runtime errors, improves security, and makes configuration explicit.

- [ ] **Add input validation and sanitization for all user-supplied data**
  - **Files:** All service entry points, especially `sessionManager.service.ts`, `twoFactor.service.ts`, `apiKeyManager.service.ts`, `analyticsService.ts`
  - **Action:** Use Zod or similar schema validation for all user input (e.g., tokens, codes, user IDs, query params).
  - **Rationale:** Prevents injection, type errors, and security vulnerabilities.

- [ ] **Improve error handling and error propagation**
  - **Files:** All services, especially `analyticsService.ts`, `sessionManager.service.ts`, `twoFactor.service.ts`
  - **Action:** Standardize error objects, avoid leaking sensitive info, and ensure all errors are logged with context.
  - **Rationale:** Improves debuggability and security.

- [ ] **Add/expand unit and integration tests for all service methods**
  - **Files:** All service files, especially those with complex logic (e.g., `analyticsService.ts`, `twoFactor.service.ts`)
  - **Action:** Ensure all public service methods have corresponding tests, including edge cases and error paths.
  - **Rationale:** Increases reliability and prevents regressions.

- [ ] **Refactor repeated logic into utility/helper functions**
  - **Files:** `analyticsService.ts`, `sessionManager.service.ts`, `twoFactor.service.ts`
  - **Action:** Extract repeated patterns (e.g., Supabase queries, token generation, code sending) into shared helpers.
  - **Rationale:** Reduces duplication and improves maintainability.

- [ ] **Document all service interfaces and expected side effects**
  - **Files:** All service files
  - **Action:** Add/expand JSDoc comments for all exported functions and classes, including side effects (e.g., DB writes, external API calls).
  - **Rationale:** Improves onboarding and reduces accidental misuse.

- [ ] **Review and restrict permissions/scopes for API keys**
  - **Files:** `apiKeyManager.service.ts`
  - **Action:** Audit all usages of `ApiKeyScope`, ensure least-privilege, and document all available scopes.
  - **Rationale:** Prevents privilege escalation and clarifies API key usage.

- [ ] **Harden session and token management**
  - **Files:** `sessionManager.service.ts`
  - **Action:** Ensure tokens are invalidated on password change, add rotation support, and audit for timing attacks.
  - **Rationale:** Improves account security and compliance.

- [ ] **Add rate limiting and abuse protection to sensitive endpoints**
  - **Files:** `sessionManager.service.ts`, `twoFactor.service.ts`, `apiKeyManager.service.ts`
  - **Action:** Integrate rate limiting middleware or checks for login, token refresh, 2FA, and API key creation endpoints.
  - **Rationale:** Prevents brute-force and abuse.

- [ ] **Audit and document all external service dependencies**
  - **Files:** All service files (esp. those using Supabase, Redis, SMS/email providers, MCP, etc.)
  - **Action:** List all external dependencies, document failure modes, and add fallback/error handling where missing.
  - **Rationale:** Improves reliability and operational awareness.


#### Subscription Services

- [ ] Centralize and validate all Stripe integration logic (`pauseManager.service.ts`, `teamBilling.service.ts`)
- [ ] Add/expand input validation for all public service methods (all files)
- [ ] Standardize and document error handling (all files)
- [ ] Add/expand unit and integration tests for all service methods (all files)
- [ ] Audit and document all side effects and external dependencies (all files)
- [ ] Review and restrict admin actions (`pricingProtection.service.ts`, `teamBilling.service.ts`)
- [ ] Refactor repeated pricing/tier logic into shared helpers (`bulkPricing.service.ts`, `pricingProtection.service.ts`, `teamBilling.service.ts`)
- [ ] Add rate limiting and abuse protection for sensitive endpoints (all files)

#### Supabase Services

- [ ] Consolidate and document Supabase client usage (all files)
- [ ] Audit and document all RPC and raw SQL usage (all files)
- [ ] Add/expand input validation and type safety for all service methods (all files)
- [ ] Standardize and document error handling (all files)
- [ ] Add/expand unit and integration tests for all service methods (all files)
- [ ] Refactor repeated transformation logic into shared helpers (material/dataset services)
- [ ] Document and harden all Python integration points (enhanced-vector-service.ts)
- [ ] Audit and document all side effects and external dependencies (all files)
- [ ] Add/expand health checks and monitoring for Supabase and vector search (utility/helper)

#### Storage Services

- [ ] Consolidate and document unified storage interface (all files)
- [ ] Audit and document all provider-specific logic and configuration (all files)
- [ ] Add/expand input validation and error handling for all storage operations (all files)
- [ ] Add/expand unit and integration tests for all storage methods (all files)
- [ ] Refactor repeated logic for path/bucket extraction and content type detection (supabaseStorageService.ts, s3Service.ts)
- [ ] Audit and document all side effects and external dependencies (all files)
- [ ] Add/expand health checks and monitoring for storage providers (storageInitializer.ts, supabaseStorageService.ts)

#### Search Services

- [ ] Consolidate and document search service interfaces and responsibilities (all files)
- [ ] Audit and document all integration points with vector/hybrid search and MCP (all files)
- [ ] Add/expand input validation and type safety for all search options and results (all files)
- [ ] Standardize and document error handling and fallback logic (all files)
- [ ] Add/expand unit and integration tests for all search methods (all files)
- [ ] Refactor repeated logic for query expansion, entity extraction, and ranking (query-understanding-service.ts, domain-search-service.ts, conversational-search-service.ts)
- [ ] Audit and document all side effects and external dependencies (all files)
- [ ] Add/expand health checks and monitoring for search services and integrations (all files)

#### Redis Services

- [ ] Document and standardize Redis client usage and error handling (rateLimiter.service.ts, redisClient.ts)
- [ ] Add/expand input validation for rate limit options (rateLimiter.service.ts)
- [ ] Add/expand unit and integration tests for rate limiting logic (rateLimiter.service.ts)
- [ ] Audit and document all side effects and external dependencies (rateLimiter.service.ts)
- [ ] Add/expand health checks and monitoring for Redis connectivity (redisClient.ts, rateLimiter.service.ts)
- [ ] Consider supporting additional rate limiting strategies (rateLimiter.service.ts)


## 3. Frontend/Client

*(To be filled in next step)*

## 4. ML/Agents/Admin

*(To be filled in next step)*

## 5. General/Infrastructure

*(To be filled in next step)*

---

# Instructions
- Check off each item as it is completed.
- For each area, add new findings and action points as the review progresses.
- Use this document as the single source of truth for code review tasks and technical debt.
