# Code Review: Actionable Tasks & Improvement Areas

This document summarizes findings, potential issues, and areas for improvement identified during the codebase review.

## I. Critical Issues & Blockers

These issues significantly impact core functionality or security and should be prioritized.

1.  **Mocked JWT/JWKS Libraries in Auth Middleware:**
    *   **File:** [`packages/server/src/middleware/auth.middleware.ts`](packages/server/src/middleware/auth.middleware.ts:4-96)
    *   **Issue:** `jsonwebtoken` and `jwks-rsa` are mocked, and the mocks throw errors. This means Supabase JWT validation is currently non-functional.
    *   **Impact:** Authentication will fail.
    *   **Action:** Install the actual `jsonwebtoken` and `jwks-rsa` libraries, remove mocks, and ensure they are correctly imported and used for JWT verification.
    *   **Priority:** Critical

2.  **Architectural Inconsistency: Material Data Storage (MongoDB Mongoose Model vs. Supabase/PostgreSQL):**
    *   **Files:** [`packages/server/src/models/`](packages/server/src/models) directory (contains numerous Mongoose models like [`material.model.ts`](packages/server/src/models/material.model.ts:1), [`searchIndex.model.ts`](packages/server/src/models/searchIndex.model.ts:1), etc.), [`packages/server/src/services/supabase/supabase-schema.md`](packages/server/src/services/supabase/supabase-schema.md:1) (defines PostgreSQL schema), Supabase-specific services (e.g., [`SupabaseMaterialService`](packages/server/src/services/supabase/supabase-material-service.ts:1)).
    *   **Issue:** There's a fundamental contradiction regarding the primary database. The entire `packages/server/src/models/` directory appears to consist of Mongoose models for MongoDB, while many services and schema documents point to Supabase/PostgreSQL as the target database for the same entities (e.g., materials, API keys, user sessions).
    *   **Impact:** This is a major architectural conflict. If services are using different data sources for the same core entity (`materials`), it will lead to data divergence, incorrect application behavior, and significant maintenance issues. Vector search implementations will also target different databases with different capabilities.
    *   **Action:**
        1.  **Immediately clarify the definitive source of truth for `materials` data.**
        2.  If Supabase/PostgreSQL is the target (strongly suggested by overall architecture):
            *   The entire Mongoose-based `packages/server/src/models/` directory should be considered **legacy and be scheduled for deprecation/removal.**
            *   All data entity operations (CRUD, queries) must be consistently routed through Supabase-compatible services or a new Supabase-based data access layer/repository pattern if preferred over direct client use in services.
            *   Any data currently in MongoDB for these entities needs a comprehensive migration strategy to Supabase/PostgreSQL.
            *   Functionality embedded in Mongoose models (like text extraction in `material.model.ts` or index management in `searchIndex.model.ts`) needs to be re-evaluated and re-implemented in a Supabase-compatible way if still required.
        3.  If MongoDB is (for some reason) intentionally used for a subset of data alongside Supabase for others (a hybrid approach), this architecture must be explicitly documented, its rationale clarified, and services must be very clear about which data store they target for each entity. The current state suggests an incomplete migration or conflicting development efforts.
    *   **Priority:** Critical (Fundamental architectural decision)

3.  **Inefficient/Incorrect Vector Search Implementations (Multiple Locations):**
    *   **File 1 (Legacy Mongoose Model):** [`packages/server/src/models/material.model.ts`](packages/server/src/models/material.model.ts:591-657) (method `findSimilarMaterials`)
        *   **Issue:** Performs manual client-side cosine similarity on MongoDB data. Does not scale.
        *   **Current Status:** This method is now deprecated and returns `[]`.
    *   **File 2 (Old Supabase Service - Now Neutered):** [`packages/server/src/services/supabase/vector-search.ts`](packages/server/src/services/supabase/vector-search.ts:1) (method `findSimilar`)
        *   **Original Issue:** Flawed query parameterization for pgvector.
        *   **Current Status:** This method is also deprecated and returns `[]`.
    *   **File 3 (KnowledgeBase):** [`packages/server/src/services/knowledgeBase/knowledgeBaseService.ts`](packages/server/src/services/knowledgeBase/knowledgeBaseService.ts:345-389) (method `vectorSearch`)
        *   **Issue:** Relies on the problematic (and now neutered) `findSimilarMaterials` from the Mongoose `material.model.ts`.
    *   **Schema Confirmation:** The `find_similar_materials` RPC defined in [`supabase-schema.md`](packages/server/src/services/supabase/supabase-schema.md:298) for Supabase/PostgreSQL appears correctly implemented for vector search.
    *   **Impact:** Vector similarity search features will be non-functional or use incorrect data sources if relying on these flawed/deprecated patterns.
    *   **Action:**
        *   Confirm deprecation and plan removal of the Mongoose [`material.model.ts`](packages/server/src/models/material.model.ts:1) if Supabase is the target.
        *   Ensure `KnowledgeBaseService.vectorSearch` and any other services needing material vector search use a performant, database-side vector search against the correct database (presumably Supabase, e.g., via `EnhancedVectorServiceImpl` or the correct `find_similar_materials` RPC).
        *   Verify all active vector search implementations (especially in `EnhancedVectorServiceImpl` and relevant RPCs like `material_hybrid_search`) correctly handle query embedding and parameterization against the chosen primary database.
    *   **Priority:** Critical

3.  **Flawed Vector Search Logic in SQL Function `search_materials_by_text`:**
    *   **File:** [`packages/server/src/services/supabase/migrations/006_enhanced_vector_storage.sql`](packages/server/src/services/supabase/migrations/006_enhanced_vector_storage.sql:120-170)
    *   **Issue:** Vector similarity part uses `ILIKE` match on `name` to find a single embedding, not valid semantic search.
    *   **Impact:** "Vector" component of `material_hybrid_search` RPC will be ineffective.
    *   **Action:** Redesign `search_materials_by_text` and `material_hybrid_search`. Convert `query_text` to `query_embedding` in application layer and pass to SQL for `pgvector` comparison.
    *   **Priority:** Critical

4.  **Placeholder Vector Indexing & Mongoose Misalignment in `searchIndex.model.ts`:**
    *   **File:** [`packages/server/src/models/searchIndex.model.ts`](packages/server/src/models/searchIndex.model.ts:544) (function `buildVectorIndex`).
    *   **Issue:**
        1.  The `buildVectorIndex` function is a placeholder and does not implement any logic for generating or storing vector embeddings ([CONFIRMED](packages/server/src/models/searchIndex.model.ts:544-575)).
        2.  This entire model uses Mongoose, implying it manages indexes in MongoDB. This contradicts the likely project direction towards Supabase/PostgreSQL and pgvector for vector search. Managing pgvector indexes is done via SQL DDL (typically in migrations), not an application-layer model like this.
    *   **Impact:**
        *   Vector search capabilities intended to be managed by this model are non-functional.
        *   Architectural conflict if Supabase/pgvector is the target vector store, as this model is for MongoDB.
    *   **Action:**
        1.  **Clarify Database Strategy (see Critical Issue #2):** If Supabase/PostgreSQL is the primary data and vector store:
            *   This Mongoose-based `searchIndex.model.ts` is largely misaligned for vector index management. pgvector indexes are schema-level constructs.
            *   The concept of a "search index document" might still be useful for *configuring* or *describing* available indexes (text, vector, metadata) that exist in Supabase, but the building/management of pgvector indexes themselves would not happen here.
            *   If this model is to be retained for managing metadata about Supabase indexes, `buildVectorIndex` should be removed or re-purposed (e.g., to trigger an RPC that might populate a pgvector table if data isn't directly in an indexed column).
        2.  If MongoDB Atlas Search is intended for vector search (less likely given other evidence), then `buildVectorIndex` needs full implementation for Atlas Search.
    *   **Priority:** Critical (Linked to architectural decision in #2)

5.  **Overly Permissive RLS Policies for Message Broker Tables:**
    *   **File:** [`packages/server/src/services/supabase/migrations/005_message_broker.sql`](packages/server/src/services/supabase/migrations/005_message_broker.sql:82-131)
    *   **Issue:** RLS policies grant general `authenticated` users excessive CRUD permissions.
    *   **Impact:** Significant security risk to message broker data.
    *   **Action:** Redefine RLS policies for `message_broker_messages`, `message_broker_broadcasts`, `message_broker_metrics`, and `message_broker_status` to restrict access to appropriate service roles or specific users based on defined logic.
    *   **Priority:** Critical

6.  **Placeholder Implementations in Python RAG System (`hybrid_retriever.py`):**
    *   **File:** [`packages/ml/python/hybrid_retriever.py`](packages/ml/python/hybrid_retriever.py)
    *   **Issue:** Critical components are placeholders (LLM calls, vector client init, sparse embedding, metadata search).
    *   **Impact:** Core RAG functionality is missing or non-functional.
    *   **Action:** Implement placeholder methods: integrate real LLM client, connect to vector DB, use actual sparse embedding generation, implement metadata search.
    *   **Priority:** Critical

7.  **Partially Addressed: In-Memory Storage in `ModelRegistry` / Missing Evaluation Cycle Logic & `ModelRouter` Dependency:**
    *   **Files:** [`packages/server/src/services/ai/modelRegistry.ts`](packages/server/src/services/ai/modelRegistry.ts:1), [`packages/server/src/services/ai/modelRouter.ts`](packages/server/src/services/ai/modelRouter.ts:1)
    *   **Original Issue:** `performanceMetrics`, `taskCounters`, `modelComparisons`, `ModelRegistryConfig` in `ModelRegistry` were in-memory.
    *   **Current Status & New Issues:**
        *   `ModelRegistryConfig` is now loaded from/seeded to `model_registry_config` table.
        *   Performance metrics (`ModelEvaluationResult`) are fetched from `model_performance_metrics`.
        *   Model comparisons (`ModelComparisonReport`) are fetched from `model_comparison_reports`.
        *   **Missing in `ModelRegistry`:** The core logic for the rotation-based evaluation system, including `TaskCounter` management and methods like `recordPerformance`, `incrementTaskCount`, `shouldRunEvaluation`, `getAllModels` (for evaluation), `storeModelComparison`. `TaskCounter` data needs persistence.
        *   **`ModelRouter` Dependency:** `ModelRouter` heavily relies on these missing/incomplete `ModelRegistry` methods (e.g., `shouldRunEvaluation` on [`modelRouter.ts:109`](packages/server/src/services/ai/modelRouter.ts:109), `getAllModels` on [`modelRouter.ts:146`](packages/server/src/services/ai/modelRouter.ts:146), `storeModelComparison` on [`modelRouter.ts:195`](packages/server/src/services/ai/modelRouter.ts:195), `recordPerformance` on [`modelRouter.ts:283`](packages/server/src/services/ai/modelRouter.ts:283)).
    *   **Impact:** The model evaluation and routing system is non-functional or incomplete due to these missing pieces in `ModelRegistry`.
    *   **Action:**
        1.  Verify/create DB schema and migrations for `model_registry_config`, `model_performance_metrics`, and `model_comparison_reports` tables.
        2.  **In `ModelRegistry`:**
            *   Define DB schema and create migration for `task_counters` table.
            *   Implement the missing service methods (`recordPerformance`, `incrementTaskCount`, `shouldRunEvaluation`, `storeModelComparison`, `getAllModels` for evaluation) to use their respective database tables.
    *   **Priority:** Critical (Core functionality for model evaluation, A/B testing, and intelligent routing depends on this)

8.  **Untrained Projection Layers in Embedding Generation:**
    *   **Files:** [`packages/ml/python/embedding_generator.py`](packages/ml/python/embedding_generator.py:1), [`packages/ml/python/enhanced_text_embeddings.py`](packages/ml/python/enhanced_text_embeddings.py:1)
    *   **Issue:** Added projection layers for dimensionality adjustment are not trained; truncation/padding distorts embeddings.
    *   **Impact:** Very low-quality embeddings, undermining similarity search.
    *   **Action:** For image and text embeddings, either fine-tune projection layers or use base models with native output dimensions matching requirements. Address PCA fitting for `FeatureBasedEmbedding`. Re-evaluate `HybridEmbedding` concatenation.
    *   **Priority:** Critical

9.  **Disconnected General Material Recognition Logic:**
    *   **File:** [`packages/server/src/services/recognition/material-recognizer-service.ts`](packages/server/src/services/recognition/material-recognizer-service.ts:256-329)
    *   **Issue:** Uses simplified direct feature extraction, not the sophisticated Python pipeline.
    *   **Impact:** Basic, poorly performing general material recognition.
    *   **Action:** Refactor to invoke `material_recognizer.py` script for feature extraction and ML model inference.
    *   **Priority:** Critical

10. **Simulated/Incomplete Logic in `ExternalLibraryManager` Components:**
    *   **File:** [`packages/server/src/services/recognition/external-library-integration.ts`](packages/server/src/services/recognition/external-library-integration.ts:1)
    *   **Issue:** JS fallbacks for OpenCV LBP/GLCM; `isolatePattern` simulates mask; `extractWaveletFeatures` is placeholder; `PyTorchIntegration` missing.
    *   **Impact:** Inefficient or non-functional image processing steps.
    *   **Action:** Implement native OpenCV calls if available; implement actual mask application and wavelet extraction; implement or clarify need for `PyTorchIntegration`.
    *   **Priority:** Critical

11. **Non-Functional UI Theming in `HeroUIProvider.tsx`:**
    *   **File:** [`packages/client/src/providers/HeroUIProvider.tsx`](packages/client/src/providers/HeroUIProvider.tsx:28-30)
    *   **Issue:** Uses placeholder `<div>` instead of actual HeroUI `ThemeProvider`.
    *   **Impact:** HeroUI components likely not themed correctly.
    *   **Action:** Implement with actual `ThemeProvider` from `@heroui/react`, ensure theme compatibility.
    *   **Priority:** Critical

12. **Missing API Call Implementation in `OfflineProvider.executeQueuedActions`:**
    *   **File:** [`packages/client/src/providers/OfflineProvider.tsx`](packages/client/src/providers/OfflineProvider.tsx:352-354)
    *   **Issue:** Offline action execution is a placeholder.
    *   **Impact:** Offline actions queued but never synced.
    *   **Action:** Implement API calls for each `OfflineActionType` using appropriate client services.
    *   **Priority:** Critical

13. **OfflineProvider: Missing True Resource Caching:**
    *   **File:** [`packages/client/src/providers/OfflineProvider.tsx`](packages/client/src/providers/OfflineProvider.tsx:416-418)
    *   **Issue:** No actual binary resource caching (images, etc.) using Cache API / IndexedDB.
    *   **Impact:** App cannot display fetched resources offline.
    *   **Action:** Implement resource caching using Cache API in `cacheMaterial`, `isResourceCached`, `getResourceFromCache`. Consider Service Worker.
    *   **Priority:** Critical

14. **`MaterialsPage.tsx` Uses Mock Data and Client-Side Filtering:**
    *   **File:** [`packages/client/src/pages/materials.tsx`](packages/client/src/pages/materials.tsx:1)
    *   **Issue:** Uses mock data, client-side filtering, no `SearchFilterProvider`.
    *   **Impact:** Page doesn't display real data, performs poorly with large datasets.
    *   **Action:** Remove mock data, integrate `SearchFilterProvider`, implement API data fetching with server-side filtering/pagination.
    *   **Priority:** Critical

15. **Mocked AI Detection in `ImageUploader.tsx`:**
    *   **File:** [`packages/client/src/components/ImageUploader.tsx`](packages/client/src/components/ImageUploader.tsx:160-292)
    *   **Issue:** `detectMaterials` function is entirely mocked.
    *   **Impact:** AI detection feature non-functional.
    *   **Action:** Replace mock with actual API calls to backend recognition endpoint.
    *   **Priority:** Critical

16. **Missing MoodBoard Database Schema:**
    *   **Files:** New migration file needed.
    *   **Issue:** DB tables for MoodBoards (`moodboards`, `moodboard_items`, `moodboard_collaborators`) not defined.
    *   **Impact:** MoodBoard feature non-functional.
    *   **Action:** Create SQL migration for these tables with RLS policies.
    *   **Priority:** Critical

17. **Missing/Misused Shared `apiClient.ts` for Client-Side API Calls:**
    *   **Files:** [`packages/client/src/services/materialService.ts`](packages/client/src/services/materialService.ts:10), [`packages/client/src/services/recognitionService.ts`](packages/client/src/services/recognitionService.ts:9), [`packages/shared/src/services/api/apiClient.ts`](packages/shared/src/services/api/apiClient.ts:1)
    *   **Issue:** Client services not consistently using shared `apiClient`; some use incorrect local imports or own Axios instances.
    *   **Impact:** Inconsistent API calls, runtime errors, bypass of shared features (auth, cache, config).
    *   **Action:** Correct imports to use `@kai/shared/services/api/apiClient`. Remove redundant Axios instances. Verify `apiClient` config.
    *   **Priority:** Critical

18. **Missing OpenTelemetry SDK Initialization in `tracingInitializer.ts`:**
    *   **File:** [`packages/shared/src/services/tracing/tracingInitializer.ts`](packages/shared/src/services/tracing/tracingInitializer.ts:1)
    *   **Issue:** Only instantiates `OpenTelemetryProvider` (API wrapper), does not set up the OpenTelemetry SDK (processors, exporters).
    *   **Impact:** No trace data will be exported; tracing system non-functional.
    *   **Action:** `initializeOpenTelemetryTracing` must include full OTel SDK setup (`NodeSDK` or `WebTracerProvider`, resource, span processors, exporters configured via `UnifiedConfig`).
    *   **Priority:** Critical

19. **Mocked Embedding Generation in `QueryUnderstandingService`:**
    *   **File:** [`packages/server/src/services/search/query-understanding-service.ts`](packages/server/src/services/search/query-understanding-service.ts:306)
    *   **Issue:** `generateQueryEmbedding` uses a mock implementation.
    *   **Impact:** Core semantic understanding capability is non-functional. Query expansion and semantic search will be based on random vectors.
    *   **Action:** Replace mock embedding generation with calls to a real embedding service (e.g., via `ModelRouter` or direct API call).
    *   **Priority:** Critical

20. **Missing JWT Secret Handling in `sessionManager.service.ts`:**
    *   **File:** [`packages/server/src/services/auth/sessionManager.service.ts`](packages/server/src/services/auth/sessionManager.service.ts:96)
    *   **Issue:** Service used a default hardcoded JWT secret (`'default-secret'`) if `process.env.JWT_SECRET` was not set. This is a major security risk.
    *   **Impact:** Predictable JWTs if the environment variable is not set, allowing unauthorized access.
    *   **Action:** Removed the default fallback. The service now throws an error if `JWT_SECRET` is not defined. Ensure `JWT_SECRET` is properly configured in all environments and managed by `UnifiedConfig`.
    *   **Priority:** Critical

21. **TypeScript Compilation Errors in Auth Services:**
    *   **Files:** [`packages/server/src/services/auth/sessionManager.service.ts`](packages/server/src/services/auth/sessionManager.service.ts:1), [`packages/server/src/services/auth/twoFactor.service.ts`](packages/server/src/services/auth/twoFactor.service.ts:1)
    *   **Issue:** Multiple TypeScript errors due to missing dependencies and type issues:
        *   `sessionManager.service.ts`: Cannot find module 'jsonwebtoken' or its corresponding type declarations ([`sessionManager.service.ts:9`](packages/server/src/services/auth/sessionManager.service.ts:9)). (Note: `jsonwebtoken` is in `packages/server/package.json` but may not be installed/linked correctly in the workspace due to environment issues).
        *   `sessionManager.service.ts`: Cannot find module 'ua-parser-js' or its corresponding type declarations ([`sessionManager.service.ts:24`](packages/server/src/services/auth/sessionManager.service.ts:24)).
        *   `sessionManager.service.ts`: Cannot find module 'geoip-lite' or its corresponding type declarations ([`sessionManager.service.ts:25`](packages/server/src/services/auth/sessionManager.service.ts:25)).
        *   `sessionManager.service.ts`: Could not find a declaration file for module '../supabase/supabaseClient' ([`sessionManager.service.ts:23`](packages/server/src/services/auth/sessionManager.service.ts:23)).
        *   `sessionManager.service.ts`: Object literal may only specify known properties, and 'token' does not exist in type 'Partial<Omit<UserSession, "id" | "createdAt" | "userId" | "token">>'. ([`sessionManager.service.ts:223`](packages/server/src/services/auth/sessionManager.service.ts:223)) (This relates to a design inconsistency with `userSession.model.ts`). (Note: `userAgent` type issue was fixed).
        *   `twoFactor.service.ts`: Cannot find module 'speakeasy' or its corresponding type declarations ([`twoFactor.service.ts:8`](packages/server/src/services/auth/twoFactor.service.ts:8)).
        *   `twoFactor.service.ts`: Cannot find module 'qrcode' or its corresponding type declarations ([`twoFactor.service.ts:9`](packages/server/src/services/auth/twoFactor.service.ts:9)).
    *   **Impact:** Prevents successful compilation of the `packages/server` module. Core auth functionality is broken or incomplete.
    *   **Action:**
        *   **Crucial:** Resolve Node.js/Yarn environment issues preventing `npm` or `yarn` from running, so dependencies can be installed/managed.
        *   Ensure `jsonwebtoken` is correctly installed/linked in the `packages/server` workspace.
        *   Install missing dependencies for `sessionManager.service.ts`: `ua-parser-js`, `geoip-lite` and their type declarations (`@types/ua-parser-js`, `@types/geoip-lite`).
        *   Install missing dependencies for `twoFactor.service.ts`: `speakeasy`, `qrcode` and their type declarations (`@types/speakeasy`, `@types/qrcode`).
        *   Create or find type declarations for `supabaseClient` (imported in `sessionManager.service.ts`).
        *   Address the `token` property update issue in `sessionManager.service.ts`'s `updateSession` call by clarifying the intended logic and potentially adjusting `userSession.model.ts`'s `updateSession` signature or the service's approach.
    *   **Priority:** Critical

22. **Circular Dependency in `supabaseClient.js` on Server:**
    *   **File:** [`packages/server/src/services/supabase/supabaseClient.js`](packages/server/src/services/supabase/supabaseClient.js:7)
    *   **Issue:** The file `packages/server/src/services/supabase/supabaseClient.js` attempts to re-export `supabaseClient` from itself (`export { supabaseClient } from './supabaseClient';`), creating a circular dependency.
    *   **Impact:** This will cause a runtime error when any module attempts to import `supabaseClient` from this file, effectively breaking all Supabase interactions for the server.
    *   **Action:**
        1.  Determine the correct source for the server-side Supabase client. It's likely intended to be the shared client from [`packages/shared/src/services/supabase/supabaseClient.ts`](packages/shared/src/services/supabase/supabaseClient.ts:1).
        2.  Rename [`packages/server/src/services/supabase/supabaseClient.js`](packages/server/src/services/supabase/supabaseClient.js:1) to `supabaseClient.ts`.
        3.  Modify the renamed file to correctly re-export the client from the shared package (e.g., `export { supabaseClient } from '@kai/shared/services/supabase/supabaseClient';`). Adjust path if necessary based on tsconfig paths or relative paths.
        4.  Ensure all server-side imports point to this corrected server-level `supabaseClient.ts` or directly to the shared client if appropriate.
    *   **Priority:** Critical

23. **TypeScript Module Resolution Issues Between Packages:**
    *   **Files:**
        *   [`packages/server/src/services/supabase/supabaseClient.ts`](packages/server/src/services/supabase/supabaseClient.ts:7) (importing from `../../../shared/src/services/supabase/supabaseClient`)
        *   [`packages/server/src/services/supabase/hybrid-search.ts`](packages/server/src/services/supabase/hybrid-search.ts:9) (importing from `../../../shared/src/utils/supabaseErrorHandler`)
        *   Other files in `packages/server` attempting to import from `packages/shared` using relative paths or aliases.
    *   **Issue:** TypeScript is unable to resolve modules imported from the `packages/shared` directory into `packages/server`, whether using relative paths or (previously attempted) workspace aliases like `@kai/shared`. This results in "Cannot find module ... or its corresponding type declarations" errors.
    *   **Impact:** Prevents successful compilation of `packages/server`. Indicates a fundamental problem with the TypeScript project setup (e.g., `tsconfig.json` `paths`, `baseUrl`, `references`) or the monorepo's workspace linking for TypeScript.
    *   **Action:**
        1.  **Review `tsconfig.json` files:** Examine the `tsconfig.json` in `packages/server`, `packages/shared`, and any root/base `tsconfig.json`.
        2.  Ensure `paths` aliases (like `@kai/shared/*`) are correctly defined and used, or that project references are properly configured for inter-package dependencies.
        3.  Verify that the build process for `packages/shared` produces the necessary declaration files (`.d.ts`) in its output directory and that `packages/server`'s tsconfig can locate them.
        4.  If not using path aliases, ensure relative paths are accurate and robust. However, aliases or project references are generally preferred in monorepos.
        5.  This issue might also be linked to the overall Node.js/Yarn environment problems that prevent dependency installation, as a corrupted `node_modules` or linking issue could manifest this way.
    *   **Priority:** Critical

24. **Flawed Type Safety Approach in `SupabaseHelper`:**
    *   **File:** [`packages/server/src/services/supabase/supabaseHelper.ts`](packages/server/src/services/supabase/supabaseHelper.ts:1)
    *   **Issue:** The `SupabaseHelper` attempts to provide type safety by casting Supabase client query builder chains to `unknown as SupabaseFilterBuilder<T>` ([e.g., line 109](packages/server/src/services/supabase/supabaseHelper.ts:109)), where `SupabaseFilterBuilder` is a custom-defined interface mimicking the Supabase client's builder. This is an anti-pattern that bypasses the actual Supabase client's type system and introduces a fragile, manually maintained interface.
    *   **Impact:** Significant risk of runtime errors if the custom interface doesn't perfectly match the Supabase client or if Supabase client APIs change. It offers a false sense of type safety and makes the code harder to maintain and debug.
    *   **Action:**
        1.  **Strongly recommend refactoring or removing `SupabaseHelper`**.
        2.  Services should use the Supabase JS client directly.
        3.  Achieve true type safety by generating TypeScript types from the Supabase schema (e.g., using `supabase gen types typescript --project-id <your-project-id> > src/types/supabase.ts`) and using these generated types with the Supabase client. This provides accurate types for tables, columns, and RPCs.
    *   **Priority:** Critical

26. **Local Filesystem Reliance in `VisualReferenceTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/visual-reference-training.ts`](packages/server/src/services/ai/visual-reference-training.ts:1)
    *   **Issue:** The service uses the local filesystem extensively for:
        *   Creating dataset directories (`data/training/<datasetId>`) ([line 52](packages/server/src/services/ai/visual-reference-training.ts:52)).
        *   Storing downloaded images within these local dataset directories ([line 79](packages/server/src/services/ai/visual-reference-training.ts:79)).
        *   Writing dataset `metadata.json` locally ([line 66](packages/server/src/services/ai/visual-reference-training.ts:66)).
        *   Reading dataset `metadata.json` locally for training ([line 111](packages/server/src/services/ai/visual-reference-training.ts:111)).
        *   Creating local model directories (`data/models/<modelId>`) ([line 124](packages/server/src/services/ai/visual-reference-training.ts:124)).
        *   Writing (simulated) model artifacts (`model.json`, `metrics.json`) to these local model directories ([line 282](packages/server/src/services/ai/visual-reference-training.ts:282)).
    *   **Impact:** This makes the service unsuitable for typical server deployments (stateless, scalable, containerized) as local filesystem paths are not persistent or shared. It will lead to data loss and inability to find datasets/models across restarts or instances.
    *   **Action:**
        1.  Refactor all dataset and model artifact storage to use a shared object storage solution (e.g., Supabase Storage, AWS S3).
        2.  Dataset creation should download images to this object storage, organized by dataset ID and class.
        3.  Dataset metadata should also be stored in object storage or a dedicated database table.
        4.  Model training (when implemented) should read datasets from object storage and save trained model artifacts back to object storage. The `storage_path` field in `ml_models` table already suggests this intent.
    *   **Priority:** Critical

28. **Local Filesystem Reliance in `PropertyPredictionService`:**
    *   **File:** [`packages/server/src/services/ai/property-prediction/propertyPredictionService.ts`](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:1)
    *   **Issue:** The service saves and loads TensorFlow.js models and their metadata to/from the local filesystem path `data/models/<modelId>` (e.g., `model.save('file://...')` on [line 101](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:101), `tf.loadLayersModel('file://...')` on [line 158](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:158)).
    *   **Impact:** Unsuitable for server environments due to issues with statelessness, scalability, and shared access. Model data will be lost or inaccessible.
    *   **Action:** Refactor model saving/loading to use a shared object storage solution (e.g., Supabase Storage). This involves serializing TF.js models to memory buffers (as recommended for Critical Issue #25 regarding `PromptMLService`) and storing/retrieving these buffers from object storage. The `storage_path` in `ml_models` table (used by `registerModel` method) already implies this intent.
    *   **Priority:** Critical (Similar to #25 and #26)

27. **Simulated Model Training in `VisualReferenceTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/visual-reference-training.ts`](packages/server/src/services/ai/visual-reference-training.ts:102) (method `trainModel`)
    *   **Issue:** The `trainModel` method currently only simulates training by calling `this.simulateTraining` ([line 155](packages/server/src/services/ai/visual-reference-training.ts:155)), which writes dummy files after a timeout. No actual ML model training is performed.
    *   **Impact:** The core purpose of training models from visual references is non-functional.
    *   **Action:** Implement actual model training logic. This will likely involve:
        *   Preparing data loaders that read from the (refactored) object storage dataset location.
        *   Integrating with an ML framework (e.g., TensorFlow.js, or calling Python scripts that use TensorFlow/PyTorch) to define and train image classification/detection models.
        *   Saving the actual trained model artifacts to object storage.
    *   **Priority:** Critical

29. **Placeholder ML Pipeline in `RelationshipAwareTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:1)
    *   **Issue:** The core machine learning functionalities (model creation, training, evaluation, feature importance) are implemented as placeholders (e.g., `createModel` on [line 1407](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:1407) returns a dummy object, `trainModel` on [line 1464](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:1464) simulates a delay, `evaluateModel` on [line 1029](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:1029) returns hardcoded values, `calculateFeatureImportance` on [line 1500](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:1500) returns random values).
    *   **Impact:** The service cannot actually train or use relationship-aware models for property prediction. Its primary purpose is non-functional.
    *   **Action:** Implement the actual ML model training, evaluation, and feature importance logic using TensorFlow.js or another suitable ML framework. This includes defining appropriate model architectures and training procedures.
    *   **Priority:** Critical

30. **Local Filesystem Usage in `RelationshipAwareTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:1)
    *   **Issue:** The service saves/loads model artifacts and metadata to/from the local filesystem path `data/models/<modelId>` (e.g., `model.save('file://...')` on [line 940](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:940) - though this save is on a dummy model object, the intent for local file saving is clear).
    *   **Impact:** Unsuitable for server environments.
    *   **Action:** Refactor all model artifact and metadata storage to use a shared object storage solution (similar to Critical Issues #26, #28).
    *   **Priority:** Critical

31. **Programmatic Table Creation in `RelationshipAwareTrainingService.ensureTables`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:110)
    *   **Issue:** The `ensureTables` method uses `supabase.getClient().rpc('execute_sql', ...)` to programmatically create `relationship_aware_training_jobs`, `relationship_aware_models`, and `relationship_aware_model_performance` tables if they don't exist.
    *   **Impact:** Managing database schema via application code is an anti-pattern. It bypasses proper migration processes, can lead to inconsistencies between environments, and makes schema versioning difficult.
    *   **Action:** Remove the `ensureTables` method. Define these table schemas in proper Supabase SQL migration files.
    *   **Priority:** Critical

25. **Filesystem Usage for TensorFlow.js Model Serialization in `PromptMLService`:**
    *   **File:** [`packages/server/src/services/ai/promptMLService.ts`](packages/server/src/services/ai/promptMLService.ts:1265) (methods `serializeModel`, `loadModel`)
    *   **Issue:** The `serializeModel` method saves TensorFlow.js models to a local temporary path (`file://./tmp/model`) before reading the files into a buffer. `loadModel` reverses this by writing to the temporary path before loading. This use of a relative local filesystem path is problematic for server environments, especially if stateless, scaled horizontally, or running in containers without persistent/shared `/tmp` access.
    *   **Impact:** Model saving/loading will likely fail or behave inconsistently in typical server deployments. Data corruption or errors if multiple instances try to access `./tmp/model` simultaneously.
    *   **Action:**
        1.  Refactor `serializeModel` to use `tf.io.withSaveHandler` with a custom `tf.io.IOHandler` that writes model artifacts (model.json, weights.bin) directly to memory buffers. These buffers can then be combined (e.g., into a single JSON or a tarball buffer) and stored in the database (`prompt_ml_model_versions.model_data`).
        2.  Refactor `loadModel` to read these buffers from the database and use `tf.loadLayersModel` with a custom `tf.io.IOHandler` that reads from these memory buffers.
        3.  This avoids direct filesystem dependency for model persistence.
    *   **Priority:** Critical

## II. High Priority Issues

1.  **Hardcoded Admin Email in `SupabaseAuthProvider`:**
    *   **File:** [`packages/shared/src/services/auth/supabaseAuthProvider.ts`](packages/shared/src/services/auth/supabaseAuthProvider.ts:387-389)
    *   **Action:** Remove; rely on roles/permissions from `app_metadata`.
    *   **Priority:** High

2.  **Vector Column Name Discrepancy & SQL Function Choice for Hybrid Search:**
    *   **Files:** [`packages/server/src/services/supabase/migrations/002_hybrid_search.sql`](packages/server/src/services/supabase/migrations/002_hybrid_search.sql:149) vs. [`006_enhanced_vector_storage.sql`](packages/server/src/services/supabase/migrations/006_enhanced_vector_storage.sql).
    *   **Action:** Clarify definitive schema. Ensure consistent use. Deprecate/update older functions.
    *   **Priority:** High

3.  **Ineffective `tokenRefreshMiddleware` for Supabase:**
    *   **File:** [`packages/server/src/middleware/auth.middleware.ts`](packages/server/src/middleware/auth.middleware.ts:409-474)
    *   **Action:** Re-evaluate or remove.
    *   **Priority:** High

4.  **FTS Similarity Calculation in Python Clients & SQL:**
    *   **Files:** [`packages/ml/python/knowledge_client.py`](packages/ml/python/knowledge_client.py:227), [`packages/ml/python/vector_search.py`](packages/ml/python/vector_search.py:224)
    *   **Action:** Use `ts_rank_cd` or similar FTS ranking functions.
    *   **Priority:** High

5.  **Default Message Broker Implementation in `QueueAdapter`:**
    *   **File:** [`packages/server/src/services/messaging/queueAdapter.ts`](packages/server/src/services/messaging/queueAdapter.ts:14-16)
    *   **Action:** Default critical queues to persistent broker implementation.
    *   **Priority:** High

6.  **Missing Provider Implementations in `ModelRouter`:**
    *   **File:** [`packages/server/src/services/ai/modelRouter.ts`](packages/server/src/services/ai/modelRouter.ts:1)
    *   **Action:** Implement SDK integrations for OpenAI, Anthropic, local models.
    *   **Priority:** High

7.  **`copyObject` Implementation in `SupabaseStorageProvider`:**
    *   **File:** [`packages/shared/src/services/storage/supabaseStorageProvider.ts`](packages/shared/src/services/storage/supabaseStorageProvider.ts:436-459)
    *   **Action:** Use Supabase Storage's direct server-side `copy()` method.
    *   **Priority:** High

8.  **Timestamp Handling in `UserProvider.convertAuthUser`:**
    *   **File:** [`packages/client/src/providers/UserProvider.tsx`](packages/client/src/providers/UserProvider.tsx:92-93)
    *   **Action:** Use actual timestamps from Supabase user object.
    *   **Priority:** High

9.  **Local State Update in `UserProvider.updateProfile`:**
    *   **File:** [`packages/client/src/providers/UserProvider.tsx`](packages/client/src/providers/UserProvider.tsx:242-248)
    *   **Action:** Use updated user object returned from `auth.updateUser()` to set local state.
    *   **Priority:** High

10. **User Preferences Not Synced in `UserProvider`:**
    *   **File:** [`packages/client/src/providers/UserProvider.tsx`](packages/client/src/providers/UserProvider.tsx:277)
    *   **Action:** Implement backend storage for preferences and sync.
    *   **Priority:** High

11. **Favorites Not Synced in `FavoritesProvider`:**
    *   **File:** [`packages/client/src/providers/FavoritesProvider.tsx`](packages/client/src/providers/FavoritesProvider.tsx:1)
    *   **Action:** Implement backend API and storage for favorites.
    *   **Priority:** High

12. **Saved Searches & Filter Options Not Synced in `SearchFilterProvider`:**
    *   **File:** [`packages/client/src/providers/SearchFilterProvider.tsx`](packages/client/src/providers/SearchFilterProvider.tsx:1)
    *   **Action:** Implement backend for saved searches; fetch dynamic filter options/facets from backend.
    *   **Priority:** High

13. **No Actual File Upload in `ImageUploader.tsx`:**
    *   **File:** [`packages/client/src/components/ImageUploader.tsx`](packages/client/src/components/ImageUploader.tsx:1)
    *   **Action:** Clarify responsibility. If uploading, implement API call. If delegating, rename or document.
    *   **Priority:** High

14. **Flawed `/api/materials/similar/:id` Endpoint:**
    *   **File:** [`packages/server/src/routes/material.routes.ts`](packages/server/src/routes/material.routes.ts:289-339)
    *   **Action:** Refactor to use `EnhancedVectorServiceImpl` and performant pgvector RPCs.
    *   **Priority:** High

15. **Non-functional Material Recognition Endpoint (`/api/materials/recognition`):**
    *   **File:** [`packages/server/src/routes/material.routes.ts`](packages/server/src/routes/material.routes.ts:1)
    *   **Action:** Remove direct import. Use `MaterialRecognizerService` to orchestrate calls to Python scripts.
    *   **Priority:** High

16. **Configuration and Backend Dependencies for 3D Visualization (`MaterialVisualizer.tsx`):**
    *   **Files:** [`packages/client/src/components/MaterialVisualizer.tsx`](packages/client/src/components/MaterialVisualizer.tsx:35-51), `MaterialVisualizationProvider`
    *   **Action:** Move endpoints to `UnifiedConfig`; ensure backend services are implemented/deployed.
    *   **Priority:** High

17. **Auth Provider Initialization for Shared `AuthService`:**
    *   **Files:** [`packages/shared/src/services/auth/authService.ts`](packages/shared/src/services/auth/authService.ts:1), client app init.
    *   **Action:** Ensure `auth.setProvider(new SupabaseAuthProvider(...))` called at app startup.
    *   **Priority:** High

18. **Supabase Token Refresh Logic in `SupabaseAuthProvider`:**
    *   **Files:** [`packages/shared/src/services/auth/supabaseAuthProvider.ts`](packages/shared/src/services/auth/supabaseAuthProvider.ts:1), [`packages/shared/src/services/auth/authService.ts`](packages/shared/src/services/auth/authService.ts:1)
    *   **Action:** Review `SupabaseAuthProvider.refreshToken()` to ensure it uses Supabase SDK's refresh and returns `AuthResult` correctly. Verify `getToken()` and session details from `login/register`.
    *   **Priority:** High

19. **Dependency on `materialRecognitionProvider` in `RecognitionDemo.tsx`:**
    *   **File:** [`packages/client/src/components/RecognitionDemo.tsx`](packages/client/src/components/RecognitionDemo.tsx:1)
    *   **Action:** Review `materialRecognitionProvider` implementation and its API calls.
    *   **Priority:** High

20. **API Client Inconsistency & Hardcoded URL in `recognitionService.ts`:**
    *   **File:** [`packages/client/src/services/recognitionService.ts`](packages/client/src/services/recognitionService.ts:9)
    *   **Action:** Refactor to use shared `apiClient`. (Related to Critical #17)
    *   **Priority:** High

21. **Backend Endpoints for `recognitionService.ts`:**
    *   **File:** [`packages/client/src/services/recognitionService.ts`](packages/client/src/services/recognitionService.ts:1)
    *   **Action:** Verify/update/deprecate these backend routes and ensure client service aligns.
    *   **Priority:** High

22. **Cache Service Initialization:**
    *   **Files:** [`packages/shared/src/services/cache/cacheInitializer.ts`](packages/shared/src/services/cache/cacheInitializer.ts:1), [`packages/shared/src/services/api/apiClient.ts`](packages/shared/src/services/api/apiClient.ts:1)
    *   **Action:** Ensure `initializeCache()` called at app startup; verify `UnifiedConfig` for cache provider settings.
    *   **Priority:** High

23. **`UnifiedConfig.init()` Call Timing:**
    *   **Files:** `UnifiedConfig.ts`, various service initializers and consumers.
    *   **Action:** Ensure `config.init()` is called at the absolute beginning of startup sequences.
    *   **Priority:** High

24. **Bug in `TelemetryService.flush()` Error Handling (Re-buffering):**
    *   **File:** [`packages/shared/src/services/telemetry/telemetryService.ts`](packages/shared/src/services/telemetry/telemetryService.ts:546)
    *   **Action:** Correct to `this.buffer = [...events, ...this.buffer];`.
    *   **Priority:** High

25. **Missing or Misconfigured Shared Storage Service Abstraction:**
    *   **Files:** Missing [`packages/shared/src/services/storage/index.ts`](packages/shared/src/services/storage/index.ts:1) and `storageService.ts`. [`packages/shared/src/services/recognition/materialProvider.ts`](packages/shared/src/services/recognition/materialProvider.ts:2) hardcodes S3 adapter.
    *   **Action:** Create `storageService.ts` (renaming `s3StorageAdapter.ts`) with `StorageService` class using a `StorageProvider`. Create `storageInitializer.ts` to configure it via `UnifiedConfig`. Update consumers. Define `StorageProvider` interface in `storage/types.ts`.
    *   **Priority:** High

26. **Dependency on External `ML_SERVICE_URL` in `MaterialRecognitionProvider`:**
    *   **File:** [`packages/shared/src/services/recognition/materialProvider.ts`](packages/shared/src/services/recognition/materialProvider.ts:1) (lines 77, 215)
    *   **Action:** Refactor to get `ML_SERVICE_URL` from `UnifiedConfig`.
    *   **Priority:** High

27. **Missing `create_conversation_table` RPC for `ConversationalSearchService`:**
    *   **File:** [`packages/server/src/services/search/conversational-search-service.ts`](packages/server/src/services/search/conversational-search-service.ts:129)
    *   **Issue:** Service attempts to create `conversation_sessions` table via an RPC that's not defined.
    *   **Impact:** Persistence for conversation sessions will fail.
    *   **Action:** Define schema for `conversation_sessions` in a Supabase migration file. Remove RPC call.
    *   **Priority:** High

28. **Redundancy of `config.ts` with `unified-config.ts`:**
    *   **File:** [`packages/shared/src/utils/config.ts`](packages/shared/src/utils/config.ts:1)
    *   **Issue:** Duplicates functionality of `unified-config.ts`.
    *   **Action:** Deprecate and delete `config.ts`. Refactor consumers to use `unified-config.ts`.
    *   **Priority:** High

29. **Redundancy of `logger.ts` with `unified-logger.ts`:**
    *   **File:** [`packages/shared/src/utils/logger.ts`](packages/shared/src/utils/logger.ts:1)
    *   **Issue:** Duplicates functionality of `unified-logger.ts`.
    *   **Action:** Deprecate and delete `logger.ts`. Refactor consumers to use `unified-logger.ts`.
    *   **Priority:** High

30. **Logger Inconsistency in `apiKeyManager.service.ts`:**
    *   **File:** [`packages/server/src/services/auth/apiKeyManager.service.ts`](packages/server/src/services/auth/apiKeyManager.service.ts:8)
    *   **Issue:** Uses `logger` from `../../utils/logger` which might be inconsistent with the project's goal to use `unified-logger.ts`.
    *   **Impact:** Inconsistent logging practices, potential difficulty in centralized log management.
    *   **Action:** Confirm the project-wide logging strategy. If `unified-logger.ts` is standard, refactor `apiKeyManager.service.ts` to use it.
    *   **Priority:** High (was Medium, upgraded due to systematic nature)

31. **Logger Inconsistency in `sessionManager.service.ts`:**
    *   **File:** [`packages/server/src/services/auth/sessionManager.service.ts`](packages/server/src/services/auth/sessionManager.service.ts:11)
    *   **Issue:** Uses `logger` from `../../utils/logger` which might be inconsistent with the project's goal to use `unified-logger.ts`.
    *   **Impact:** Inconsistent logging practices, potential difficulty in centralized log management.
    *   **Action:** Confirm the project-wide logging strategy. If `unified-logger.ts` is standard, refactor `sessionManager.service.ts` to use it.
    *   **Priority:** High

32. **Logger Inconsistency in `twoFactor.service.ts`:**
    *   **File:** [`packages/server/src/services/auth/twoFactor.service.ts`](packages/server/src/services/auth/twoFactor.service.ts:10)
    *   **Issue:** Uses `logger` from `../../utils/logger` which might be inconsistent with the project's goal to use `unified-logger.ts`.
    *   **Impact:** Inconsistent logging practices, potential difficulty in centralized log management.
    *   **Action:** Confirm the project-wide logging strategy. If `unified-logger.ts` is standard, refactor `twoFactor.service.ts` to use it.
    *   **Priority:** High

35. **Effectiveness of `SupabaseHybridSearch` Relies on RPC Correctness:**
    *   **File:** [`packages/server/src/services/supabase/hybrid-search.ts`](packages/server/src/services/supabase/hybrid-search.ts:1)
    *   **Issue:** This service calls Supabase RPC functions `hybrid_search_materials` and `hybrid_search`. The `hybrid_search_materials` RPC is particularly concerning as it might be linked to `material_hybrid_search` and the flawed `search_materials_by_text` logic (Critical Issue #I.3), potentially rendering its vector search component ineffective if it doesn't correctly use the passed `query_embedding`.
    *   **Impact:** If the underlying RPCs are flawed (especially in their vector search component), hybrid search will not perform as expected, potentially degrading to keyword search or yielding irrelevant results.
    *   **Action:**
        1.  **Critically review the SQL definitions of `hybrid_search_materials` and `hybrid_search` RPCs.** Ensure they correctly utilize provided embeddings for semantic similarity and efficiently combine scores with text search results.
        2.  Specifically, verify that `hybrid_search_materials` does not inherit the flaws of `search_materials_by_text` if it's related.
    *   **Priority:** High (Effectiveness of a core search service depends on this; linked to Critical Issue #I.3)

36. **Verification of `find_similar_materials` RPC in `SupabaseMaterialService`:**
    *   **File:** [`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:369)
    *   **Issue:** The `findSimilarMaterials` method relies on a Supabase RPC named `find_similar_materials`. It's crucial to verify this RPC's implementation against the flawed patterns identified in `material.model.ts` (Critical Issue #I.2) to ensure it performs a correct vector similarity search.
    *   **Impact:** If this RPC is also flawed, the primary vector similarity search for materials would be compromised.
    *   **Action:** Review the SQL definition of the `find_similar_materials` RPC. Ensure it correctly uses the input `search_vector` and applies similarity calculations and thresholds effectively.
    *   **Priority:** High (Linked to Critical Issue #I.2)

33. **Potential Flaw in `EnhancedVectorServiceImpl.searchMaterials` via `material_hybrid_search` RPC:**
    *   **File:** [`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:396)
    *   **Issue:** The `searchMaterials` method, when using specialized indexes, calls the `material_hybrid_search` RPC with `query_text`. This RPC is linked to `search_materials_by_text` (Critical Issue #I.3), which has flawed logic for converting text to embeddings for semantic search.
    *   **Impact:** If the RPC is not fixed, semantic search via this path in `EnhancedVectorServiceImpl` will be ineffective, relying on keyword matching instead of true semantic similarity.
    *   **Action:**
        1.  Verify if `material_hybrid_search` RPC (and its underlying SQL function `search_materials_by_text`) has been corrected to properly generate and use query embeddings.
        2.  If not fixed, `EnhancedVectorServiceImpl.searchMaterials` should ensure query embeddings are generated in the application layer (similar to its fallback path for `find_similar_materials_hybrid`) and passed to a corrected or alternative RPC that accepts embeddings.
    *   **Priority:** High (Linked to Critical Issue #I.3)

34. **Dependency on Potentially Incomplete Python Scripts in `EnhancedVectorServiceImpl`:**
    *   **File:** [`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:1) (various methods like `searchMaterialsWithKnowledge`, `routeQuery`)
    *   **Issue:** Several methods in `EnhancedVectorServiceImpl` rely on invoking Python scripts like `hybrid_retriever.py` and `context_assembler.py`. `hybrid_retriever.py` is known to have placeholder implementations (Critical Issue #I.6).
    *   **Impact:** Core functionality offered by these service methods (e.g., knowledge-augmented search, query routing) will be non-functional or unreliable until the underlying Python scripts are fully implemented.
    *   **Action:** Prioritize implementation of placeholder logic in `hybrid_retriever.py`. Review and verify the completeness and correctness of `context_assembler.py` and other Python scripts invoked by this service.
    *   **Priority:** High (Linked to Critical Issue #I.6)

38. **Architectural Concern: Embedded ML Pipeline in `PromptMLService`:**
    *   **File:** [`packages/server/src/services/ai/promptMLService.ts`](packages/server/src/services/ai/promptMLService.ts:1)
    *   **Issue:** The service includes extensive logic for training various ML models (TensorFlow.js neural nets, LSTMs, Transformers; and traditional models like Random Forest, Gradient Boosting via external libraries), including feature extraction, model definition, training loops, serialization, and prediction.
    *   **Impact:** This embeds a complex ML pipeline directly within an application service, which can lead to:
        *   High maintenance overhead.
        *   Scalability challenges for training.
        *   Difficulty in robustly managing model versions, experiments, and deployments.
        *   Potential for resource contention if training occurs on the application server.
    *   **Action:** Evaluate the long-term viability of this embedded approach. Consider:
        1.  Offloading model training to a separate, dedicated ML pipeline/infrastructure (e.g., using Python scripts managed by an MLOps tool, cloud ML platforms).
        2.  This service could then focus on fetching pre-trained models (or model metadata/endpoints) from a central model store/registry, performing feature extraction, and invoking predictions.
        3.  For traditional ML models (Random Forest, Gradient Boosting), ensure the `ml-*` libraries are suitable for production use or consider more established Python libraries if training is moved externally.
    *   **Priority:** High (Architectural)

41. **Incorrect One-Hot Encoding Placeholder in `PropertyPredictionService`:**
    *   **File:** [`packages/server/src/services/ai/property-prediction/propertyPredictionService.ts`](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:1) (methods `convertToTensors`, `convertFeaturesToTensor`)
    *   **Issue:** When converting string features to tensors, the code has a placeholder comment "One-hot encode string values" but then simply pushes `1` (e.g., [line 220](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:220), [line 264](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:264)). This is not one-hot encoding and will lead to incorrect feature representation.
    *   **Impact:** The ML model will be trained on and predict with meaningless feature data for any string-based categorical inputs, leading to poor or nonsensical predictions.
    *   **Action:** Implement proper one-hot encoding for string categorical features. This involves:
        1.  Building a vocabulary for each categorical feature from the training data.
        2.  Mapping string values to integer indices based on the vocabulary.
        3.  Converting these integer indices to one-hot encoded vectors.
        4.  Ensure the same vocabulary and encoding process is applied consistently during training and prediction.
        Alternatively, consider using embedding layers in the TensorFlow.js model for categorical features.
    *   **Priority:** High (Bug affecting core ML functionality)

42. **Supabase Client Import Path in `PropertyPredictionService`:**
    *   **File:** [`packages/server/src/services/ai/property-prediction/propertyPredictionService.ts`](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:11)
    *   **Issue:** Imports Supabase client as `import { supabase } from '../../../config/supabase';`. This path is different from other services.
    *   **Action:** Verify this import path. Align with the standard Supabase client import (`../supabase/supabaseClient` or the shared package alias) used in other services for consistency.
    *   **Priority:** High

40. **Supabase Client Import Path in `VisualReferenceTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/visual-reference-training.ts`](packages/server/src/services/ai/visual-reference-training.ts:14)
    *   **Issue:** Imports Supabase client as `import { supabase } from '../../config/supabase';`. This path (`../../config/supabase`) is different from other services which use `../supabase/supabaseClient`.
    *   **Impact:** Potential inconsistency or error if `../../config/supabase` does not correctly provide the initialized Supabase client instance in the same way as `../supabase/supabaseClient`.
    *   **Action:** Verify the `../../config/supabase` import. If it's not the standard shared client, refactor to use the same Supabase client import (`../supabase/supabaseClient` which re-exports the shared client) as other services for consistency and to benefit from the centralized client logic.
    *   **Priority:** High

39. **Implement Placeholder Rules in `PromptOptimizationService`:**
    *   **File:** [`packages/server/src/services/ai/promptOptimizationService.ts`](packages/server/src/services/ai/promptOptimizationService.ts:1)
    *   **Issue:** Several rule execution methods are placeholders:
        *   `executeSegmentSpecificRule` ([line 492](packages/server/src/services/ai/promptOptimizationService.ts:492))
        *   `executeMLSuggestionRule` ([line 502](packages/server/src/services/ai/promptOptimizationService.ts:502))
        *   `executeScheduledExperimentRule` ([line 512](packages/server/src/services/ai/promptOptimizationService.ts:512))
    *   **Impact:** Key automated optimization functionalities are missing.
    *   **Action:** Implement the logic for these rule types. This will likely involve fetching relevant data (e.g., segment performance, ML-generated suggestions, schedules) and creating appropriate `OptimizationActionData` records.
    *   **Priority:** High

43. **Incorrect Categorical Feature Encoding in `RelationshipAwareTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:1356) (method `prepareDataForTraining`)
    *   **Issue:** When preparing features for training, string values are placeholder encoded by pushing `1`. This is not a valid encoding strategy for categorical features.
    *   **Impact:** The ML model will receive meaningless input for string features, leading to poor training and prediction performance.
    *   **Action:** Implement proper encoding for string categorical features (e.g., one-hot encoding based on a vocabulary derived from training data, or using embedding layers if the model architecture supports it). This needs to be consistent between `prepareDataForTraining` and any similar feature preparation for prediction.
    *   **Priority:** High (Bug affecting core ML functionality)

44. **Supabase Client Import Path in `RelationshipAwareTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:10)
    *   **Issue:** Imports Supabase client as `import { supabase } from '../../supabase/supabaseClient';`. This path is different from the `../supabase/supabaseClient` used by most services and the `../../../config/supabase` used by `PropertyPredictionService`.
    *   **Action:** Verify all Supabase client import paths and standardize to the corrected re-export from `packages/server/src/services/supabase/supabaseClient.ts`.
    *   **Priority:** High

37. **Potential Bug in `PromptService.renderPrompt` by Name:**
    *   **File:** [`packages/server/src/services/ai/promptService.ts`](packages/server/src/services/ai/promptService.ts:582)
    *   **Issue:** The `renderPrompt` method, when attempting to fetch a prompt by `options.promptName`, throws an error stating "Getting prompt by name requires prompt type". However, the `PromptRenderOptions` interface does not include a `promptType` field, making this path unusable.
    *   **Impact:** Rendering prompts by name (if intended as a feature) will always fail.
    *   **Action:**
        1.  If rendering by name is a required feature, update `PromptRenderOptions` to include `promptType` and modify `renderPrompt` to use it when calling `getPromptByNameAndType`.
        2.  Alternatively, if fetching by name in `renderPrompt` is not intended or too ambiguous without type, remove this specific logic path.
    *   **Priority:** High (Potential bug in a core service method)

## III. Medium Priority Issues & Refinements

1.  **Unclear Rendering Logic in `MaterialVisualizer.tsx`:**
    *   **File:** [`packages/client/src/components/MaterialVisualizer.tsx`](packages/client/src/components/MaterialVisualizer.tsx:100-106)
    *   **Action:** Clarify rendering method.
    *   **Priority:** Medium

2.  **Token Cancellation Logic in Shared `apiClient.ts`:**
    *   **File:** [`packages/shared/src/services/api/apiClient.ts`](packages/shared/src/services/api/apiClient.ts:1)
    *   **Action:** If feature desired, modify `requestWithRetry` to manage cancel tokens.
    *   **Priority:** Medium

3.  **Error Propagation in `AuthService`:**
    *   **File:** [`packages/shared/src/services/auth/authService.ts`](packages/shared/src/services/auth/authService.ts:1)
    *   **Action:** Standardize to consistently throw custom `ApiError` or `AuthError`.
    *   **Priority:** Medium

4.  **Error Handling Granularity & Propagation (Server-side General):**
    *   **Files:** Various server-side services.
    *   **Action:** Refine to catch specific errors, wrap in `ApiError` with more context.
    *   **Priority:** Medium

5.  **Ownership Checks for 'manager' Role in Modifying Material Routes:**
    *   **File:** [`packages/server/src/routes/material.routes.ts`](packages/server/src/routes/material.routes.ts:1)
    *   **Action:** Clarify 'manager' permissions. If needed, add ownership checks.
    *   **Priority:** Medium

6.  **Inconsistent Service Layer Usage in `material.routes.ts`:**
    *   **File:** [`packages/server/src/routes/material.routes.ts`](packages/server/src/routes/material.routes.ts:1)
    *   **Action:** Refactor to consistently use `materialService.ts`.
    *   **Priority:** Medium

7.  **Centralized Context Providers in `Layout.tsx`:**
    *   **File:** [`packages/client/src/components/Layout.tsx`](packages/client/src/components/Layout.tsx:1)
    *   **Action:** Review and centralize global providers in `Layout.tsx` if needed.
    *   **Priority:** Medium

8.  **State Management Complexity in `ImageUploader.tsx`:**
    *   **File:** [`packages/client/src/components/ImageUploader.tsx`](packages/client/src/components/ImageUploader.tsx:1)
    *   **Action:** Consider `React.useReducer`.
    *   **Priority:** Medium

9.  **Accessibility of Interactive Elements in `ImageUploader.tsx`:**
    *   **File:** [`packages/client/src/components/ImageUploader.tsx`](packages/client/src/components/ImageUploader.tsx:1)
    *   **Action:** Thorough accessibility review.
    *   **Priority:** Medium

10. **Missing Action for "View Details" in `RecognitionDemo.tsx`:**
    *   **File:** [`packages/client/src/components/RecognitionDemo.tsx`](packages/client/src/components/RecognitionDemo.tsx:243)
    *   **Action:** Implement navigation.
    *   **Priority:** Medium

11. **Generic Error Handling in Client Services (General):**
    *   **Files:** Various client services.
    *   **Action:** Use shared `apiClient`'s `ApiError` and interceptors; propagate structured errors.
    *   **Priority:** Medium

12. **`clear()` Method with Namespace (`KEYS`) in `RedisCacheProvider`:**
    *   **File:** [`packages/shared/src/services/cache/redisCacheProvider.ts`](packages/shared/src/services/cache/redisCacheProvider.ts:180)
    *   **Action:** Avoid `KEYS`; use alternatives like Redis Sets or Lua with `SCAN`.
    *   **Priority:** Medium

13. **`clear()` Method without Namespace (`flushDb`) in `RedisCacheProvider`:**
    *   **File:** [`packages/shared/src/services/cache/redisCacheProvider.ts`](packages/shared/src/services/cache/redisCacheProvider.ts:188)
    *   **Action:** Make safer.
    *   **Priority:** Medium

14. **Connection Management & Retries in `RedisCacheProvider`:**
    *   **File:** [`packages/shared/src/services/cache/redisCacheProvider.ts`](packages/shared/src/services/cache/redisCacheProvider.ts:1)
    *   **Action:** Ensure Redis client reconnection strategy is configured; consider queue/retry.
    *   **Priority:** Medium

15. **`ADAPTIVE` Cache Warming Strategy Not Implemented:**
    *   **File:** [`packages/shared/src/services/cache/cacheWarming.ts`](packages/shared/src/services/cache/cacheWarming.ts:32)
    *   **Action:** Implement or remove from enum.
    *   **Priority:** Medium

16. **Cron Parsing and Scheduling Robustness (`cron-parser.ts`):**
    *   **File:** [`packages/shared/src/utils/cron-parser.ts`](packages/shared/src/utils/cron-parser.ts:1)
    *   **Action:** Consider robust third-party cron library.
    *   **Priority:** Medium

17. **Timezone Handling in `getNextExecutionTime` (`cron-parser.ts`):**
    *   **File:** [`packages/shared/src/utils/cron-parser.ts`](packages/shared/src/utils/cron-parser.ts:393-404)
    *   **Action:** Use mature date/time or cron library with DST support if precise handling is critical.
    *   **Priority:** Medium

18. **Tag Storage for `invalidateByTag` in `CacheInvalidationService`:**
    *   **File:** [`packages/shared/src/services/cache/cacheInvalidation.ts`](packages/shared/src/services/cache/cacheInvalidation.ts:49)
    *   **Action:** For distributed environments, store tag-to-key mappings in a shared store.
    *   **Priority:** Medium

19. **Client-Side Environment Variable Access for API URL in `UnifiedConfig`:**
    *   **File:** [`packages/shared/src/utils/unified-config.ts`](packages/shared/src/utils/unified-config.ts:320)
    *   **Action:** Ensure `loadFromEnvironment` or `createApiClient` prioritizes client-accessible env vars for `api.url`.
    *   **Priority:** Medium

20. **Incomplete `validateAllConfig` in `configValidator.ts`:**
    *   **File:** [`packages/shared/src/utils/configValidator.ts`](packages/shared/src/utils/configValidator.ts:1)
    *   **Action:** Expand to validate all critical configs from `ConfigSchema`. Call at app startup.
    *   **Priority:** Medium

21. **`API.BASE_URL` and `STORAGE.S3_BUCKET` Inconsistency in `constants.ts`:**
    *   **File:** [`packages/shared/src/utils/constants.ts`](packages/shared/src/utils/constants.ts:1)
    *   **Action:** Deprecate these constants. Use `UnifiedConfig`.
    *   **Priority:** Medium

22. **Hardcoded S3 Adapter Import in `MaterialRecognitionProvider`:**
    *   **File:** [`packages/shared/src/services/recognition/materialProvider.ts`](packages/shared/src/services/recognition/materialProvider.ts:2)
    *   **Action:** Refactor to use the generic `storageService`.
    *   **Priority:** Medium

23. **Inconsistent Error Propagation in `MaterialRecognitionProvider`:**
    *   **File:** [`packages/shared/src/services/recognition/materialProvider.ts`](packages/shared/src/services/recognition/materialProvider.ts:1)
    *   **Action:** Standardize to throw `RecognitionError` or `ServiceError` on ultimate failure.
    *   **Priority:** Medium

24. **Interface Mismatch for Download Operations in `storage/types.ts`:**
    *   **File:** [`packages/shared/src/services/storage/types.ts`](packages/shared/src/services/storage/types.ts:1)
    *   **Action:** Add download methods to `StorageProvider` interface.
    *   **Priority:** Medium

25. **Clarify `StorageRetryOptions` Usage in `storage/types.ts` and Providers:**
    *   **File:** [`packages/shared/src/services/storage/types.ts`](packages/shared/src/services/storage/types.ts:1)
    *   **Action:** Clarify if application-level retries are needed on top of SDK retries. Implement or remove from interface.
    *   **Priority:** Medium

26. **Synchronous File Write in `SupabaseStorageProvider.downloadFile`:**
    *   **File:** [`packages/shared/src/services/storage/supabaseStorageProvider.ts`](packages/shared/src/services/storage/supabaseStorageProvider.ts:303)
    *   **Action:** Change to asynchronous `fs.writeFile`.
    *   **Priority:** Medium

27. **Configuration Path for Supabase in `SupabaseManager` Constructor:**
    *   **File:** [`packages/shared/src/services/supabase/supabaseClient.ts`](packages/shared/src/services/supabase/supabaseClient.ts:52-62)
    *   **Action:** Correct to use `config.get('supabase.url')` and `config.get('supabase.key')`.
    *   **Priority:** Medium

28. **Error Handling in `PropertyInheritanceService.applyInheritance`:**
    *   **File:** [`packages/server/src/services/propertyInheritance/propertyInheritanceService.ts`](packages/server/src/services/propertyInheritance/propertyInheritanceService.ts:68)
    *   **Issue:** Silently fails by returning original material on error.
    *   **Action:** Re-throw a specific error (e.g., `PropertyInheritanceError`) wrapping the original.
    *   **Priority:** Medium

29. **Placeholder Personalization Logic in `QueryUnderstandingService`:**
    *   **File:** [`packages/server/src/services/search/query-understanding-service.ts`](packages/server/src/services/search/query-understanding-service.ts:409-455)
    *   **Issue:** Logic for using user preferences and recently viewed items is placeholder.
    *   **Action:** Implement actual personalization logic, including fetching real embeddings for items.
    *   **Priority:** Medium

30. **Missing `get_trending_queries` RPC for `QueryUnderstandingService`:**
    *   **File:** [`packages/server/src/services/search/query-understanding-service.ts`](packages/server/src/services/search/query-understanding-service.ts:551)
    *   **Issue:** Calls an undefined Supabase RPC.
    *   **Action:** Define and implement the `get_trending_queries` SQL RPC.
    *   **Priority:** Medium

31. **Basic Entity Extraction in `ConversationalSearchService`:**
    *   **File:** [`packages/server/src/services/search/conversational-search-service.ts`](packages/server/src/services/search/conversational-search-service.ts:526-561)
    *   **Issue:** Uses simple regex-based entity extraction.
    *   **Impact:** Prone to errors, limited understanding.
    *   **Action:** For robust NER, integrate with an NLP library/service.
    *   **Priority:** Medium

32. **Heuristic Query Interpretation in `ConversationalSearchService`:**
    *   **File:** [`packages/server/src/services/search/conversational-search-service.ts`](packages/server/src/services/search/conversational-search-service.ts:566-630)
    *   **Issue:** Relies on keyword indicators and term comparison for follow-up queries.
    *   **Impact:** Brittle context handling.
    *   **Action:** For robust conversation, consider advanced techniques (coreference, dialog state, LLM rewrite) or ensure MCP path is primary.
    *   **Priority:** Medium

33. **Python Script Path Resolution in `EnhancedVectorServiceImpl`:**
    *   **File:** [`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:46)
    *   **Issue:** Python script paths (e.g., for `enhanced_text_embeddings.py`) are resolved using `path.resolve(process.cwd(), 'packages/ml/python/...')`. This can be fragile if the application's current working directory (`process.cwd()`) is not the project root when the service is instantiated.
    *   **Impact:** Python script invocation might fail if `cwd` is unexpected.
    *   **Action:** Consider using a more robust path resolution method, such as resolving relative to `__dirname` of the service file, or ensuring paths are configured via `UnifiedConfig` and resolved from a known base path.
    *   **Priority:** Medium

34. **JSON String Filters in `SupabaseHybridSearch` Generic RPC:**
    *   **File:** [`packages/server/src/services/supabase/hybrid-search.ts`](packages/server/src/services/supabase/hybrid-search.ts:120)
    *   **Issue:** The generic `hybrid_search` RPC is called with a `filter_obj` that is a JSON stringified object. The SQL function must parse this JSON and dynamically apply filters.
    *   **Impact:** Dynamic JSON parsing and filtering in SQL can be complex to implement correctly, may have performance implications compared to strongly-typed parameters, and can be less secure if not handled carefully.
    *   **Action:** Review the implementation of the `hybrid_search` SQL RPC, particularly how it handles `filter_obj`. Evaluate its correctness, performance, and security. Consider if a more structured approach to filtering in the generic RPC is feasible for common filter types.
    *   **Priority:** Medium

35. **Lack of Database Transactions in `SupabaseDatasetService` Deletes:**
    *   **File:** [`packages/server/src/services/supabase/supabase-dataset-service.ts`](packages/server/src/services/supabase/supabase-dataset-service.ts:1) (methods `deleteDataset`, `deleteDatasetClass`)
    *   **Issue:** Methods like `deleteDataset` ([line 256](packages/server/src/services/supabase/supabase-dataset-service.ts:256)) and `deleteDatasetClass` ([line 460](packages/server/src/services/supabase/supabase-dataset-service.ts:460)) perform multiple dependent delete operations (e.g., deleting images, then classes, then the dataset itself) as separate `await` calls. While there's a comment "Start a transaction", the current structure does not guarantee atomicity for these operations at the database level.
    *   **Impact:** If an error occurs midway through these operations (e.g., after deleting images but before deleting the class record), the database could be left in an inconsistent state.
    *   **Action:** Refactor these multi-step delete operations to use database transactions. This might involve creating Supabase RPC functions that encapsulate the entire delete logic within a single transaction, or using a transaction block if the Supabase client library supports it for multiple operations.
    *   **Priority:** Medium

37. **Redundant Material Versioning Call:**
    *   **Files:** [`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:163), [`packages/server/src/services/supabase/supabase-schema.md`](packages/server/src/services/supabase/supabase-schema.md:353)
    *   **Issue:** `SupabaseMaterialService.updateMaterial` manually calls `this.createMaterialVersion`. However, the `supabase-schema.md` defines a database trigger `create_material_version_trigger` that also inserts into the `versions` table `BEFORE UPDATE ON materials`.
    *   **Impact:** If both are active, material updates will result in two version records being created: one by the service, one by the trigger.
    *   **Action:** Remove the manual call to `this.createMaterialVersion` from `SupabaseMaterialService.updateMaterial` and rely on the database trigger for versioning. Verify the trigger logic is complete and correct.
    *   **Priority:** Medium

38. **Filename Mismatch for `SupabaseUtilityService`:**
    *   **File:** [`packages/server/src/services/supabase/supabase-sync.ts`](packages/server/src/services/supabase/supabase-sync.ts:1)
    *   **Issue:** The file `supabase-sync.ts` defines a class named `SupabaseUtilityService`. The filename does not accurately reflect the service it contains.
    *   **Impact:** Can cause confusion for developers navigating the codebase.
    *   **Action:** Rename the file from `supabase-sync.ts` to `supabase-utility.service.ts` or a similar name that matches the class name and its purpose. Update any imports accordingly.
    *   **Priority:** Medium

39. **N+1 Query in `ModelRegistry.getModelComparisons`:**
    *   **File:** [`packages/server/src/services/ai/modelRegistry.ts`](packages/server/src/services/ai/modelRegistry.ts:502)
    *   **Issue:** The `getModelComparisons` method first fetches report headers and then, for each report, fetches its associated metrics in a separate query.
    *   **Impact:** Can lead to N+1 database queries, impacting performance if many reports or metrics per report are involved.
    *   **Action:** Optimize by fetching all necessary metrics in a more consolidated way. For example, after fetching report headers, collect all `reportRecord.id` values and fetch all associated metrics in a single query using an `IN` clause on `comparison_report_id`. Then, map these metrics back to their respective reports in the application layer.
    *   **Priority:** Medium

40. **Placeholder Logic in `ModelRegistry.getModelComparisons` for Rankings:**
    *   **File:** [`packages/server/src/services/ai/modelRegistry.ts`](packages/server/src/services/ai/modelRegistry.ts:529-536)
    *   **Issue:** The reconstruction of `rankings` and `bestModelId` within a `ModelComparisonReport` is noted as a placeholder or overly simplified.
    *   **Impact:** Comparison reports may lack meaningful ranking information or an accurately determined best model if this logic isn't robust.
    *   **Action:** Implement proper logic to derive or retrieve rankings and the best model for each report. This might involve calculating scores based on the fetched metrics or ensuring this data is stored with the report in the `model_comparison_reports` table.
    *   **Priority:** Medium

41. **Hardcoded Model Costs in `ModelRouter.estimateCostPerToken`:**
    *   **File:** [`packages/server/src/services/ai/modelRouter.ts`](packages/server/src/services/ai/modelRouter.ts:650)
    *   **Issue:** The `estimateCostPerToken` method uses a hardcoded `costMap` for different models and providers. It notes these should ideally be configurable.
    *   **Impact:** Costs are not easily updatable or configurable per environment.
    *   **Action:** Move the model cost information into the `ModelRegistryConfig` structure. This way, costs can be loaded from the database along with other registry configurations and managed centrally. Update `estimateCostPerToken` to read from `this.modelRegistry.config`.
    *   **Priority:** Medium

36. **N+1 Query Problem in `SupabaseMaterialService` Search Methods:**
    *   **File:** [`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:1) (methods `findSimilarMaterials`, `hybridSearchMaterials`)
    *   **Issue:** Both `findSimilarMaterials` ([lines 381-389](packages/server/src/services/supabase/supabase-material-service.ts:381-389)) and `hybridSearchMaterials` ([lines 466-476](packages/server/src/services/supabase/supabase-material-service.ts:466-476)) first get a list of material IDs (or basic info) from an RPC or another service, and then iterate through these IDs, calling `getMaterialById` for each one to fetch the full material details.
    *   **Impact:** This leads to an N+1 query problem, where N is the number of similar/hybrid search results. For a typical limit of 10 results, this means 1 initial query + 10 subsequent `getMaterialById` queries, which is inefficient.
    *   **Action:** Optimize these methods to reduce database calls. Options include:
        1.  Modify the respective RPC functions (`find_similar_materials`, and the ones called by `hybridSearch.search`) to return all necessary material fields directly, avoiding the need for subsequent `getMaterialById` calls.
        2.  If RPC modification is complex, collect all result IDs and perform a single batch `SELECT ... WHERE id IN (...)` query to fetch all material details at once after the initial search.
    *   **Priority:** Medium (Performance)

43. **Lack of DB Transactions in `PromptService` Multi-Step Operations:**
    *   **File:** [`packages/server/src/services/ai/promptService.ts`](packages/server/src/services/ai/promptService.ts:1)
    *   **Issue:**
        *   `updatePrompt` ([line 378](packages/server/src/services/ai/promptService.ts:378)): When creating a new version, it performs multiple DB operations (get current prompt, insert new version, update old versions, update main prompt) without an explicit transaction.
        *   `createABExperiment` ([line 1247](packages/server/src/services/ai/promptService.ts:1247)): Creates the experiment record and then loops to create variant records as separate operations.
    *   **Impact:** If any step in these multi-operation methods fails, the database could be left in an inconsistent state (e.g., a new prompt version created but not linked, or an A/B experiment created with only partial variants).
    *   **Action:** Wrap these multi-step database modifications within explicit database transactions to ensure atomicity. This might involve Supabase RPC functions or client-side transaction management if supported.
    *   **Priority:** Medium

46. **Transaction Management in `PromptOptimizationService.executeCreateExperiment`:**
    *   **File:** [`packages/server/src/services/ai/promptOptimizationService.ts`](packages/server/src/services/ai/promptOptimizationService.ts:570)
    *   **Issue:** The `executeCreateExperiment` method performs multiple database operations: fetching suggestions, creating new prompt records for variants (via `promptService.createPrompt`), and then creating the A/B experiment record (via `promptService.createABExperiment`). These are not explicitly wrapped in a transaction.
    *   **Impact:** If an error occurs during variant creation or experiment setup, the system could be left with orphaned prompt records or an incomplete experiment setup.
    *   **Action:** Refactor `executeCreateExperiment` (and potentially the underlying `promptService` methods if they also do multiple writes) to ensure these operations are performed within a single database transaction for atomicity.
    *   **Priority:** Medium

44. **Data Integrity on `PromptService.deletePrompt`:**
    *   **File:** [`packages/server/src/services/ai/promptService.ts`](packages/server/src/services/ai/promptService.ts:492)
    *   **Issue:** The `deletePrompt` method only deletes the main record from `system_prompts`. It does not appear to handle the deletion of related records in other tables (e.g., `system_prompt_versions`, `system_prompt_success_tracking`, `prompt_usage_analytics`, `prompt_ab_variants` linked to prompts within experiments, etc.).
    *   **Impact:** Deleting prompts can lead to orphaned records in associated tables, cluttering the database and potentially causing issues if foreign key constraints are not set to cascade (or if they are, understanding the cascade effect is important).
    *   **Action:**
        1.  Define a clear strategy for handling related data upon prompt deletion.
        2.  Either implement cascade deletes in the database schema (via foreign key constraints `ON DELETE CASCADE`).
        3.  Or, update `deletePrompt` to explicitly delete related records from all relevant tables within a transaction.
    *   **Priority:** Medium

42. **Review RPC Dependencies in `PromptIntegrationService`:**
    *   **File:** [`packages/server/src/services/ai/promptIntegrationService.ts`](packages/server/src/services/ai/promptIntegrationService.ts:1)
    *   **Issue:** The service relies on several Supabase RPC functions to fetch data for export (e.g., `get_success_metrics` on [line 604](packages/server/src/services/ai/promptIntegrationService.ts:604), `get_experiment_results` on [line 659](packages/server/src/services/ai/promptIntegrationService.ts:659), `get_segment_analytics` on [line 713](packages/server/src/services/ai/promptIntegrationService.ts:713), `get_ml_predictions` on [line 764](packages/server/src/services/ai/promptIntegrationService.ts:764), `execute_query` on [line 819](packages/server/src/services/ai/promptIntegrationService.ts:819)).
    *   **Impact:** The correctness and efficiency of data exports depend entirely on these underlying RPCs.
    *   **Action:** Review the SQL definitions of these RPC functions to ensure they accurately fetch the intended data and are reasonably performant.
    *   **Priority:** Medium

45. **Transaction Management in `PromptMLService`:**
    *   **File:** [`packages/server/src/services/ai/promptMLService.ts`](packages/server/src/services/ai/promptMLService.ts:1) (methods `trainModel`, `applyImprovementSuggestion`)
    *   **Issue:**
        *   `trainModel` ([line 192](packages/server/src/services/ai/promptMLService.ts:192)) performs multiple database operations (get version, insert new version, update model metrics).
        *   `applyImprovementSuggestion` ([line 490](packages/server/src/services/ai/promptMLService.ts:490)) also performs multiple updates (prompt content, suggestion status).
    *   **Impact:** Potential for data inconsistency if one of the steps fails.
    *   **Action:** Wrap these multi-step database modifications within explicit database transactions.
    *   **Priority:** Medium

51. **Feature Dimensionality/Sparsity in `RelationshipFeatureExtractor`:**
    *   **File:** [`packages/server/src/services/ai/property-prediction/relationshipFeatureExtractor.ts`](packages/server/src/services/ai/property-prediction/relationshipFeatureExtractor.ts:24) (method `extractFeatures`)
    *   **Issue:** The method creates dynamic feature names that include specific property values (e.g., `corr_finish_glossy_to_rRating_R10`, `compat_score_color_red_to_style_modern`). If properties have high cardinality (many unique values), this can lead to a very high-dimensional and sparse feature space.
    *   **Impact:** High dimensionality and sparsity can make some ML models harder to train, less effective, or require more data.
    *   **Action:** Monitor the dimensionality of the generated feature space. If it becomes problematic, consider techniques like:
        *   Feature hashing.
        *   Limiting cardinality of values used in feature names (e.g., only top N values).
        *   Using embedding layers for categorical features if neural networks are the primary consumers.
        *   Aggregating relationship features in a more generic way (e.g., average correlation strength instead of per-value).
    *   **Priority:** Medium

52. **Basic Default Value Generation in `RelationshipFeatureExtractor.generateTrainingData`:**
    *   **File:** [`packages/server/src/services/ai/property-prediction/relationshipFeatureExtractor.ts`](packages/server/src/services/ai/property-prediction/relationshipFeatureExtractor.ts:206-217)
    *   **Issue:** If the relationship graph is sparse and doesn't provide enough possible values for `targetProperty` or `sourceProperties`, the `generateTrainingData` method falls back to very basic hardcoded default values (e.g., 'matte'/'glossy' for 'finish', 'value1'/'value2' for others).
    *   **Impact:** This can lead to poor quality or unrepresentative synthetic training data if the relationship graph lacks coverage for certain properties.
    *   **Action:** Explore more robust strategies for generating or sourcing default/representative values when the graph is sparse. This could involve:
        *   Fetching actual distinct values from the `materials` table for the given `materialType` and `propertyName`.
        *   Using predefined lists of common values for known properties.
        *   Implementing a strategy to ensure a wider and more realistic distribution of values in synthetic data.
    *   **Priority:** Medium

47. **N+1 Query Problem in `PromptStatisticalService`:**
    *   **File:** [`packages/server/src/services/ai/promptStatisticalService.ts`](packages/server/src/services/ai/promptStatisticalService.ts:1)
    *   **Issue:**
        *   `analyzeExperiment` ([line 132](packages/server/src/services/ai/promptStatisticalService.ts:132)) fetches analytics data for each A/B test variant in a loop.
        *   `compareSegments` ([line 246](packages/server/src/services/ai/promptStatisticalService.ts:246)) fetches analytics data for each user segment in a loop.
    *   **Impact:** Leads to multiple database queries where one or a few could suffice, impacting performance when analyzing experiments or segments with many variants/segments.
    *   **Action:** Optimize these methods to fetch analytics data in a more consolidated manner. For example, collect all relevant `variant_id`s or `segment_id`s and use a single query with an `IN` clause to fetch their `prompt_usage_analytics` data. Then, process this data in the application layer.
    *   **Priority:** Medium (Performance)

48. **Utility and Accuracy of Local Image Analysis Fallback:**
    *   **File:** [`packages/server/src/services/ai/imageAnalysisService.ts`](packages/server/src/services/ai/imageAnalysisService.ts:137) (method `analyzeImageLocally`)
    *   **Issue:** The `analyzeImageLocally` method provides a fallback if MCP is unavailable. However, its analysis is based on simple heuristics (color variance, brightness ratios, color counts) and explicitly states it cannot determine material type, setting confidence to a fixed 0.6.
    *   **Impact:** The fallback analysis results might be too simplistic or inaccurate for meaningful use, potentially leading to poor user experience or incorrect downstream processing if relied upon.
    *   **Action:** Evaluate if the current local fallback provides sufficient value. If not, consider:
        1.  Removing it and failing explicitly if MCP is unavailable for critical analysis.
        2.  Clearly documenting its severe limitations wherever its results are consumed.
        3.  Exploring lightweight, local ML models (e.g., via ONNX runtime or a simpler TensorFlow.js model) if a more capable fallback is essential and feasible.
    *   **Priority:** Medium

53. **Numeric Assumption for Source Values in `RelationshipAwareTrainingService.extractRelationshipFeatures`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:572)
    *   **Issue:** When creating features from relationships, the code multiplies `sourceValue` by `relationship.strength` (e.g., `features[featureName] = sourceValue * relationship.strength;`). This assumes `sourceValue` is numeric.
    *   **Impact:** If `sourceValue` is a string or categorical, this will result in `NaN` or incorrect feature values.
    *   **Action:** Implement appropriate handling for categorical `sourceValue`s when creating relationship features. This might involve creating separate binary features for specific source value/relationship type combinations, or interaction terms, rather than direct multiplication.
    *   **Priority:** Medium

54. **Fragile Path Construction in `RelationshipAwareTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:1) (e.g., [line 230](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:230))
    *   **Issue:** Uses `process.cwd()` for local model storage paths.
    *   **Impact:** Paths may be incorrect if the service isn't run from the project root.
    *   **Action:** While the primary fix is to move to object storage, ensure robust path resolution for any remaining local file operations.
    *   **Priority:** Medium (Secondary to removing local FS reliance)

50. **Fragile Path Construction in `PropertyPredictionService`:**
    *   **File:** [`packages/server/src/services/ai/property-prediction/propertyPredictionService.ts`](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:1) (e.g., [line 76](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:76), [131](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:131))
    *   **Issue:** Uses `process.cwd()` for local model storage paths.
    *   **Impact:** Paths may be incorrect if the service isn't run from the project root.
    *   **Action:** While the primary fix is to move to object storage, if any temporary local processing remains, use robust path resolution.
    *   **Priority:** Medium (Secondary to removing local FS reliance)

49. **Fragile Path Construction in `VisualReferenceTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/visual-reference-training.ts`](packages/server/src/services/ai/visual-reference-training.ts:1) (e.g., [line 52](packages/server/src/services/ai/visual-reference-training.ts:52), [111](packages/server/src/services/ai/visual-reference-training.ts:111), [124](packages/server/src/services/ai/visual-reference-training.ts:124))
    *   **Issue:** Uses `process.cwd()` as the base for constructing local filesystem paths for datasets and models.
    *   **Impact:** This can lead to incorrect paths if the service is run from a directory other than the project root.
    *   **Action:** While the primary fix is to move away from local filesystem storage, if any temporary local processing is still needed, use more robust path resolution (e.g., relative to `__dirname` if appropriate, or from a well-defined base path configured via `UnifiedConfig`).
    *   **Priority:** Medium (Secondary to removing local FS reliance)

## IV. Low Priority & Code Quality Refinements

1.  **Header Component Refinements (Code Quality aspects):**
    *   **File:** [`packages/client/src/components/Header.tsx`](packages/client/src/components/Header.tsx:1)
    *   **Issue:** Unused shared imports, hardcoded navigation.
    *   **Action:** Clean up imports, consider mapping `navItems`.
    *   **Priority:** Low

2.  **Footer Component Refinements:**
    *   **File:** [`packages/client/src/components/Footer.tsx`](packages/client/src/components/Footer.tsx:1)
    *   **Action:** Consider SVG icons, i18n for text.
    *   **Priority:** Low (Medium if i18n is firm requirement)

3.  **Accessibility of "Add to Board" Button in `MaterialCard.tsx`:**
    *   **File:** [`packages/client/src/components/materials/MaterialCard.tsx`](packages/client/src/components/materials/MaterialCard.tsx:54-59)
    *   **Action:** Add more descriptive `aria-label`.
    *   **Priority:** Low

4.  **Icon Implementation in `RecognitionDemo.tsx`:**
    *   **File:** [`packages/client/src/components/RecognitionDemo.tsx`](packages/client/src/components/RecognitionDemo.tsx:1)
    *   **Action:** Consider SVG icons.
    *   **Priority:** Low

5.  **Local `MaterialProperty` Type in `materialService.ts` (Client):**
    *   **File:** [`packages/client/src/services/materialService.ts`](packages/client/src/services/materialService.ts:19-22)
    *   **Action:** If common, move to shared types.
    *   **Priority:** Low

6.  **Type Safety of `process.env` Access in `UnifiedConfig`:**
    *   **File:** [`packages/shared/src/utils/unified-config.ts`](packages/shared/src/utils/unified-config.ts:1)
    *   **Action:** Consider stricter typing/validation for env vars.
    *   **Priority:** Low

7.  **Jitter Application in `applyJitter` (`cron-parser.ts`):**
    *   **File:** [`packages/shared/src/utils/cron-parser.ts`](packages/shared/src/utils/cron-parser.ts:346-359)
    *   **Action:** Confirm if always subtracting jitter is intended.
    *   **Priority:** Low

8.  **Circular Dependency Check for Cache Warming Dependencies:**
    *   **File:** [`packages/shared/src/services/cache/cacheWarming.ts`](packages/shared/src/services/cache/cacheWarming.ts:717-742)
    *   **Action:** Add detection for circular dependencies.
    *   **Priority:** Low

9.  **Pattern-Based Invalidation Fallback in `CacheInvalidationService`:**
    *   **File:** [`packages/shared/src/services/cache/cacheInvalidation.ts`](packages/shared/src/services/cache/cacheInvalidation.ts:1)
    *   **Action:** Implement granular pattern deletion or document limitation.
    *   **Priority:** Low (Medium if granular pattern invalidation is essential)

10. **Logger Inconsistency in `configValidator.ts`:**
    *   **File:** [`packages/shared/src/utils/configValidator.ts`](packages/shared/src/utils/configValidator.ts:8)
    *   **Action:** Update to use `createLogger` from `unified-logger`.
    *   **Priority:** Low

11. **Hardcoded `storageBucket` in `MaterialRecognitionProvider`:**
    *   **File:** [`packages/shared/src/services/recognition/materialProvider.ts`](packages/shared/src/services/recognition/materialProvider.ts:49)
    *   **Action:** Make configurable via `UnifiedConfig`.
    *   **Priority:** Low

12. **Missing `generateUniqueKey` in `SupabaseStorageProvider`:**
    *   **File:** [`packages/shared/src/services/storage/supabaseStorageProvider.ts`](packages/shared/src/services/storage/supabaseStorageProvider.ts:1)
    *   **Action:** Implement `generateUniqueKey` from `StorageProvider` interface.
    *   **Priority:** Low

13. **Direct `process.env.SUPABASE_URL` in `SupabaseStorageProvider` Fallback:**
    *   **File:** [`packages/shared/src/services/storage/supabaseStorageProvider.ts`](packages/shared/src/services/storage/supabaseStorageProvider.ts:48)
    *   **Action:** Use `config.get('supabase.url')` for consistency if possible for this fallback.
    *   **Priority:** Low

14. **Path/Bucket Handling Duplication (Storage Services):**
    *   **Files:** `SupabaseStorageProvider.ts`, `s3StorageAdapter.ts` (to be `storageService.ts`)
    *   **Action:** Centralize or redesign API to take explicit bucket/key.
    *   **Priority:** Low

15. **Logger Inconsistency in `PropertyInheritanceService`:**
    *   **File:** [`packages/server/src/services/propertyInheritance/propertyInheritanceService.ts`](packages/server/src/services/propertyInheritance/propertyInheritanceService.ts:8)
    *   **Action:** Update to use `createLogger` from `unified-logger`.
    *   **Priority:** Low

16. **`isDefaultValue` Logic in `PropertyInheritanceService`:**
    *   **File:** [`packages/server/src/services/propertyInheritance/propertyInheritanceService.ts`](packages/server/src/services/propertyInheritance/propertyInheritanceService.ts:167-183)
    *   **Issue:** Considers `0` as a default value.
    *   **Action:** Re-evaluate if `0` should always be "default" or if more nuance is needed.
    *   **Priority:** Low

17. **Logger Inconsistency in `QueryUnderstandingService`:**
    *   **File:** [`packages/server/src/services/search/query-understanding-service.ts`](packages/server/src/services/search/query-understanding-service.ts:11)
    *   **Action:** Update to use `createLogger` from `unified-logger`.
    *   **Priority:** Low

18. **`ensureTables` DDL via RPC in `QueryUnderstandingService`:**
    *   **File:** [`packages/server/src/services/search/query-understanding-service.ts`](packages/server/src/services/search/query-understanding-service.ts:96-157)
    *   **Issue:** Creates tables via RPC at startup.
    *   **Action:** Move schema definitions to Supabase migration files.
    *   **Priority:** Low

19. **Error Fallback Embedding in `QueryUnderstandingService.enhanceQuery`:**
    *   **File:** [`packages/server/src/services/search/query-understanding-service.ts`](packages/server/src/services/search/query-understanding-service.ts:250)
    *   **Issue:** Returns a mock embedding on error.
    *   **Action:** Consider returning `[]` or `undefined` for `queryEmbedding` on failure.
    *   **Priority:** Low

20. **Logger Inconsistency in `ConversationalSearchService`:**
    *   **File:** [`packages/server/src/services/search/conversational-search-service.ts`](packages/server/src/services/search/conversational-search-service.ts:10)
    *   **Action:** Update to use `createLogger` from `unified-logger`.
    *   **Priority:** Low

21. **Recursive Call in `apiKeyManager.service.ts` `getUserApiKeys`:**
    *   **File:** [`packages/server/src/services/auth/apiKeyManager.service.ts`](packages/server/src/services/auth/apiKeyManager.service.ts:39)
    *   **Issue:** The service function `getUserApiKeys` was calling itself recursively due to name shadowing with an imported model function.
    *   **Impact:** Stack overflow if the function was called.
    *   **Action:** Fixed by aliasing the imported model function to `getUserApiKeysFromModel`.
    *   **Status:** Resolved.
    *   **Priority:** Low (was Critical, now resolved)

22. **Unused `supabaseClient` Import in `sessionManager.service.ts`:**
    *   **File:** [`packages/server/src/services/auth/sessionManager.service.ts`](packages/server/src/services/auth/sessionManager.service.ts:23)
    *   **Issue:** `supabaseClient` is imported but not directly used within the service. Database operations are delegated to `userSession.model.ts`.
    *   **Impact:** Minor code clutter.
    *   **Action:** Remove the import if it's confirmed to be unused.
    *   **Priority:** Low

23. **`setInterval` for Scheduled Cleanups in Auth Services:**
    *   **Files:** [`packages/server/src/services/auth/apiKeyManager.service.ts`](packages/server/src/services/auth/apiKeyManager.service.ts:156), [`packages/server/src/services/auth/sessionManager.service.ts`](packages/server/src/services/auth/sessionManager.service.ts:294)
    *   **Issue:** Uses `setInterval` for periodic cleanup of expired API keys and sessions.
    *   **Impact:** While functional, `setInterval` can be less reliable for critical scheduled tasks in a production environment (e.g., behavior on unhandled errors, drift over time).
    *   **Action:** Consider using a more robust scheduling mechanism if available within the project (e.g., a dedicated cron job manager or a library like `node-cron`) for production deployments. For now, it's acceptable.
    *   **Priority:** Low

24. **Hardcoded `embedding_quality` in `EnhancedVectorServiceImpl.storeEmbedding`:**
    *   **File:** [`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:308)
    *   **Issue:** The `embedding_quality` field is hardcoded to `1.0` when storing embeddings.
    *   **Impact:** Does not reflect actual embedding quality if a scoring mechanism exists or is planned.
    *   **Action:** If embedding quality can be assessed (e.g., by the Python script or other metrics), use the actual value. Otherwise, document this as a placeholder.
    *   **Priority:** Low

25. **Hardcoded `model_name` in `EnhancedVectorServiceImpl.logEmbeddingMetrics`:**
    *   **File:** [`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:345)
    *   **Issue:** The `model_name` for embedding metrics is hardcoded as `'all-MiniLM-L6-v2'`.
    *   **Impact:** Metrics will be inaccurate if different embedding models are used.
    *   **Action:** Parameterize the model name, possibly by retrieving it from the `EmbeddingGenerationOptions` or the active `VectorSearchConfig`.
    *   **Priority:** Low

26. **Assumed `vector_search_performance` Table in `EnhancedVectorServiceImpl.getPerformanceStats`:**
    *   **File:** [`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:833)
    *   **Issue:** The `getPerformanceStats` method attempts to select from a `vector_search_performance` table. The schema or existence of this table is not defined/verified within this review context.
    *   **Impact:** Method will fail if the table doesn't exist or has a different schema.
    *   **Action:** Verify the existence and schema of the `vector_search_performance` table. Ensure it aligns with the query in this method.
    *   **Priority:** Low

27. **Logger Inconsistency in `EnhancedVectorServiceImpl`:**
    *   **File:** [`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:13)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy (likely `unified-logger.ts`).
    *   **Priority:** Low (Consistent with other similar logger issues, but less critical than auth service loggers if those are prioritized first)

28. **Programmatic Index Creation in `SupabaseVectorSearch.createIndex`:**
    *   **File:** [`packages/server/src/services/supabase/vector-search.ts`](packages/server/src/services/supabase/vector-search.ts:208)
    *   **Issue:** The `createIndex` method attempts to construct and (conditionally) execute `CREATE INDEX` SQL statements programmatically.
    *   **Impact:** While potentially useful for dynamic scenarios, index creation is typically better managed via database migrations for schema version control and consistency. Direct execution of DDL from application code can also pose permission risks.
    *   **Action:** Evaluate the necessity of this programmatic index creation. Prefer managing vector indexes through SQL migration files (e.g., in `packages/server/src/services/supabase/migrations/`). If retained, ensure robust error handling and consider security implications of executing DDL from the application.
    *   **Priority:** Low

29. **Logger Inconsistency in `vector-search.ts`:**
    *   **File:** [`packages/server/src/services/supabase/vector-search.ts`](packages/server/src/services/supabase/vector-search.ts:10)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

30. **Unused `SupabaseVectorSearch` Dependency in `SupabaseHybridSearch`:**
    *   **File:** [`packages/server/src/services/supabase/hybrid-search.ts`](packages/server/src/services/supabase/hybrid-search.ts:51)
    *   **Issue:** An instance of `SupabaseVectorSearch` is created in the constructor but is not used by any methods in the class.
    *   **Impact:** Minor code clutter, unnecessary object instantiation.
    *   **Action:** Remove the `this.vectorSearch` property and its instantiation.
    *   **Priority:** Low

31. **Logger Inconsistency in `hybrid-search.ts`:**
    *   **File:** [`packages/server/src/services/supabase/hybrid-search.ts`](packages/server/src/services/supabase/hybrid-search.ts:10)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

32. **Widespread use of `as any` in `SupabaseDatasetService`:**
    *   **File:** [`packages/server/src/services/supabase/supabase-dataset-service.ts`](packages/server/src/services/supabase/supabase-dataset-service.ts:1)
    *   **Issue:** Supabase client query builder calls are frequently cast with `as any` (e.g., [line 153](packages/server/src/services/supabase/supabase-dataset-service.ts:153), [179](packages/server/src/services/supabase/supabase-dataset-service.ts:179)).
    *   **Impact:** Reduces TypeScript's type safety benefits, potentially hiding type errors or incorrect data handling.
    *   **Action:** Investigate if using generated Supabase types (e.g., via `supabase gen types typescript`) could help in strongly typing these client calls and reducing the need for `as any`.
    *   **Priority:** Low

33. **Generic Error Re-throwing in `SupabaseDatasetService`:**
    *   **File:** [`packages/server/src/services/supabase/supabase-dataset-service.ts`](packages/server/src/services/supabase/supabase-dataset-service.ts:1)
    *   **Issue:** Most error handling blocks catch errors and re-throw `new Error(...)`.
    *   **Impact:** Can obscure the original error type and context if not handled carefully by upstream callers. If these service errors are meant to result in specific HTTP error responses, using custom error classes (like `ApiError` used elsewhere in the codebase) would be more consistent.
    *   **Action:** Consider standardizing error propagation to use custom error classes (e.g., `ApiError` or domain-specific errors) for better error handling and response consistency.
    *   **Priority:** Low

34. **Logger Inconsistency in `SupabaseDatasetService`:**
    *   **File:** [`packages/server/src/services/supabase/supabase-dataset-service.ts`](packages/server/src/services/supabase/supabase-dataset-service.ts:9)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

35. **Counter Update Efficiency in `SupabaseDatasetService` (Observation):**
    *   **File:** [`packages/server/src/services/supabase/supabase-dataset-service.ts`](packages/server/src/services/supabase/supabase-dataset-service.ts:1) (methods `updateClassImageCount`, `updateDatasetCounters`)
    *   **Issue:** Counter updates involve separate `SELECT COUNT(*)` queries followed by an `UPDATE`.
    *   **Impact:** For very high-frequency modifications of dataset entities, this pattern could become a performance bottleneck.
    *   **Action:** This is an observation for now. If performance issues arise in these areas, consider optimizing counter updates (e.g., using database triggers, batch updates, or denormalizing counts with careful consistency management).
    *   **Priority:** Low (Observation)

36. **Review RPCs in `SupabaseMaterialService.getKnowledgeBaseStats`:**
    *   **File:** [`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:762)
    *   **Issue:** The `getKnowledgeBaseStats` method relies on RPCs `get_materials_by_type` and `get_materials_by_collection`.
    *   **Action:** Review the SQL definitions of these RPCs for correctness and efficiency.
    *   **Priority:** Low

37. **CSV Parsing in `SupabaseMaterialService.getKnowledgeBaseStats`:**
    *   **File:** [`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:802)
    *   **Issue:** The method fetches `vector_indexes` status by selecting as CSV and then parsing the string.
    *   **Impact:** Less robust than direct JSON results.
    *   **Action:** Investigate if the `vector_indexes` data (or a view on it) can be queried to return structured JSON directly, avoiding manual CSV parsing.
    *   **Priority:** Low

38. **Logger Inconsistency in `SupabaseMaterialService`:**
    *   **File:** [`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:10)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

39. **Generic Error Re-throwing in `SupabaseMaterialService`:**
    *   **File:** [`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:1)
    *   **Issue:** Error handling blocks often re-throw `new Error(...)`.
    *   **Action:** Consider standardizing to custom error classes (e.g., `ApiError`) for consistency.
    *   **Priority:** Low

40. **Assumed Table Schemas in `SupabaseMaterialService.getKnowledgeBaseStats`:**
    *   **File:** [`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:1)
    *   **Issue:** The `getKnowledgeBaseStats` method assumes the existence and specific schemas for `collections` and `vector_indexes` tables/views.
    *   **Action:** Ensure these database objects are defined in migrations and their schemas match the service's expectations.
    *   **Priority:** Low (Observation)

41. **Vector Index Discrepancy (Schema vs. Service Default):**
    *   **Files:** [`packages/server/src/services/supabase/supabase-schema.md`](packages/server/src/services/supabase/supabase-schema.md:77), [`packages/server/src/services/supabase/vector-search.ts`](packages/server/src/services/supabase/vector-search.ts:211)
    *   **Issue:** The `materials` table schema in `supabase-schema.md` defines a vector index `materials_vector_idx` using `ivfflat` and `vector_cosine_ops`. However, the `SupabaseVectorSearch.createIndex` method defaults to `hnsw` and its SQL construction implies `vector_l2_ops`.
    *   **Impact:** Minor inconsistency. If `createIndex` were used, it would create a different type of index than what's documented as the primary one.
    *   **Action:** Ensure migrations are the source of truth for index definitions. If `SupabaseVectorSearch.createIndex` is intended for use, align its defaults or parameters with the standard index types used in the project (likely `ivfflat` with `vector_cosine_ops` as per schema).
    *   **Priority:** Low

42. **`vector_indexes` Table Schema vs. Service Usage Discrepancy:**
    *   **Files:** [`packages/server/src/services/supabase/supabase-schema.md`](packages/server/src/services/supabase/supabase-schema.md:211), [`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:802), [`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:833)
    *   **Issue:**
        *   `supabase-schema.md` defines a `vector_indexes` table.
        *   `SupabaseMaterialService.getKnowledgeBaseStats` queries this `vector_indexes` table but expects CSV output with `status, count`.
        *   `EnhancedVectorServiceImpl.getPerformanceStats` attempts to query a `vector_search_performance` table, which is not defined in the schema document.
    *   **Impact:** `getPerformanceStats` will fail. `getKnowledgeBaseStats` CSV parsing is unusual.
    *   **Action:**
        1.  Consolidate on a single table for vector index/performance metadata (likely `vector_indexes` as defined in schema).
        2.  Update `EnhancedVectorServiceImpl.getPerformanceStats` to query the correct `vector_indexes` table and its defined columns.
        3.  Modify `SupabaseMaterialService.getKnowledgeBaseStats` to query `vector_indexes` and process structured JSON results instead of CSV, if possible.
    *   **Priority:** Low

45. **Logger Inconsistency in `SupabaseHelper`:**
    *   **File:** [`packages/server/src/services/supabase/supabaseHelper.ts`](packages/server/src/services/supabase/supabaseHelper.ts:10)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

43. **Logger Inconsistency in `SupabaseUtilityService` (`supabase-sync.ts`):**
    *   **File:** [`packages/server/src/services/supabase/supabase-sync.ts`](packages/server/src/services/supabase/supabase-sync.ts:9)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

44. **`healthCheck` Status Logic in `SupabaseUtilityService`:**
    *   **File:** [`packages/server/src/services/supabase/supabase-sync.ts`](packages/server/src/services/supabase/supabase-sync.ts:75)
    *   **Issue:** The `healthCheck` method's return type definition includes a `'degraded'` status, but the current implementation only returns `'healthy'` or `'unhealthy'`.
    *   **Impact:** Minor; the `'degraded'` status is unused.
    *   **Action:** If a `'degraded'` state is meaningful (e.g., high latency but still functional), implement logic to set this status. Otherwise, remove `'degraded'` from the return type for accuracy.
    *   **Priority:** Low

46. **Optimization TODO in `ModelRegistry.selectBestModel`:**
    *   **File:** [`packages/server/src/services/ai/modelRegistry.ts`](packages/server/src/services/ai/modelRegistry.ts:289)
    *   **Issue:** A `TODO` comment notes to consider fetching only recent metrics or a summary instead of all historical metrics for `selectBestModel`.
    *   **Impact:** Fetching all historical performance data for every model selection could become inefficient as data grows.
    *   **Action:** Implement a strategy for using recent or summarized/aggregated performance data for model selection to improve performance. This could involve time windowing, rolling averages, or pre-calculated aggregate scores in the database.
    *   **Priority:** Low (Performance optimization)

47. **Logger Inconsistency in `ModelRegistry`:**
    *   **File:** [`packages/server/src/services/ai/modelRegistry.ts`](packages/server/src/services/ai/modelRegistry.ts:11)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

48. **Use of `as any` in `ModelRegistry` Data Mapping:**
    *   **File:** [`packages/server/src/services/ai/modelRegistry.ts`](packages/server/src/services/ai/modelRegistry.ts:459)
    *   **Issue:** Uses `as any` for `dbResult` when mapping database results to `ModelEvaluationResult`.
    *   **Impact:** Reduces type safety.
    *   **Action:** Use generated Supabase types if available to provide strong types for `dbResult` and avoid `as any`.
    *   **Priority:** Low

49. **Logger Inconsistency in `ModelRouter`:**
    *   **File:** [`packages/server/src/services/ai/modelRouter.ts`](packages/server/src/services/ai/modelRouter.ts:10)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

50. **Singleton Pattern Inconsistency in `PromptIntegrationService`:**
    *   **File:** [`packages/server/src/services/ai/promptIntegrationService.ts`](packages/server/src/services/ai/promptIntegrationService.ts:76)
    *   **Issue:** Unlike many other services in the codebase (e.g., `ModelRegistry`, `SupabaseDatasetService`), `PromptIntegrationService` does not implement a static `getInstance()` method for singleton access. It's instantiated directly.
    *   **Impact:** Inconsistent service design pattern. May lead to multiple instances if not managed carefully by consumers, though typically services are singletons.
    *   **Action:** Refactor `PromptIntegrationService` to use the static `getInstance()` singleton pattern for consistency with other services.
    *   **Priority:** Low

51. **Unused Imports in `PromptIntegrationService`:**
    *   **File:** [`packages/server/src/services/ai/promptIntegrationService.ts`](packages/server/src/services/ai/promptIntegrationService.ts:10-11)
    *   **Issue:** `fs` and `path` modules are imported but do not appear to be used anywhere in the service.
    *   **Impact:** Minor code clutter.
    *   **Action:** Remove the unused imports for `fs` and `path`.
    *   **Priority:** Low

52. **Logger Inconsistency in `PromptIntegrationService`:**
    *   **File:** [`packages/server/src/services/ai/promptIntegrationService.ts`](packages/server/src/services/ai/promptIntegrationService.ts:7)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

53. **Generic Error Re-throwing in `PromptIntegrationService`:**
    *   **File:** [`packages/server/src/services/ai/promptIntegrationService.ts`](packages/server/src/services/ai/promptIntegrationService.ts:1)
    *   **Issue:** Error handling blocks often re-throw `new Error(...)`.
    *   **Action:** Consider standardizing to custom error classes for consistency.
    *   **Priority:** Low

54. **Dependency Check for `axios` in `PromptIntegrationService`:**
    *   **File:** [`packages/server/src/services/ai/promptIntegrationService.ts`](packages/server/src/services/ai/promptIntegrationService.ts:9)
    *   **Issue:** The service uses `axios` for making HTTP requests to external systems.
    *   **Action:** Ensure `axios` is listed as a dependency in `packages/server/package.json` and is correctly installed.
    *   **Priority:** Low (Build/runtime check)

55. **Unused Imports in `PromptService`:**
    *   **File:** [`packages/server/src/services/ai/promptService.ts`](packages/server/src/services/ai/promptService.ts:10-11)
    *   **Issue:** `fs` and `path` modules are imported but do not appear to be used.
    *   **Impact:** Minor code clutter.
    *   **Action:** Remove the unused imports.
    *   **Priority:** Low

56. **Logger Inconsistency in `PromptService`:**
    *   **File:** [`packages/server/src/services/ai/promptService.ts`](packages/server/src/services/ai/promptService.ts:8)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

57. **Generic Error Re-throwing in `PromptService`:**
    *   **File:** [`packages/server/src/services/ai/promptService.ts`](packages/server/src/services/ai/promptService.ts:1)
    *   **Issue:** Error handling blocks often re-throw `new Error(...)`.
    *   **Action:** Consider standardizing to custom error classes.
    *   **Priority:** Low

58. **Database Schema for `PromptService` Tables (Observation):**
    *   **File:** [`packages/server/src/services/ai/promptService.ts`](packages/server/src/services/ai/promptService.ts:1)
    *   **Issue:** This service interacts with numerous tables: `system_prompts`, `system_prompt_versions`, `system_prompt_success_tracking`, `prompt_usage_analytics`, `prompt_monitoring_alerts`, `prompt_monitoring_settings`, `prompt_ab_experiments`, `prompt_ab_variants`, `prompt_ab_assignments`, `user_segments`, `user_segment_assignments`.
    *   **Action:** Ensure all these tables are correctly defined in Supabase migrations with appropriate schemas, indexes, and foreign key relationships (including cascade behavior where appropriate).
    *   **Priority:** Low (Observation - covered by general need for schema review)

59. **Dependency Check for ML Libraries in `PromptMLService`:**
    *   **File:** [`packages/server/src/services/ai/promptMLService.ts`](packages/server/src/services/ai/promptMLService.ts:1)
    *   **Issue:** The service uses `@tensorflow/tfjs-node`, and requires `ml-random-forest` and `ml-gradient-boosting`.
    *   **Action:** Ensure these are listed as dependencies in `packages/server/package.json` and are correctly installed.
    *   **Priority:** Low (Build/runtime check)

60. **Logger Inconsistency in `PromptMLService`:**
    *   **File:** [`packages/server/src/services/ai/promptMLService.ts`](packages/server/src/services/ai/promptMLService.ts:7)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

61. **Generic Error Re-throwing in `PromptMLService`:**
    *   **File:** [`packages/server/src/services/ai/promptMLService.ts`](packages/server/src/services/ai/promptMLService.ts:1)
    *   **Issue:** Error handling blocks often re-throw `new Error(...)`.
    *   **Action:** Consider standardizing to custom error classes.
    *   **Priority:** Low

62. **Singleton Pattern Inconsistency in `PromptMLService`:**
    *   **File:** [`packages/server/src/services/ai/promptMLService.ts`](packages/server/src/services/ai/promptMLService.ts:88)
    *   **Issue:** Does not use the static `getInstance()` singleton pattern.
    *   **Action:** Refactor for consistency if other services predominantly use the static method.
    *   **Priority:** Low

63. **Database Schema for `PromptMLService` Tables (Observation):**
    *   **File:** [`packages/server/src/services/ai/promptMLService.ts`](packages/server/src/services/ai/promptMLService.ts:1)
    *   **Issue:** This service interacts with tables: `prompt_ml_models`, `prompt_ml_model_versions`, `prompt_ml_predictions`, `prompt_improvement_suggestions`.
    *   **Action:** Ensure these tables are correctly defined in Supabase migrations.
    *   **Priority:** Low (Observation)

64. **Logger Inconsistency in `PromptOptimizationService`:**
    *   **File:** [`packages/server/src/services/ai/promptOptimizationService.ts`](packages/server/src/services/ai/promptOptimizationService.ts:7)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

65. **Generic Error Re-throwing in `PromptOptimizationService`:**
    *   **File:** [`packages/server/src/services/ai/promptOptimizationService.ts`](packages/server/src/services/ai/promptOptimizationService.ts:1)
    *   **Issue:** Error handling blocks often re-throw `new Error(...)`.
    *   **Action:** Consider standardizing to custom error classes.
    *   **Priority:** Low

66. **Singleton Pattern Inconsistency in `PromptOptimizationService`:**
    *   **File:** [`packages/server/src/services/ai/promptOptimizationService.ts`](packages/server/src/services/ai/promptOptimizationService.ts:80)
    *   **Issue:** Does not use the static `getInstance()` singleton pattern.
    *   **Action:** Refactor for consistency.
    *   **Priority:** Low

67. **Database Schema for `PromptOptimizationService` Tables (Observation):**
    *   **File:** [`packages/server/src/services/ai/promptOptimizationService.ts`](packages/server/src/services/ai/promptOptimizationService.ts:1)
    *   **Issue:** This service interacts with tables `prompt_optimization_rules` and `prompt_optimization_actions`.
    *   **Action:** Ensure these tables are correctly defined in Supabase migrations.
    *   **Priority:** Low (Observation)

68. **Dependency Check for `jstat` in `PromptStatisticalService`:**
    *   **File:** [`packages/server/src/services/ai/promptStatisticalService.ts`](packages/server/src/services/ai/promptStatisticalService.ts:9)
    *   **Issue:** The service uses the `jstat` library for statistical calculations (Z-test, Chi-square).
    *   **Action:** Ensure `jstat` (and its types, e.g., `@types/jstat` if available) is listed as a dependency in `packages/server/package.json` and is correctly installed.
    *   **Priority:** Low (Build/runtime check)

69. **Logger Inconsistency in `PromptStatisticalService`:**
    *   **File:** [`packages/server/src/services/ai/promptStatisticalService.ts`](packages/server/src/services/ai/promptStatisticalService.ts:7)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

70. **Generic Error Re-throwing in `PromptStatisticalService`:**
    *   **File:** [`packages/server/src/services/ai/promptStatisticalService.ts`](packages/server/src/services/ai/promptStatisticalService.ts:1)
    *   **Issue:** Error handling blocks often re-throw `new Error(...)`.
    *   **Action:** Consider standardizing to custom error classes.
    *   **Priority:** Low

71. **Singleton Pattern Inconsistency in `PromptStatisticalService`:**
    *   **File:** [`packages/server/src/services/ai/promptStatisticalService.ts`](packages/server/src/services/ai/promptStatisticalService.ts:46)
    *   **Issue:** Does not use the static `getInstance()` singleton pattern.
    *   **Action:** Refactor for consistency.
    *   **Priority:** Low

72. **Database Schema for `PromptStatisticalService` Tables (Observation):**
    *   **File:** [`packages/server/src/services/ai/promptStatisticalService.ts`](packages/server/src/services/ai/promptStatisticalService.ts:1)
    *   **Issue:** This service interacts with `prompt_statistical_analysis`, `prompt_ab_experiments`, and `prompt_usage_analytics`.
    *   **Action:** Ensure these tables are correctly defined in Supabase migrations.
    *   **Priority:** Low (Observation)

73. **Synchronous File Read in `ImageAnalysisService`:**
    *   **File:** [`packages/server/src/services/ai/imageAnalysisService.ts`](packages/server/src/services/ai/imageAnalysisService.ts:87) (method `analyzeImageWithMCP`)
    *   **Issue:** Uses `fs.readFileSync` to read the image file before sending to MCP.
    *   **Impact:** For a server handling multiple requests, synchronous file I/O can block the event loop, reducing throughput.
    *   **Action:** Change `fs.readFileSync` to its asynchronous counterpart `fs.readFile` (promisified or with a callback) to avoid blocking.
    *   **Priority:** Low (Optimization/Best Practice)

74. **Dependency Check for `canvas` in `ImageAnalysisService`:**
    *   **File:** [`packages/server/src/services/ai/imageAnalysisService.ts`](packages/server/src/services/ai/imageAnalysisService.ts:12)
    *   **Issue:** The service uses the `canvas` library for local image processing.
    *   **Action:** Ensure `canvas` is listed as a dependency in `packages/server/package.json`. Note that `canvas` often has native build dependencies (Cairo, Pango, etc.) that need to be present on the server environment.
    *   **Priority:** Low (Build/runtime check)

75. **Logger Inconsistency in `ImageAnalysisService`:**
    *   **File:** [`packages/server/src/services/ai/imageAnalysisService.ts`](packages/server/src/services/ai/imageAnalysisService.ts:7)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

76. **Dependency Check for `axios` in `VisualReferenceTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/visual-reference-training.ts`](packages/server/src/services/ai/visual-reference-training.ts:10)
    *   **Issue:** Uses `axios` for downloading images.
    *   **Action:** Ensure `axios` is listed as a dependency in `packages/server/package.json`.
    *   **Priority:** Low (Build/runtime check)

77. **Logger Inconsistency in `VisualReferenceTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/visual-reference-training.ts`](packages/server/src/services/ai/visual-reference-training.ts:9)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

78. **Database Schema for `VisualReferenceTrainingService` Tables (Observation):**
    *   **File:** [`packages/server/src/services/ai/visual-reference-training.ts`](packages/server/src/services/ai/visual-reference-training.ts:1)
    *   **Issue:** Interacts with `ml_datasets` and `ml_models` tables.
    *   **Action:** Ensure these tables are correctly defined in Supabase migrations.
    *   **Priority:** Low (Observation)

79. **Dependency Check for `@tensorflow/tfjs-node` in `PropertyPredictionService`:**
    *   **File:** [`packages/server/src/services/ai/property-prediction/propertyPredictionService.ts`](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:10)
    *   **Issue:** Uses `@tensorflow/tfjs-node`.
    *   **Action:** Ensure it's in `packages/server/package.json`.
    *   **Priority:** Low (Build/runtime check)

80. **Logger Inconsistency in `PropertyPredictionService`:**
    *   **File:** [`packages/server/src/services/ai/property-prediction/propertyPredictionService.ts`](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:9)
    *   **Issue:** Uses `logger` from `../../../utils/logger` (different relative path).
    *   **Action:** Align with the project-wide logging strategy and consistent pathing.
    *   **Priority:** Low

81. **Logger Inconsistency in `RelationshipFeatureExtractor`:**
    *   **File:** [`packages/server/src/services/ai/property-prediction/relationshipFeatureExtractor.ts`](packages/server/src/services/ai/property-prediction/relationshipFeatureExtractor.ts:10)
    *   **Issue:** Uses `logger` from `../../../utils/logger` (different relative path).
    *   **Action:** Align with the project-wide logging strategy and consistent pathing.
    *   **Priority:** Low

82. **Logger Inconsistency in `RelationshipAwareTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:8)
    *   **Issue:** Uses `logger` from `../../../utils/logger` (different relative path).
    *   **Action:** Align with the project-wide logging strategy and consistent pathing.
    *   **Priority:** Low

83. **Database Schema for `RelationshipAwareTrainingService` Tables (Observation):**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:1)
    *   **Issue:** The service programmatically attempts to create `relationship_aware_training_jobs`, `relationship_aware_models`, and `relationship_aware_model_performance`. It also uses Prisma to interact with `PropertyRelationship`.
    *   **Action:** Ensure all necessary tables are defined via Supabase migrations (and Prisma schema is aligned if it's the source of truth for some tables). Remove programmatic table creation.
    *   **Priority:** Low (Observation, but linked to Critical #31)