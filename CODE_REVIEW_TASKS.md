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
        1.  **Immediately clarify the definitive source of truth for `materials` data and other entities.**
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

4.  **Flawed Vector Search Logic in SQL Function `search_materials_by_text`:**
    *   **File:** [`packages/server/src/services/supabase/migrations/006_enhanced_vector_storage.sql`](packages/server/src/services/supabase/migrations/006_enhanced_vector_storage.sql:120-170)
    *   **Issue:** Vector similarity part uses `ILIKE` match on `name` to find a single embedding, not valid semantic search.
    *   **Impact:** "Vector" component of `material_hybrid_search` RPC will be ineffective.
    *   **Action:** Redesign `search_materials_by_text` and `material_hybrid_search`. Convert `query_text` to `query_embedding` in application layer and pass to SQL for `pgvector` comparison.
    *   **Priority:** Critical

5.  **Placeholder Vector Indexing & Mongoose Misalignment in `searchIndex.model.ts`:**
    *   **File:** [`packages/server/src/models/searchIndex.model.ts`](packages/server/src/models/searchIndex.model.ts:544) (function `buildVectorIndex`).
    *   **Issue:**
        1.  The `buildVectorIndex` function is a placeholder and does not implement any logic for generating or storing vector embeddings.
        2.  This entire model uses Mongoose, implying it manages indexes in MongoDB. This contradicts the likely project direction towards Supabase/PostgreSQL and pgvector for vector search.
    *   **Impact:** Vector search capabilities non-functional; architectural conflict.
    *   **Action:** Clarify database strategy. If Supabase/pgvector, this model is misaligned. `buildVectorIndex` should be removed or re-purposed. If MongoDB Atlas Search, `buildVectorIndex` needs full implementation.
    *   **Priority:** Critical (Linked to #2)

6.  **Overly Permissive RLS Policies for Message Broker Tables:**
    *   **File:** [`packages/server/src/services/supabase/migrations/005_message_broker.sql`](packages/server/src/services/supabase/migrations/005_message_broker.sql:82-131)
    *   **Issue:** RLS policies grant general `authenticated` users excessive CRUD permissions.
    *   **Impact:** Significant security risk to message broker data.
    *   **Action:** Redefine RLS policies to restrict access to appropriate service roles or specific users.
    *   **Priority:** Critical

7.  **Placeholder Implementations in Python RAG System (`hybrid_retriever.py`):**
    *   **File:** [`packages/ml/python/hybrid_retriever.py`](packages/ml/python/hybrid_retriever.py)
    *   **Issue:** Critical components are placeholders (LLM calls, vector client init, sparse embedding, metadata search).
    *   **Impact:** Core RAG functionality is missing or non-functional.
    *   **Action:** Implement placeholder methods: integrate real LLM client, connect to vector DB, use actual sparse embedding generation, implement metadata search.
    *   **Priority:** Critical

8.  **Partially Addressed: In-Memory Storage in `ModelRegistry` / Missing Evaluation Cycle Logic & `ModelRouter` Dependency:**
    *   **Files:** [`packages/server/src/services/ai/modelRegistry.ts`](packages/server/src/services/ai/modelRegistry.ts:1), [`packages/server/src/services/ai/modelRouter.ts`](packages/server/src/services/ai/modelRouter.ts:1)
    *   **Issue:** Core logic for rotation-based evaluation, `TaskCounter` management, and several key methods in `ModelRegistry` are missing or incomplete. `ModelRouter` depends heavily on these.
    *   **Impact:** Model evaluation and routing system non-functional or incomplete.
    *   **Action:** Verify/create DB schemas. Implement missing `ModelRegistry` methods using database tables.
    *   **Priority:** Critical

9.  **Untrained Projection Layers in Embedding Generation:**
    *   **Files:** [`packages/ml/python/embedding_generator.py`](packages/ml/python/embedding_generator.py:1), [`packages/ml/python/enhanced_text_embeddings.py`](packages/ml/python/enhanced_text_embeddings.py:1)
    *   **Issue:** Added projection layers are not trained; truncation/padding distorts embeddings.
    *   **Impact:** Very low-quality embeddings, undermining similarity search.
    *   **Action:** Fine-tune projection layers or use base models with native output dimensions. Address PCA fitting. Re-evaluate `HybridEmbedding`.
    *   **Priority:** Critical

10. **Disconnected General Material Recognition Logic:**
    *   **File:** [`packages/server/src/services/recognition/material-recognizer-service.ts`](packages/server/src/services/recognition/material-recognizer-service.ts:256-329)
    *   **Issue:** Uses simplified direct feature extraction, not the sophisticated Python pipeline.
    *   **Impact:** Basic, poorly performing general material recognition.
    *   **Action:** Refactor to invoke `material_recognizer.py` script.
    *   **Priority:** Critical

11. **Simulated/Incomplete Logic in `ExternalLibraryManager` Components:**
    *   **File:** [`packages/server/src/services/recognition/external-library-integration.ts`](packages/server/src/services/recognition/external-library-integration.ts:1)
    *   **Issue:** JS fallbacks for OpenCV; `isolatePattern` simulates mask; `extractWaveletFeatures` placeholder; `PyTorchIntegration` missing.
    *   **Impact:** Inefficient or non-functional image processing.
    *   **Action:** Implement native OpenCV calls, actual mask application, wavelet extraction, and `PyTorchIntegration`.
    *   **Priority:** Critical

12. **Non-Functional UI Theming in `HeroUIProvider.tsx`:**
    *   **File:** [`packages/client/src/providers/HeroUIProvider.tsx`](packages/client/src/providers/HeroUIProvider.tsx:28-30)
    *   **Issue:** Uses placeholder `<div>` instead of actual HeroUI `ThemeProvider`.
    *   **Impact:** HeroUI components likely not themed correctly.
    *   **Action:** Implement with actual `ThemeProvider` from `@heroui/react`.
    *   **Priority:** Critical

13. **Missing API Call Implementation in `OfflineProvider.executeQueuedActions`:**
    *   **File:** [`packages/client/src/providers/OfflineProvider.tsx`](packages/client/src/providers/OfflineProvider.tsx:352-354)
    *   **Issue:** Offline action execution is a placeholder.
    *   **Impact:** Offline actions queued but never synced.
    *   **Action:** Implement API calls for each `OfflineActionType`.
    *   **Priority:** Critical

14. **OfflineProvider: Missing True Resource Caching:**
    *   **File:** [`packages/client/src/providers/OfflineProvider.tsx`](packages/client/src/providers/OfflineProvider.tsx:416-418)
    *   **Issue:** No actual binary resource caching.
    *   **Impact:** App cannot display fetched resources offline.
    *   **Action:** Implement resource caching using Cache API / IndexedDB.
    *   **Priority:** Critical

15. **`MaterialsPage.tsx` Uses Mock Data and Client-Side Filtering:**
    *   **File:** [`packages/client/src/pages/materials.tsx`](packages/client/src/pages/materials.tsx:1)
    *   **Issue:** Uses mock data, client-side filtering, no `SearchFilterProvider`.
    *   **Impact:** Page doesn't display real data, performs poorly.
    *   **Action:** Remove mock data, integrate `SearchFilterProvider`, implement API data fetching.
    *   **Priority:** Critical

16. **Mocked AI Detection in `ImageUploader.tsx`:**
    *   **File:** [`packages/client/src/components/ImageUploader.tsx`](packages/client/src/components/ImageUploader.tsx:160-292)
    *   **Issue:** `detectMaterials` function is entirely mocked.
    *   **Impact:** AI detection feature non-functional.
    *   **Action:** Replace mock with actual API calls.
    *   **Priority:** Critical

17. **Missing MoodBoard Database Schema:**
    *   **Files:** New migration file needed.
    *   **Issue:** DB tables for MoodBoards not defined.
    *   **Impact:** MoodBoard feature non-functional.
    *   **Action:** Create SQL migration for `moodboards`, `moodboard_items`, `moodboard_collaborators` with RLS.
    *   **Priority:** Critical

18. **Missing/Misused Shared `apiClient.ts` for Client-Side API Calls:**
    *   **Files:** [`packages/client/src/services/materialService.ts`](packages/client/src/services/materialService.ts:10), [`packages/client/src/services/recognitionService.ts`](packages/client/src/services/recognitionService.ts:9), [`packages/shared/src/services/api/apiClient.ts`](packages/shared/src/services/api/apiClient.ts:1)
    *   **Issue:** Client services not consistently using shared `apiClient`.
    *   **Impact:** Inconsistent API calls, runtime errors.
    *   **Action:** Correct imports to use `@kai/shared/services/api/apiClient`.
    *   **Priority:** Critical

19. **Missing OpenTelemetry SDK Initialization in `tracingInitializer.ts`:**
    *   **File:** [`packages/shared/src/services/tracing/tracingInitializer.ts`](packages/shared/src/services/tracing/tracingInitializer.ts:1)
    *   **Issue:** Only instantiates `OpenTelemetryProvider`, no SDK setup.
    *   **Impact:** No trace data exported.
    *   **Action:** Include full OTel SDK setup in `initializeOpenTelemetryTracing`.
    *   **Priority:** Critical

20. **Mocked Embedding Generation in `QueryUnderstandingService`:**
    *   **File:** [`packages/server/src/services/search/query-understanding-service.ts`](packages/server/src/services/search/query-understanding-service.ts:306)
    *   **Issue:** `generateQueryEmbedding` uses a mock implementation.
    *   **Impact:** Core semantic understanding non-functional.
    *   **Action:** Replace mock with calls to a real embedding service.
    *   **Priority:** Critical

21. **Missing JWT Secret Handling in `sessionManager.service.ts`:**
    *   **File:** [`packages/server/src/services/auth/sessionManager.service.ts`](packages/server/src/services/auth/sessionManager.service.ts:96)
    *   **Issue:** Used a default hardcoded JWT secret.
    *   **Impact:** Predictable JWTs if env var not set.
    *   **Action:** Removed default fallback. Ensure `JWT_SECRET` configured via `UnifiedConfig`.
    *   **Priority:** Critical

22. **TypeScript Compilation Errors in Auth Services:**
    *   **Files:** [`packages/server/src/services/auth/sessionManager.service.ts`](packages/server/src/services/auth/sessionManager.service.ts:1), [`packages/server/src/services/auth/twoFactor.service.ts`](packages/server/src/services/auth/twoFactor.service.ts:1)
    *   **Issue:** Multiple TypeScript errors due to missing dependencies and type issues.
    *   **Impact:** Prevents `packages/server` compilation. Core auth broken.
    *   **Action:** Resolve Node.js/Yarn issues. Install missing dependencies (`jsonwebtoken`, `ua-parser-js`, `geoip-lite`, `speakeasy`, `qrcode`, and types). Address type/declaration issues.
    *   **Priority:** Critical

23. **Circular Dependency in `supabaseClient.js` on Server:**
    *   **File:** [`packages/server/src/services/supabase/supabaseClient.js`](packages/server/src/services/supabase/supabaseClient.js:7) (Now likely `supabaseClient.ts`)
    *   **Issue:** Attempted to re-export `supabaseClient` from itself.
    *   **Impact:** Runtime error, breaking Supabase interactions.
    *   **Action:** Ensure correct re-export from shared package.
    *   **Priority:** Critical

24. **TypeScript Module Resolution Issues Between Packages:**
    *   **Files:** Various files in `packages/server` importing from `packages/shared`.
    *   **Issue:** TypeScript cannot resolve modules from `packages/shared`.
    *   **Impact:** Prevents `packages/server` compilation.
    *   **Action:** Review `tsconfig.json` for paths/references. Verify `packages/shared` build.
    *   **Priority:** Critical

25. **Flawed Type Safety Approach in `SupabaseHelper`:**
    *   **File:** [`packages/server/src/services/supabase/supabaseHelper.ts`](packages/server/src/services/supabase/supabaseHelper.ts:1)
    *   **Issue:** Casts Supabase client query builder to custom interface `SupabaseFilterBuilder<T>`.
    *   **Impact:** Bypasses Supabase client's type system, risk of runtime errors.
    *   **Action:** Refactor/remove `SupabaseHelper`. Use Supabase client directly with generated types.
    *   **Priority:** Critical

26. **Local Filesystem Reliance in `VisualReferenceTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/visual-reference-training.ts`](packages/server/src/services/ai/visual-reference-training.ts:1)
    *   **Issue:** Uses local filesystem for datasets, images, metadata, models.
    *   **Impact:** Unsuitable for server deployments. Data loss risk.
    *   **Action:** Refactor to use shared object storage.
    *   **Priority:** Critical

27. **Local Filesystem Reliance in `PropertyPredictionService`:**
    *   **File:** [`packages/server/src/services/ai/property-prediction/propertyPredictionService.ts`](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:1)
    *   **Issue:** Saves/loads TF.js models locally.
    *   **Impact:** Unsuitable for server environments.
    *   **Action:** Refactor to use shared object storage.
    *   **Priority:** Critical

28. **Simulated Model Training in `VisualReferenceTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/visual-reference-training.ts`](packages/server/src/services/ai/visual-reference-training.ts:102)
    *   **Issue:** `trainModel` only simulates training.
    *   **Impact:** Core functionality non-functional.
    *   **Action:** Implement actual model training.
    *   **Priority:** Critical

29. **Placeholder ML Pipeline in `RelationshipAwareTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:1)
    *   **Issue:** Core ML functionalities are placeholders.
    *   **Impact:** Service non-functional for its primary purpose.
    *   **Action:** Implement actual ML logic.
    *   **Priority:** Critical

30. **Local Filesystem Usage in `RelationshipAwareTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:1)
    *   **Issue:** Saves/loads model artifacts locally.
    *   **Impact:** Unsuitable for server environments.
    *   **Action:** Refactor to use shared object storage.
    *   **Priority:** Critical

31. **Programmatic Table Creation in `RelationshipAwareTrainingService.ensureTables`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:110)
    *   **Issue:** Programmatically creates tables via `execute_sql`.
    *   **Impact:** Anti-pattern, risks inconsistencies.
    *   **Action:** Remove `ensureTables`; define schemas in migrations.
    *   **Priority:** Critical

32. **Filesystem Usage for TensorFlow.js Model Serialization in `PromptMLService`:**
    *   **File:** [`packages/server/src/services/ai/promptMLService.ts`](packages/server/src/services/ai/promptMLService.ts:1265)
    *   **Issue:** Uses local temporary path for model serialization.
    *   **Impact:** Problematic for server environments.
    *   **Action:** Refactor for in-memory buffer operations and DB storage.
    *   **Priority:** Critical

33. **Simulated Core Auth Logic in `SessionController`:**
    *   **File:** [`packages/server/src/controllers/auth/session.controller.ts`](packages/server/src/controllers/auth/session.controller.ts:1)
    *   **Issue:** `registerUser`, `loginUser`, `verifyEmailHandler` use simulated logic.
    *   **Impact:** Core user auth non-functional.
    *   **Action:** Refactor to use Supabase Auth.
    *   **Priority:** Critical

34. **Database Inconsistency for Session Data in `SessionController`:**
    *   **Files:** [`packages/server/src/controllers/auth/session.controller.ts`](packages/server/src/controllers/auth/session.controller.ts:1), [`packages/server/src/models/userSession.model.ts`](packages/server/src/models/userSession.model.ts:1), [`packages/server/src/services/auth/sessionManager.service.ts`](packages/server/src/services/auth/sessionManager.service.ts:1)
    *   **Issue:** Uses Mongoose `userSession.model.ts` (MongoDB) conflicting with `sessionManager.service.ts`.
    *   **Impact:** Inconsistent session data management.
    *   **Action:** Clarify session store. If Supabase, deprecate Mongoose model, refactor.
    *   **Priority:** Critical (Linked to #2)

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

14. **Flawed `/api/materials/similar/:id` Endpoint in `material.routes.ts`:**
    *   **File:** [`packages/server/src/routes/material.routes.ts`](packages/server/src/routes/material.routes.ts:289-339)
    *   **Issue:** Uses the Mongoose `findSimilarMaterials`.
    *   **Impact:** Endpoint non-functional for similarity search.
    *   **Action:** Refactor to use `EnhancedVectorServiceImpl` or correct Supabase RPC.
    *   **Priority:** High

15. **Non-functional/Misaligned Material Recognition Endpoint (`/api/materials/recognition`) in `material.routes.ts`:**
    *   **File:** [`packages/server/src/routes/material.routes.ts`](packages/server/src/routes/material.routes.ts:434-499)
    *   **Issue:** Directly calls `@kai/ml`, uses Mongoose `getMaterialById` in loop.
    *   **Impact:** Inefficient, outdated data sources, bypasses service architecture.
    *   **Action:** Refactor to use `MaterialRecognizerService`, ensure efficient Supabase data fetching.
    *   **Priority:** High

16. **Configuration and Backend Dependencies for 3D Visualization (`MaterialVisualizer.tsx`):**
    *   **Files:** [`packages/client/src/components/MaterialVisualizer.tsx`](packages/client/src/components/MaterialVisualizer.tsx:35-51), `MaterialVisualizationProvider`
    *   **Action:** Move endpoints to `UnifiedConfig`; ensure backend services implemented/deployed.
    *   **Priority:** High

17. **Auth Provider Initialization for Shared `AuthService`:**
    *   **Files:** [`packages/shared/src/services/auth/authService.ts`](packages/shared/src/services/auth/authService.ts:1), client app init.
    *   **Action:** Ensure `auth.setProvider(new SupabaseAuthProvider(...))` called at app startup.
    *   **Priority:** High

18. **Supabase Token Refresh Logic in `SupabaseAuthProvider`:**
    *   **Files:** [`packages/shared/src/services/auth/supabaseAuthProvider.ts`](packages/shared/src/services/auth/supabaseAuthProvider.ts:1), [`packages/shared/src/services/auth/authService.ts`](packages/shared/src/services/auth/authService.ts:1)
    *   **Action:** Review `SupabaseAuthProvider.refreshToken()` for correct Supabase SDK usage.
    *   **Priority:** High

19. **Dependency on `materialRecognitionProvider` in `RecognitionDemo.tsx`:**
    *   **File:** [`packages/client/src/components/RecognitionDemo.tsx`](packages/client/src/components/RecognitionDemo.tsx:1)
    *   **Action:** Review `materialRecognitionProvider` implementation and API calls.
    *   **Priority:** High

20. **API Client Inconsistency & Hardcoded URL in `recognitionService.ts`:**
    *   **File:** [`packages/client/src/services/recognitionService.ts`](packages/client/src/services/recognitionService.ts:9)
    *   **Action:** Refactor to use shared `apiClient`.
    *   **Priority:** High

21. **Backend Endpoints for `recognitionService.ts`:**
    *   **File:** [`packages/client/src/services/recognitionService.ts`](packages/client/src/services/recognitionService.ts:1)
    *   **Action:** Verify/update/deprecate backend routes.
    *   **Priority:** High

22. **Cache Service Initialization:**
    *   **Files:** [`packages/shared/src/services/cache/cacheInitializer.ts`](packages/shared/src/services/cache/cacheInitializer.ts:1), [`packages/shared/src/services/api/apiClient.ts`](packages/shared/src/services/api/apiClient.ts:1)
    *   **Action:** Ensure `initializeCache()` called at startup; verify `UnifiedConfig`.
    *   **Priority:** High

23. **`UnifiedConfig.init()` Call Timing:**
    *   **Files:** `UnifiedConfig.ts`, service initializers.
    *   **Action:** Ensure `config.init()` called at absolute beginning of startup.
    *   **Priority:** High

24. **Bug in `TelemetryService.flush()` Error Handling (Re-buffering):**
    *   **File:** [`packages/shared/src/services/telemetry/telemetryService.ts`](packages/shared/src/services/telemetry/telemetryService.ts:546)
    *   **Action:** Correct to `this.buffer = [...events, ...this.buffer];`.
    *   **Priority:** High

25. **Missing or Misconfigured Shared Storage Service Abstraction:**
    *   **Files:** Missing [`packages/shared/src/services/storage/index.ts`](packages/shared/src/services/storage/index.ts:1), `storageService.ts`. [`packages/shared/src/services/recognition/materialProvider.ts`](packages/shared/src/services/recognition/materialProvider.ts:2) hardcodes S3.
    *   **Action:** Create `storageService.ts` with `StorageService` class, `storageInitializer.ts`.
    *   **Priority:** High

26. **Dependency on External `ML_SERVICE_URL` in `MaterialRecognitionProvider`:**
    *   **File:** [`packages/shared/src/services/recognition/materialProvider.ts`](packages/shared/src/services/recognition/materialProvider.ts:1)
    *   **Action:** Refactor to get `ML_SERVICE_URL` from `UnifiedConfig`.
    *   **Priority:** High

27. **Missing `create_conversation_table` RPC for `ConversationalSearchService`:**
    *   **File:** [`packages/server/src/services/search/conversational-search-service.ts`](packages/server/src/services/search/conversational-search-service.ts:129)
    *   **Action:** Define schema for `conversation_sessions` in migration. Remove RPC call.
    *   **Priority:** High

28. **Redundancy of `config.ts` with `unified-config.ts`:**
    *   **File:** [`packages/shared/src/utils/config.ts`](packages/shared/src/utils/config.ts:1)
    *   **Action:** Deprecate `config.ts`, use `unified-config.ts`.
    *   **Priority:** High

29. **Redundancy of `logger.ts` with `unified-logger.ts`:**
    *   **File:** [`packages/shared/src/utils/logger.ts`](packages/shared/src/utils/logger.ts:1)
    *   **Action:** Deprecate `logger.ts`, use `unified-logger.ts`.
    *   **Priority:** High

30. **Logger Inconsistency in `apiKeyManager.service.ts`:**
    *   **File:** [`packages/server/src/services/auth/apiKeyManager.service.ts`](packages/server/src/services/auth/apiKeyManager.service.ts:8)
    *   **Action:** Refactor to use `unified-logger.ts`.
    *   **Priority:** High

31. **Logger Inconsistency in `sessionManager.service.ts`:**
    *   **File:** [`packages/server/src/services/auth/sessionManager.service.ts`](packages/server/src/services/auth/sessionManager.service.ts:11)
    *   **Action:** Refactor to use `unified-logger.ts`.
    *   **Priority:** High

32. **Logger Inconsistency in `twoFactor.service.ts`:**
    *   **File:** [`packages/server/src/services/auth/twoFactor.service.ts`](packages/server/src/services/auth/twoFactor.service.ts:10)
    *   **Action:** Refactor to use `unified-logger.ts`.
    *   **Priority:** High

33. **Effectiveness of `SupabaseHybridSearch` Relies on RPC Correctness:**
    *   **File:** [`packages/server/src/services/supabase/hybrid-search.ts`](packages/server/src/services/supabase/hybrid-search.ts:1)
    *   **Action:** Critically review SQL definitions of `hybrid_search_materials` and `hybrid_search` RPCs.
    *   **Priority:** High (Linked to Critical Issue #4)

34. **Verification of `find_similar_materials` RPC in `SupabaseMaterialService`:**
    *   **File:** [`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:369)
    *   **Action:** Review SQL definition of `find_similar_materials` RPC.
    *   **Priority:** High (Linked to Critical Issue #3)

35. **Potential Flaw in `EnhancedVectorServiceImpl.searchMaterials` via `material_hybrid_search` RPC:**
    *   **File:** [`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:396)
    *   **Action:** Verify RPC fix or generate embeddings in app layer.
    *   **Priority:** High (Linked to Critical Issue #4)

36. **Dependency on Potentially Incomplete Python Scripts in `EnhancedVectorServiceImpl`:**
    *   **File:** [`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:1)
    *   **Action:** Prioritize `hybrid_retriever.py` implementation. Review `context_assembler.py`.
    *   **Priority:** High (Linked to Critical Issue #7)

37. **Architectural Concern: Embedded ML Pipeline in `PromptMLService`:**
    *   **File:** [`packages/server/src/services/ai/promptMLService.ts`](packages/server/src/services/ai/promptMLService.ts:1)
    *   **Action:** Evaluate offloading model training.
    *   **Priority:** High (Architectural)

38. **Incorrect One-Hot Encoding Placeholder in `PropertyPredictionService`:**
    *   **File:** [`packages/server/src/services/ai/property-prediction/propertyPredictionService.ts`](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:1)
    *   **Action:** Implement proper one-hot encoding or use embedding layers.
    *   **Priority:** High (Bug affecting core ML)

39. **Supabase Client Import Path in `PropertyPredictionService`:**
    *   **File:** [`packages/server/src/services/ai/property-prediction/propertyPredictionService.ts`](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:11)
    *   **Action:** Align with standard Supabase client import.
    *   **Priority:** High

40. **Supabase Client Import Path in `VisualReferenceTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/visual-reference-training.ts`](packages/server/src/services/ai/visual-reference-training.ts:14)
    *   **Action:** Align with standard Supabase client import.
    *   **Priority:** High

41. **Implement Placeholder Rules in `PromptOptimizationService`:**
    *   **File:** [`packages/server/src/services/ai/promptOptimizationService.ts`](packages/server/src/services/ai/promptOptimizationService.ts:1)
    *   **Action:** Implement logic for placeholder rule types.
    *   **Priority:** High

42. **Potential Bug in `PromptService.renderPrompt` by Name:**
    *   **File:** [`packages/server/src/services/ai/promptService.ts`](packages/server/src/services/ai/promptService.ts:582)
    *   **Action:** Update `PromptRenderOptions` or remove logic path.
    *   **Priority:** High

43. **Incorrect Categorical Feature Encoding in `RelationshipAwareTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:1356)
    *   **Action:** Implement proper encoding.
    *   **Priority:** High (Bug affecting core ML)

44. **Supabase Client Import Path in `RelationshipAwareTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:10)
    *   **Action:** Standardize Supabase client import paths.
    *   **Priority:** High

45. **Client Dependencies for `ContextAssembler` (`context_assembler.py`):**
    *   **File:** [`packages/ml/python/context_assembler.py`](packages/ml/python/context_assembler.py:1)
    *   **Action:** Review actual client implementations.
    *   **Priority:** High

46. **Configuration for `CLIENT_URL` in `passwordReset.controller.ts`:**
    *   **File:** [`packages/server/src/controllers/auth/passwordReset.controller.ts`](packages/server/src/controllers/auth/passwordReset.controller.ts:61)
    *   **Issue:** Uses `process.env.CLIENT_URL` directly.
    *   **Impact:** Bypasses centralized configuration management.
    *   **Action:** Source `CLIENT_URL` from `UnifiedConfig` for consistency.
    *   **Priority:** High

47. **Logger Inconsistency in `passwordReset.controller.ts`:**
    *   **File:** [`packages/server/src/controllers/auth/passwordReset.controller.ts`](packages/server/src/controllers/auth/passwordReset.controller.ts:9)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Impact:** Inconsistent logging practices.
    *   **Action:** Refactor to use the project's standard `unified-logger`.
    *   **Priority:** High

48. **Supabase Client Import in `passwordReset.controller.ts`:**
    *   **File:** [`packages/server/src/controllers/auth/passwordReset.controller.ts`](packages/server/src/controllers/auth/passwordReset.controller.ts:11)
    *   **Issue:** Imports `supabaseClient` from `../../services/supabase/supabaseClient`.
    *   **Impact:** Potential inconsistency if this doesn't align with the project-wide standardized Supabase client.
    *   **Action:** Verify and align with the standard Supabase client import path.
    *   **Priority:** High

49. **Logger Inconsistency in `session.controller.ts`:**
    *   **File:** [`packages/server/src/controllers/auth/session.controller.ts`](packages/server/src/controllers/auth/session.controller.ts:9)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Impact:** Inconsistent logging practices.
    *   **Action:** Refactor to use the project's standard `unified-logger`.
    *   **Priority:** High

50. **Password Validation in `session.controller.ts` (`registerUser`):**
    *   **File:** [`packages/server/src/controllers/auth/session.controller.ts`](packages/server/src/controllers/auth/session.controller.ts:45)
    *   **Issue:** Contains password validation regex.
    *   **Impact:** Duplicates validation logic if also handled by Supabase Auth or a shared utility.
    *   **Action:** If custom registration logic is retained (unlikely given Supabase Auth integration - see Critical Issue #33), centralize password validation. Otherwise, this will be removed when refactoring to Supabase Auth.
    *   **Priority:** High (Contingent on Critical Issue #33 resolution)

51. **Logger Inconsistency in `twoFactor.controller.ts`:**
    *   **File:** [`packages/server/src/controllers/auth/twoFactor.controller.ts`](packages/server/src/controllers/auth/twoFactor.controller.ts:9)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Impact:** Inconsistent logging practices.
    *   **Action:** Refactor to use the project's standard `unified-logger`.
    *   **Priority:** High

52. **Database Model Dependency for 2FA Settings (`twoFactor.model.ts`):**
    *   **File:** [`packages/server/src/controllers/auth/twoFactor.controller.ts`](packages/server/src/controllers/auth/twoFactor.controller.ts:12-16) (imports from `../../models/twoFactor.model.ts`)
    *   **Issue:** If `twoFactor.model.ts` uses Mongoose, 2FA settings would be stored in MongoDB, conflicting with the likely primary database being Supabase.
    *   **Impact:** Inconsistent data storage for 2FA settings, potential data management issues.
    *   **Action:** Clarify the definitive database for 2FA settings. If Supabase is the target, refactor `twoFactor.model.ts` or replace with Supabase-compatible data access. Ensure `two_factor_settings` table schema is in Supabase migrations.
    *   **Priority:** High (Linked to Critical Issue #2)

53. **Logger Inconsistency in `proratedBilling.service.ts`:**
    *   **File:** [`packages/server/src/services/billing/proratedBilling.service.ts`](packages/server/src/services/billing/proratedBilling.service.ts:8)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Impact:** Inconsistent logging practices.
    *   **Action:** Refactor to use the project's standard `unified-logger`.
    *   **Priority:** High

54. **Database Model Dependencies in `proratedBilling.service.ts`:**
    *   **Files:** [`packages/server/src/services/billing/proratedBilling.service.ts`](packages/server/src/services/billing/proratedBilling.service.ts:1) (imports `../../models/userSubscription.model.ts` and `../../models/subscriptionTier.model.ts`)
    *   **Issue:** If these models use Mongoose, this service relies on MongoDB for subscription/tier data, conflicting with the likely primary Supabase database.
    *   **Impact:** Billing operations might use data from a non-primary, potentially inconsistent data store.
    *   **Action:** Clarify the definitive database for subscription and tier data. If Supabase is the target, refactor models for Supabase compatibility and ensure schemas are in Supabase migrations.
    *   **Priority:** High (Linked to Critical Issue #2)

55. **Dependency on `stripeService` in `proratedBilling.service.ts`:**
    *   **File:** [`packages/server/src/services/billing/proratedBilling.service.ts`](packages/server/src/services/billing/proratedBilling.service.ts:11) (imports `../payment/stripeService`)
    *   **Issue:** Functionality heavily depends on the correctness of `stripeService`.
    *   **Impact:** Issues in `stripeService` will directly affect billing.
    *   **Action:** Ensure `stripeService` is thoroughly reviewed, uses `UnifiedConfig` for API keys, handles errors robustly, and Stripe API interactions are correct.
    *   **Priority:** High (Dependency on critical external service integration)

56. **Logger Inconsistency in `materialComparisonService.ts`:**
    *   **File:** [`packages/server/src/services/comparison/materialComparisonService.ts`](packages/server/src/services/comparison/materialComparisonService.ts:7)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Impact:** Inconsistent logging practices.
    *   **Action:** Refactor to use the project's standard `unified-logger`.
    *   **Priority:** High

57. **Prisma Client Import and Configuration in `materialComparisonService.ts`:**
    *   **File:** [`packages/server/src/services/comparison/materialComparisonService.ts`](packages/server/src/services/comparison/materialComparisonService.ts:8)
    *   **Issue:** Imports `prisma` from `../prisma`. This needs to align with the project's standard for Prisma client instantiation and ensure it's configured for the primary database (Supabase).
    *   **Impact:** Potential use of an incorrect or isolated Prisma client, leading to data inconsistencies if not targeting the primary database.
    *   **Action:** Ensure the Prisma client is correctly configured and imported according to project standards, targeting the definitive primary database.
    *   **Priority:** High (Linked to Critical Issue #2)

58. **Database Table Dependencies in `materialComparisonService.ts`:**
    *   **File:** [`packages/server/src/services/comparison/materialComparisonService.ts`](packages/server/src/services/comparison/materialComparisonService.ts:1)
    *   **Issue:** Relies on Prisma models for `material` and implicitly a `comparison_results` table.
    *   **Impact:** Service failure or incorrect results if tables are not in the primary Supabase DB or schemas are misaligned.
    *   **Action:** Ensure `material` table schema in Prisma matches Supabase. Define `comparison_results` schema in Supabase migrations and update Prisma schema.
    *   **Priority:** High (Linked to Critical Issue #2)

59. **Logger Inconsistency in `creditService.ts`:**
    *   **File:** [`packages/server/src/services/credit/creditService.ts`](packages/server/src/services/credit/creditService.ts:8)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Impact:** Inconsistent logging practices.
    *   **Action:** Refactor to use the project's standard `unified-logger`.
    *   **Priority:** High

60. **Database Model Dependencies in `creditService.ts`:**
    *   **Files:** [`packages/server/src/services/credit/creditService.ts`](packages/server/src/services/credit/creditService.ts:1) (imports `../../models/userCredit.model.ts` and `../../models/serviceCost.model.ts`)
    *   **Issue:** If these models use Mongoose, this service relies on MongoDB for credit and service cost data, conflicting with the likely primary Supabase database.
    *   **Impact:** Credit management and service cost calculations might be based on data from a non-primary, potentially out-of-sync database.
    *   **Action:** Clarify the definitive database for user credits and service costs. If Supabase is the target, refactor models for Supabase compatibility and ensure schemas for `user_credits`, `credit_transactions`, and `service_costs` are in Supabase migrations.
    *   **Priority:** High (Linked to Critical Issue #2)

61. **Logger Inconsistency in `alertManager.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/alertManager.service.ts`](packages/server/src/services/credit/alertManager.service.ts:8)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Impact:** Inconsistent logging practices.
    *   **Action:** Refactor to use the project's standard `unified-logger`.
    *   **Priority:** High

62. **Database Model Dependencies in `alertManager.service.ts`:**
    *   **Files:** [`packages/server/src/services/credit/alertManager.service.ts`](packages/server/src/services/credit/alertManager.service.ts:1) (imports `../../models/creditAlert.model.ts` and `../../models/userCredit.model.ts`)
    *   **Issue:** If these models use Mongoose, this service relies on MongoDB for alert and credit data, conflicting with the likely primary Supabase database.
    *   **Impact:** Alerting system might operate on data from a non-primary, potentially out-of-sync database.
    *   **Action:** Clarify the definitive database for these entities. If Supabase, refactor models for Supabase compatibility. Ensure `credit_alert_settings`, `credit_alert_history`, and `user_credits` table schemas are in Supabase migrations.
    *   **Priority:** High (Linked to Critical Issue #2)

63. **Supabase Client Import in `alertManager.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/alertManager.service.ts`](packages/server/src/services/credit/alertManager.service.ts:18)
    *   **Issue:** Imports `supabaseClient` from `../supabase/supabaseClient`.
    *   **Impact:** Needs to align with the standardized Supabase client instance.
    *   **Action:** Verify and align with the standard Supabase client import path.
    *   **Priority:** High

64. **External Service Dependencies in `alertManager.service.ts`:**
    *   **Files:** [`packages/server/src/services/credit/alertManager.service.ts`](packages/server/src/services/credit/alertManager.service.ts:1) (imports `emailService`, `smsService`, `axios`)
    *   **Issue:** Reliability of alert delivery depends on these external services and webhook calls.
    *   **Impact:** Failures or misconfigurations will prevent alert delivery.
    *   **Action:** Ensure `emailService`, `smsService` are robust, use `UnifiedConfig` for credentials, and handle errors gracefully. Implement robust error handling and consider retries for webhook calls.
    *   **Priority:** High

65. **Logger Inconsistency in `autoTopup.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/autoTopup.service.ts`](packages/server/src/services/credit/autoTopup.service.ts:8)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Impact:** Inconsistent logging practices.
    *   **Action:** Refactor to use the project's standard `unified-logger`.
    *   **Priority:** High

66. **Database Model Dependencies in `autoTopup.service.ts`:**
    *   **Files:** [`packages/server/src/services/credit/autoTopup.service.ts`](packages/server/src/services/credit/autoTopup.service.ts:1) (imports `../../models/creditTopup.model.ts` and `../../models/userCredit.model.ts`)
    *   **Issue:** If these models use Mongoose, this service relies on MongoDB for top-up and credit data, conflicting with the likely primary Supabase database.
    *   **Impact:** Auto top-up functionality might operate on data from a non-primary, potentially out-of-sync database.
    *   **Action:** Clarify the definitive database for these entities. If Supabase, refactor models for Supabase compatibility. Ensure `credit_topup_settings`, `credit_topup_history`, and `user_credits` table schemas are in Supabase migrations.
    *   **Priority:** High (Linked to Critical Issue #2)

67. **External and Internal Service Dependencies in `autoTopup.service.ts`:**
    *   **Files:** [`packages/server/src/services/credit/autoTopup.service.ts`](packages/server/src/services/credit/autoTopup.service.ts:1) (imports `stripeService` and `bulkPurchaseService`)
    *   **Issue:** Core functionality depends on the correctness of `stripeService` (for payments) and `bulkPurchaseService` (for credit calculation/provisioning).
    *   **Impact:** Issues in these dependent services will directly affect auto top-up operations.
    *   **Action:** Ensure `stripeService` and `bulkPurchaseService` are thoroughly reviewed, use `UnifiedConfig` for necessary configurations, handle errors robustly, and their interactions are correct.
    *   **Priority:** High

68. **Logger Inconsistency in `bulkPurchase.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/bulkPurchase.service.ts`](packages/server/src/services/credit/bulkPurchase.service.ts:8)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Impact:** Inconsistent logging practices.
    *   **Action:** Refactor to use the project's standard `unified-logger`.
    *   **Priority:** High

69. **Database Model Dependencies in `bulkPurchase.service.ts`:**
    *   **Files:** [`packages/server/src/services/credit/bulkPurchase.service.ts`](packages/server/src/services/credit/bulkPurchase.service.ts:1) (imports `../../models/bulkCredit.model.ts` and `../../models/userCredit.model.ts`)
    *   **Issue:** If these models use Mongoose, this service relies on MongoDB for bulk package and credit data, conflicting with the likely primary Supabase database.
    *   **Impact:** Bulk purchase functionality might operate on data from a non-primary, potentially out-of-sync database.
    *   **Action:** Clarify the definitive database for these entities. If Supabase, refactor models for Supabase compatibility. Ensure `bulk_credit_packages`, `user_credits`, and `credit_transactions` table schemas are in Supabase migrations.
    *   **Priority:** High (Linked to Critical Issue #2)

70. **External and Internal Service Dependencies in `bulkPurchase.service.ts`:**
    *   **Files:** [`packages/server/src/services/credit/bulkPurchase.service.ts`](packages/server/src/services/credit/bulkPurchase.service.ts:1) (imports `stripeService`)
    *   **Issue:** Core purchasing functionality depends on the correctness of `stripeService` for payments.
    *   **Impact:** Issues in `stripeService` will directly affect credit purchases.
    *   **Action:** Ensure `stripeService` is thoroughly reviewed, uses `UnifiedConfig` for API keys, handles errors robustly, and Stripe API interactions are correct.
    *   **Priority:** High

71. **Logger Inconsistency in `transfer.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/transfer.service.ts`](packages/server/src/services/credit/transfer.service.ts:8)
    *   **Issue:** Uses `logger` from `../../utils/logger`.
    *   **Impact:** Inconsistent logging practices.
    *   **Action:** Refactor to use the project's standard `unified-logger`.
    *   **Priority:** High

72. **Database Model and Direct Supabase Client Usage in `transfer.service.ts`:**
    *   **Files:** [`packages/server/src/services/credit/transfer.service.ts`](packages/server/src/services/credit/transfer.service.ts:1) (imports `userCredit.model.ts` and `supabaseClient`)
    *   **Issue:** Relies on `userCredit.model.ts` (potentially Mongoose-based) for credit balance operations and directly uses `supabaseClient` for a `credit_transfers` table. This creates a high risk of operating across different, unaligned databases if `userCredit.model.ts` isn't using Supabase.
    *   **Impact:** Critical data inconsistency for credit transfers if `userCredit.model.ts` and `credit_transfers` table are in different databases.
    *   **Action:** Ensure `userCredit.model.ts` is refactored for Supabase. Define `credit_transfers` table schema in Supabase migrations. All credit-related operations must target the single, definitive Supabase database.
    *   **Priority:** High (Linked to Critical Issue #2)

73. **Atomicity of `transferCredits` Operation in `transfer.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/transfer.service.ts`](packages/server/src/services/credit/transfer.service.ts:40)
    *   **Issue:** The `transferCredits` function performs multiple sequential database operations (create transfer record, deduct credits, add credits, update transfer status) without a single overarching database transaction.
    *   **Impact:** High risk of data inconsistency (e.g., credits deducted but not received, or transfer record not reflecting the true outcome of operations).
    *   **Action:** Refactor the entire `transferCredits` logic into a single atomic Supabase database function (RPC) to ensure all steps succeed or fail together.
    *   **Priority:** High (Critical for financial/credit integrity)

74. **Supabase Client Import in `transfer.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/transfer.service.ts`](packages/server/src/services/credit/transfer.service.ts:14)
    *   **Issue:** Imports `supabaseClient` from `../supabase/supabaseClient`.
    *   **Impact:** Needs to align with the standardized Supabase client instance.
    *   **Action:** Verify and align with the standard Supabase client import path.
    *   **Priority:** High

## III. Medium Priority Issues & Refinements

(Consolidating and re-numbering items here.)

1.  **Unclear Rendering Logic in `MaterialVisualizer.tsx`** ([`packages/client/src/components/MaterialVisualizer.tsx`](packages/client/src/components/MaterialVisualizer.tsx:100-106))
2.  **Token Cancellation Logic in Shared `apiClient.ts`** ([`packages/shared/src/services/api/apiClient.ts`](packages/shared/src/services/api/apiClient.ts:1))
3.  **Error Propagation in `AuthService`** ([`packages/shared/src/services/auth/authService.ts`](packages/shared/src/services/auth/authService.ts:1))
4.  **Error Handling Granularity & Propagation (Server-side General)**
5.  **Ownership Checks for 'manager' Role in Modifying Material Routes** ([`packages/server/src/routes/material.routes.ts`](packages/server/src/routes/material.routes.ts:1))
6.  **Inconsistent Service Layer Usage in `material.routes.ts`** ([`packages/server/src/routes/material.routes.ts`](packages/server/src/routes/material.routes.ts:1))
7.  **Centralized Context Providers in `Layout.tsx`** ([`packages/client/src/components/Layout.tsx`](packages/client/src/components/Layout.tsx:1))
8.  **State Management Complexity in `ImageUploader.tsx`** ([`packages/client/src/components/ImageUploader.tsx`](packages/client/src/components/ImageUploader.tsx:1))
9.  **Accessibility of Interactive Elements in `ImageUploader.tsx`** ([`packages/client/src/components/ImageUploader.tsx`](packages/client/src/components/ImageUploader.tsx:1))
10. **Missing Action for "View Details" in `RecognitionDemo.tsx`** ([`packages/client/src/components/RecognitionDemo.tsx`](packages/client/src/components/RecognitionDemo.tsx:243))
11. **Generic Error Handling in Client Services (General)**
12. **`clear()` Method with Namespace (`KEYS`) in `RedisCacheProvider`** ([`packages/shared/src/services/cache/redisCacheProvider.ts`](packages/shared/src/services/cache/redisCacheProvider.ts:180))
13. **`clear()` Method without Namespace (`flushDb`) in `RedisCacheProvider`** ([`packages/shared/src/services/cache/redisCacheProvider.ts`](packages/shared/src/services/cache/redisCacheProvider.ts:188))
14. **Connection Management & Retries in `RedisCacheProvider`** ([`packages/shared/src/services/cache/redisCacheProvider.ts`](packages/shared/src/services/cache/redisCacheProvider.ts:1))
15. **`ADAPTIVE` Cache Warming Strategy Not Implemented** ([`packages/shared/src/services/cache/cacheWarming.ts`](packages/shared/src/services/cache/cacheWarming.ts:32))
16. **Cron Parsing and Scheduling Robustness (`cron-parser.ts`)** ([`packages/shared/src/utils/cron-parser.ts`](packages/shared/src/utils/cron-parser.ts:1))
17. **Timezone Handling in `getNextExecutionTime` (`cron-parser.ts`)** ([`packages/shared/src/utils/cron-parser.ts`](packages/shared/src/utils/cron-parser.ts:393-404))
18. **Tag Storage for `invalidateByTag` in `CacheInvalidationService`** ([`packages/shared/src/services/cache/cacheInvalidation.ts`](packages/shared/src/services/cache/cacheInvalidation.ts:49))
19. **Client-Side Environment Variable Access for API URL in `UnifiedConfig`** ([`packages/shared/src/utils/unified-config.ts`](packages/shared/src/utils/unified-config.ts:320))
20. **Incomplete `validateAllConfig` in `configValidator.ts`** ([`packages/shared/src/utils/configValidator.ts`](packages/shared/src/utils/configValidator.ts:1))
21. **`API.BASE_URL` and `STORAGE.S3_BUCKET` Inconsistency in `constants.ts`** ([`packages/shared/src/utils/constants.ts`](packages/shared/src/utils/constants.ts:1))
22. **Hardcoded S3 Adapter Import in `MaterialRecognitionProvider`** ([`packages/shared/src/services/recognition/materialProvider.ts`](packages/shared/src/services/recognition/materialProvider.ts:2))
23. **Inconsistent Error Propagation in `MaterialRecognitionProvider`** ([`packages/shared/src/services/recognition/materialProvider.ts`](packages/shared/src/services/recognition/materialProvider.ts:1))
24. **Interface Mismatch for Download Operations in `storage/types.ts`** ([`packages/shared/src/services/storage/types.ts`](packages/shared/src/services/storage/types.ts:1))
25. **Clarify `StorageRetryOptions` Usage in `storage/types.ts` and Providers** ([`packages/shared/src/services/storage/types.ts`](packages/shared/src/services/storage/types.ts:1))
26. **Synchronous File Write in `SupabaseStorageProvider.downloadFile`** ([`packages/shared/src/services/storage/supabaseStorageProvider.ts`](packages/shared/src/services/storage/supabaseStorageProvider.ts:303))
27. **Configuration Path for Supabase in `SupabaseManager` Constructor** ([`packages/shared/src/services/supabase/supabaseClient.ts`](packages/shared/src/services/supabase/supabaseClient.ts:52-62))
28. **Error Handling in `PropertyInheritanceService.applyInheritance`** ([`packages/server/src/services/propertyInheritance/propertyInheritanceService.ts`](packages/server/src/services/propertyInheritance/propertyInheritanceService.ts:68))
29. **Placeholder Personalization Logic in `QueryUnderstandingService`** ([`packages/server/src/services/search/query-understanding-service.ts`](packages/server/src/services/search/query-understanding-service.ts:409-455))
30. **Missing `get_trending_queries` RPC for `QueryUnderstandingService`** ([`packages/server/src/services/search/query-understanding-service.ts`](packages/server/src/services/search/query-understanding-service.ts:551))
31. **Basic Entity Extraction in `ConversationalSearchService`** ([`packages/server/src/services/search/conversational-search-service.ts`](packages/server/src/services/search/conversational-search-service.ts:526-561))
32. **Heuristic Query Interpretation in `ConversationalSearchService`** ([`packages/server/src/services/search/conversational-search-service.ts`](packages/server/src/services/search/conversational-search-service.ts:566-630))
33. **Python Script Path Resolution in `EnhancedVectorServiceImpl`** ([`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:46))
34. **JSON String Filters in `SupabaseHybridSearch` Generic RPC** ([`packages/server/src/services/supabase/hybrid-search.ts`](packages/server/src/services/supabase/hybrid-search.ts:120))
35. **Lack of Database Transactions in `SupabaseDatasetService` Deletes** ([`packages/server/src/services/supabase/supabase-dataset-service.ts`](packages/server/src/services/supabase/supabase-dataset-service.ts:1))
36. **Redundant Material Versioning Call** ([`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:163), [`packages/server/src/services/supabase/supabase-schema.md`](packages/server/src/services/supabase/supabase-schema.md:353))
37. **Filename Mismatch for `SupabaseUtilityService`** ([`packages/server/src/services/supabase/supabase-sync.ts`](packages/server/src/services/supabase/supabase-sync.ts:1))
38. **N+1 Query in `ModelRegistry.getModelComparisons`** ([`packages/server/src/services/ai/modelRegistry.ts`](packages/server/src/services/ai/modelRegistry.ts:502))
39. **Placeholder Logic in `ModelRegistry.getModelComparisons` for Rankings** ([`packages/server/src/services/ai/modelRegistry.ts`](packages/server/src/services/ai/modelRegistry.ts:529-536))
40. **Hardcoded Model Costs in `ModelRouter.estimateCostPerToken`** ([`packages/server/src/services/ai/modelRouter.ts`](packages/server/src/services/ai/modelRouter.ts:650))
41. **N+1 Query Problem in `SupabaseMaterialService` Search Methods** ([`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:1))
42. **Lack of DB Transactions in `PromptService` Multi-Step Operations** ([`packages/server/src/services/ai/promptService.ts`](packages/server/src/services/ai/promptService.ts:1))
43. **Transaction Management in `PromptOptimizationService.executeCreateExperiment`** ([`packages/server/src/services/ai/promptOptimizationService.ts`](packages/server/src/services/ai/promptOptimizationService.ts:570))
44. **Data Integrity on `PromptService.deletePrompt`** ([`packages/server/src/services/ai/promptService.ts`](packages/server/src/services/ai/promptService.ts:492))
45. **Review RPC Dependencies in `PromptIntegrationService`** ([`packages/server/src/services/ai/promptIntegrationService.ts`](packages/server/src/services/ai/promptIntegrationService.ts:1))
46. **Transaction Management in `PromptMLService`** ([`packages/server/src/services/ai/promptMLService.ts`](packages/server/src/services/ai/promptMLService.ts:1))
47. **Feature Dimensionality/Sparsity in `RelationshipFeatureExtractor`** ([`packages/server/src/services/ai/property-prediction/relationshipFeatureExtractor.ts`](packages/server/src/services/ai/property-prediction/relationshipFeatureExtractor.ts:24))
48. **Basic Default Value Generation in `RelationshipFeatureExtractor.generateTrainingData`** ([`packages/server/src/services/ai/property-prediction/relationshipFeatureExtractor.ts`](packages/server/src/services/ai/property-prediction/relationshipFeatureExtractor.ts:206-217))
49. **N+1 Query Problem in `PromptStatisticalService`** ([`packages/server/src/services/ai/promptStatisticalService.ts`](packages/server/src/services/ai/promptStatisticalService.ts:1))
50. **Utility and Accuracy of Local Image Analysis Fallback** ([`packages/server/src/services/ai/imageAnalysisService.ts`](packages/server/src/services/ai/imageAnalysisService.ts:137))
51. **Numeric Assumption for Source Values in `RelationshipAwareTrainingService.extractRelationshipFeatures`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:572)
    *   **Issue:** When creating features from relationships, the code multiplies `sourceValue` by `relationship.strength`. This assumes `sourceValue` is numeric.
    *   **Impact:** If `sourceValue` is a string or categorical, this will result in `NaN` or incorrect feature values.
    *   **Action:** Implement appropriate handling for categorical `sourceValue`s.
    *   **Priority:** Medium

52. **Fragile Path Construction in `RelationshipAwareTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:1) (e.g., [line 230](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:230))
    *   **Issue:** Uses `process.cwd()` for local model storage paths.
    *   **Impact:** Paths may be incorrect if the service isn't run from the project root.
    *   **Action:** Ensure robust path resolution for any remaining local file operations.
    *   **Priority:** Medium (Secondary to removing local FS reliance)

53. **Fragile Path Construction in `PropertyPredictionService`:**
    *   **File:** [`packages/server/src/services/ai/property-prediction/propertyPredictionService.ts`](packages/server/src/services/ai/property-prediction/propertyPredictionService.ts:1)
    *   **Action:** Ensure robust path resolution.
    *   **Priority:** Medium

54. **Fragile Path Construction in `VisualReferenceTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/visual-reference-training.ts`](packages/server/src/services/ai/visual-reference-training.ts:1)
    *   **Action:** Ensure robust path resolution.
    *   **Priority:** Medium

55. **Local Filesystem for Uploads in `material.routes.ts`:**
    *   **File:** [`packages/server/src/routes/material.routes.ts`](packages/server/src/routes/material.routes.ts:31)
    *   **Action:** Refactor multer storage to use shared object storage.
    *   **Priority:** Medium

56. **Heuristic Methods in `ContextAssembler` (`context_assembler.py`):**
    *   **File:** [`packages/ml/python/context_assembler.py`](packages/ml/python/context_assembler.py:1)
    *   **Action:** Consider integrating advanced NLP/ML models for query understanding and knowledge categorization.
    *   **Priority:** Medium

57. **Context Trimming Logic in `ContextAssembler` (`context_assembler.py`):**
    *   **File:** [`packages/ml/python/context_assembler.py`](packages/ml/python/context_assembler.py:602)
    *   **Action:** Use a proper tokenizer for token count; explore sophisticated summarization.
    *   **Priority:** Medium

58. **Password Policy in `passwordReset.controller.ts`:**
    *   **File:** [`packages/server/src/controllers/auth/passwordReset.controller.ts`](packages/server/src/controllers/auth/passwordReset.controller.ts:147-149)
    *   **Issue:** Basic password strength check (length only).
    *   **Impact:** May allow weak passwords.
    *   **Action:** Consider integrating a more comprehensive password policy (e.g., complexity, common password checks), potentially via a shared validation service.
    *   **Priority:** Medium

59. **Atomicity of Password Reset & Token Invalidation:**
    *   **File:** [`packages/server/src/controllers/auth/passwordReset.controller.ts`](packages/server/src/controllers/auth/passwordReset.controller.ts:167-181)
    *   **Issue:** Password update and token invalidation are separate operations.
    *   **Impact:** Low risk, but theoretically token could be reused if the second operation fails.
    *   **Action:** For true atomicity, these operations would ideally be in a single database transaction/function, though this is complex across Supabase Auth and custom tables. Current mitigation (token expiry) is likely sufficient for most cases.
    *   **Priority:** Medium

60. **Cookie Security for Refresh Token in `session.controller.ts`:**
    *   **File:** [`packages/server/src/controllers/auth/session.controller.ts`](packages/server/src/controllers/auth/session.controller.ts:172-176)
    *   **Issue:** While the main token cookie has security flags, if refresh tokens are also stored in cookies (not explicitly shown but common), they need similar or stronger security.
    *   **Impact:** Potential misuse of refresh tokens if not secured properly.
    *   **Action:** Ensure secure cookie settings (HttpOnly, Secure, SameSite=Strict) for any refresh token cookies if they are implemented.
    *   **Priority:** Medium

61. **Error Handling in `session.controller.ts` (`getUserSessionsHandler`):**
    *   **File:** [`packages/server/src/controllers/auth/session.controller.ts`](packages/server/src/controllers/auth/session.controller.ts:318)
    *   **Issue:** Throws a generic `new ApiError(500, ...)` instead of potentially re-throwing a more specific error.
    *   **Impact:** May obscure original error details.
    *   **Action:** Improve error propagation if more specific error types are available from the service layer.
    *   **Priority:** Medium

62. **Security Logging Consistency in `twoFactor.controller.ts`:**
    *   **File:** [`packages/server/src/controllers/auth/twoFactor.controller.ts`](packages/server/src/controllers/auth/twoFactor.controller.ts:1)
    *   **Issue:** While `setupTOTP` and `verifyTwoFactorCode` have good security logging, other handlers like `verifyTOTP`, `setupSMS`, `verifySMS`, `setupEmail`, `verifyEmail`, and `disableTwoFactor` may lack consistent attempt/success/failure logging with detailed context.
    *   **Impact:** Incomplete audit trail for 2FA operations.
    *   **Action:** Review all 2FA endpoint handlers and ensure consistent and detailed security logging (attempt, success, failure) is implemented for all sensitive operations.
    *   **Priority:** Medium

63. **Error Handling Consistency in `twoFactor.controller.ts`:**
    *   **File:** [`packages/server/src/controllers/auth/twoFactor.controller.ts`](packages/server/src/controllers/auth/twoFactor.controller.ts:1)
    *   **Issue:** Controller relies on `twoFactor.service.ts` to throw appropriate `ApiError`s.
    *   **Impact:** If the service layer throws generic errors, the controller won't propagate specific error information.
    *   **Action:** Ensure `twoFactor.service.ts` throws specific `ApiError`s where appropriate, so the controller can re-throw them, providing better error details to the client.
    *   **Priority:** Medium

64. **Input Validation for `appName` in `setupTOTP` (`twoFactor.controller.ts`):**
    *   **File:** [`packages/server/src/controllers/auth/twoFactor.controller.ts`](packages/server/src/controllers/auth/twoFactor.controller.ts:62)
    *   **Issue:** The `appName` for TOTP setup, if user-supplied, is not validated.
    *   **Impact:** Potential for invalid or overly long app names.
    *   **Action:** Add validation for `appName` (e.g., length, allowed characters) if it can be provided by the user.
    *   **Priority:** Medium

65. **Error Handling in `proratedBilling.service.ts`:**
    *   **File:** [`packages/server/src/services/billing/proratedBilling.service.ts`](packages/server/src/services/billing/proratedBilling.service.ts:1)
    *   **Issue:** Catches and re-throws generic `Error` or original errors.
    *   **Impact:** May obscure specific error context for upstream callers.
    *   **Action:** Consider defining and throwing more specific custom error types (e.g., `BillingError`, `StripeError`) from this service and `stripeService`.
    *   **Priority:** Medium

66. **Missing Stripe Price ID Null Check in `calculateProration`:**
    *   **File:** [`packages/server/src/services/billing/proratedBilling.service.ts`](packages/server/src/services/billing/proratedBilling.service.ts:63)
    *   **Issue:** Uses `newTier.stripePriceId!` without an explicit preceding null check for `newTier.stripePriceId` itself within this function.
    *   **Impact:** Potential runtime error if `newTier.stripePriceId` is null/undefined.
    *   **Action:** Add an explicit check for `newTier.stripePriceId` in `calculateProration` before use and throw a specific error if missing.
    *   **Priority:** Medium

67. **DB Update Relies on Asynchronous Webhook in `applyProratedChange`:**
    *   **File:** [`packages/server/src/services/billing/proratedBilling.service.ts`](packages/server/src/services/billing/proratedBilling.service.ts:133)
    *   **Issue:** Local database update after a Stripe subscription change relies on an asynchronous webhook.
    *   **Impact:** Potential for temporary data inconsistency between Stripe and the local database.
    *   **Action:** Confirm webhook handling is robust and timely. This architectural choice is acceptable if slight delays are understood; otherwise, consider immediate local DB update post-Stripe confirmation with webhook for reconciliation.
    *   **Priority:** Medium

68. **Performance of `findSimilarMaterials` in `materialComparisonService.ts`:**
    *   **File:** [`packages/server/src/services/comparison/materialComparisonService.ts`](packages/server/src/services/comparison/materialComparisonService.ts:151)
    *   **Issue:** Fetches `limit * 3` potential matches then compares in-app. Can be inefficient for large datasets.
    *   **Impact:** Potential slowness in finding similar materials.
    *   **Action:** Consider optimizations like preliminary vector-based filtering or pushing more comparison logic to the database if performance becomes an issue.
    *   **Priority:** Medium

69. **Normalization in `calculateNumericSimilarity` (`materialComparisonService.ts`):**
    *   **File:** [`packages/server/src/services/comparison/materialComparisonService.ts`](packages/server/src/services/comparison/materialComparisonService.ts:492)
    *   **Issue:** `getPropertyRange` returns `null`, disabling normalization. Hardcoded ranges are commented out.
    *   **Impact:** Numeric similarity might be skewed by properties with different scales.
    *   **Action:** Implement robust determination or configuration of property ranges for normalization if this feature is desired.
    *   **Priority:** Medium

70. **Hardcoded Default Property Weights and Metadata in `materialComparisonService.ts`:**
    *   **Files:** [`packages/server/src/services/comparison/materialComparisonService.ts`](packages/server/src/services/comparison/materialComparisonService.ts:316) (for weights), [`packages/server/src/services/comparison/materialComparisonService.ts`](packages/server/src/services/comparison/materialComparisonService.ts:657) (for metadata)
    *   **Issue:** Default weights and display metadata are hardcoded.
    *   **Impact:** Difficult to configure or extend without code changes.
    *   **Action:** Consider moving this configuration to a database table or a configuration file managed by `UnifiedConfig`.
    *   **Priority:** Medium

71. **Error Handling in `materialComparisonService.ts`:**
    *   **File:** [`packages/server/src/services/comparison/materialComparisonService.ts`](packages/server/src/services/comparison/materialComparisonService.ts:1)
    *   **Issue:** Generally re-throws errors.
    *   **Impact:** May obscure original error context.
    *   **Action:** Consider using more specific custom error types for better upstream error handling.
    *   **Priority:** Medium

72. **Error Handling in `creditService.ts`:**
    *   **File:** [`packages/server/src/services/credit/creditService.ts`](packages/server/src/services/credit/creditService.ts:1)
    *   **Issue:** Catches errors, logs them, and then re-throws the original error.
    *   **Impact:** May obscure original error context if underlying models throw generic errors.
    *   **Action:** Enhance underlying models (`userCredit.model.ts`, `serviceCost.model.ts`) to throw specific custom errors. Update `CreditService` to catch and potentially wrap/re-throw these for better upstream handling.
    *   **Priority:** Medium

73. **Atomicity of Credit Operations in Underlying Models:**
    *   **File:** [`packages/server/src/services/credit/creditService.ts`](packages/server/src/services/credit/creditService.ts:1) (depends on `userCredit.model.ts`)
    *   **Issue:** Operations like `useServiceCredits` and `addCreditsToUser` likely involve multiple database writes in the model layer (e.g., update balance, create transaction). These must be atomic.
    *   **Impact:** Potential for inconsistent credit states if model-layer operations are not transactional.
    *   **Action:** Ensure that methods in `userCredit.model.ts` performing multiple dependent database writes are wrapped in database transactions.
    *   **Priority:** Medium (Integrity of credit system)

74. **Security Logging Consistency in `alertManager.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/alertManager.service.ts`](packages/server/src/services/credit/alertManager.service.ts:1)
    *   **Issue:** Ensure consistent attempt/success/failure logging for all sensitive 2FA-related operations or alert configuration changes.
    *   **Impact:** Potentially incomplete audit trail.
    *   **Action:** Review all handlers in `alertManager.service.ts` and implement detailed security logging.
    *   **Priority:** Medium

75. **Error Handling Consistency in `alertManager.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/alertManager.service.ts`](packages/server/src/services/credit/alertManager.service.ts:1)
    *   **Issue:** Service should throw specific custom errors rather than generic ones.
    *   **Impact:** Generic errors make upstream handling harder.
    *   **Action:** Define and use specific custom error types (e.g., `AlertConfigurationError`, `NotificationChannelError`).
    *   **Priority:** Medium

76. **Input Validation in `createAlertSetting` and `updateAlertSetting` (`alertManager.service.ts`):**
    *   **File:** [`packages/server/src/services/credit/alertManager.service.ts`](packages/server/src/services/credit/alertManager.service.ts:1)
    *   **Issue:** Lacks deep validation for formats of `emailAddresses`, `phoneNumbers`, `webhookUrls`.
    *   **Impact:** Invalid contact details or URLs could be stored.
    *   **Action:** Add stricter format validation (regex, valid URL format).
    *   **Priority:** Medium

77. **`notifications` Table for In-App Alerts in `alertManager.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/alertManager.service.ts`](packages/server/src/services/credit/alertManager.service.ts:431)
    *   **Issue:** Relies on a `notifications` table.
    *   **Impact:** Functionality depends on correct schema and RLS.
    *   **Action:** Ensure `notifications` table is defined in Supabase migrations with appropriate schema and RLS.
    *   **Priority:** Medium

78. **Alert Throttling/Cool-down in `checkUserNeedsAlerts` (`alertManager.service.ts`):**
    *   **File:** [`packages/server/src/services/credit/alertManager.service.ts`](packages/server/src/services/credit/alertManager.service.ts:498-509)
    *   **Issue:** 24-hour cool-down is hardcoded.
    *   **Impact:** Not configurable without code changes.
    *   **Action:** Consider making the alert cool-down period configurable via `UnifiedConfig`.
    *   **Priority:** Medium

79. **`processAllAlerts` Scalability in `alertManager.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/alertManager.service.ts`](packages/server/src/services/credit/alertManager.service.ts:526)
    *   **Issue:** Fetches all users, then settings/balance for each; could be resource-intensive.
    *   **Impact:** Potential performance issues with growth.
    *   **Action:** Acceptable for now. Consider batch processing or more targeted queries if it becomes a bottleneck.
    *   **Priority:** Medium

80. **`setInterval` for `scheduleAlertChecks` in `alertManager.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/alertManager.service.ts`](packages/server/src/services/credit/alertManager.service.ts:559)
    *   **Issue:** Uses `setInterval` for periodic checks.
    *   **Impact:** Can be less reliable than cron jobs in production.
    *   **Action:** Consider a robust cron job system for production; `setInterval` is acceptable for now.
    *   **Priority:** Medium

81. **Atomicity of `processTopup` in `autoTopup.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/autoTopup.service.ts`](packages/server/src/services/credit/autoTopup.service.ts:129)
    *   **Issue:** Performs multiple critical steps (DB writes, Stripe payment, credit provisioning) sequentially. Failure after payment but before credit grant is a key risk.
    *   **Impact:** Potential for inconsistent state and user billing issues.
    *   **Action:** Implement robust distributed transaction patterns (e.g., transactional outbox, reliable queues with retries/DLQ) or ensure idempotent operations with clear reconciliation processes for failures.
    *   **Priority:** Medium

82. **Error Handling in `autoTopup.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/autoTopup.service.ts`](packages/server/src/services/credit/autoTopup.service.ts:1)
    *   **Issue:** Logs and re-throws original errors.
    *   **Impact:** May obscure specific error context.
    *   **Action:** Consider more specific custom error types from this service and its dependencies.
    *   **Priority:** Medium

83. **Input Validation for `paymentMethodId` in `autoTopup.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/autoTopup.service.ts`](packages/server/src/services/credit/autoTopup.service.ts:48)
    *   **Issue:** `paymentMethodId` is not validated for format or existence before use (though Stripe would reject an invalid one).
    *   **Impact:** Minor, as Stripe handles final validation.
    *   **Action:** Consider adding format validation if a known pattern exists.
    *   **Priority:** Medium

84. **`processAllTopups` Scalability in `autoTopup.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/autoTopup.service.ts`](packages/server/src/services/credit/autoTopup.service.ts:270)
    *   **Issue:** Fetches all users needing top-up then processes sequentially.
    *   **Impact:** Potential performance issues with many users.
    *   **Action:** Acceptable for now. Consider batching or more targeted queries if it becomes a bottleneck.
    *   **Priority:** Medium

85. **`setInterval` for `scheduleTopupChecks` in `autoTopup.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/autoTopup.service.ts`](packages/server/src/services/credit/autoTopup.service.ts:303)
    *   **Issue:** Uses `setInterval` for periodic checks.
    *   **Impact:** Can be less reliable than cron jobs in production.
    *   **Action:** Consider a robust cron job system for production; `setInterval` is acceptable for now.
    *   **Priority:** Medium

86. **Atomicity of `purchaseCredits` and `purchaseCreditPackage` in `bulkPurchase.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/bulkPurchase.service.ts`](packages/server/src/services/credit/bulkPurchase.service.ts:1) (methods `purchaseCredits` [line 183](packages/server/src/services/credit/bulkPurchase.service.ts:183), `purchaseCreditPackage` [line 258](packages/server/src/services/credit/bulkPurchase.service.ts:258))
    *   **Issue:** Both methods involve Stripe payment processing followed by calls to `addCredits` (from `userCredit.model.ts`). These are sequential and not inherently atomic across services/database.
    *   **Impact:** Risk of user being charged without receiving credits if `addCredits` fails after successful payment.
    *   **Action:** Implement robust distributed transaction patterns (e.g., transactional outbox, reliable queues with retries/DLQ for the credit granting step) or ensure idempotent operations with clear reconciliation processes for failures.
    *   **Priority:** Medium

87. **`BASE_CREDIT_UNIT_PRICE` Configuration in `bulkPurchase.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/bulkPurchase.service.ts`](packages/server/src/services/credit/bulkPurchase.service.ts:16)
    *   **Issue:** `BASE_CREDIT_UNIT_PRICE` is hardcoded.
    *   **Impact:** Price changes require code modification.
    *   **Action:** Move `BASE_CREDIT_UNIT_PRICE` to `UnifiedConfig`.
    *   **Priority:** Medium

88. **Error Handling in `bulkPurchase.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/bulkPurchase.service.ts`](packages/server/src/services/credit/bulkPurchase.service.ts:1)
    *   **Issue:** Logs and re-throws original errors.
    *   **Impact:** May obscure specific error context.
    *   **Action:** Consider more specific custom error types (e.g., `PurchaseError`, `PackageNotFoundError`).
    *   **Priority:** Medium

89. **Input Validation for `stripePriceId` in `bulkPurchase.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/bulkPurchase.service.ts`](packages/server/src/services/credit/bulkPurchase.service.ts:1) (method `createBulkCreditPackage`)
    *   **Issue:** `stripePriceId` is optional and not validated for format if provided.
    *   **Impact:** Minor, as Stripe would reject an invalid ID.
    *   **Action:** Consider adding format validation if a known pattern exists for Stripe Price IDs.
    *   **Priority:** Low

90. **Currency Handling in `bulkPurchase.service.ts`:**
    *   **File:** [`packages/server/src/services/credit/bulkPurchase.service.ts`](packages/server/src/services/credit/bulkPurchase.service.ts:1) (methods `purchaseCredits`, `purchaseCreditPackage`)
    *   **Issue:** 'USD' is hardcoded for Stripe payments if not using a `stripePriceId`.
    *   **Impact:** Limits multi-currency support for direct payments.
    *   **Action:** If multi-currency is a requirement, this needs to be handled more dynamically (e.g., from package data or user settings). Document if USD is the only supported currency for now.
    *   **Priority:** Low

## IV. Low Priority & Code Quality Refinements

(Consolidating and re-numbering items here.)

1.  **Header Component Refinements (`Header.tsx`)** ([`packages/client/src/components/Header.tsx`](packages/client/src/components/Header.tsx:1))
2.  **Footer Component Refinements (`Footer.tsx`)** ([`packages/client/src/components/Footer.tsx`](packages/client/src/components/Footer.tsx:1))
3.  **Accessibility of "Add to Board" Button in `MaterialCard.tsx`** ([`packages/client/src/components/materials/MaterialCard.tsx`](packages/client/src/components/materials/MaterialCard.tsx:54-59))
4.  **Icon Implementation in `RecognitionDemo.tsx`** ([`packages/client/src/components/RecognitionDemo.tsx`](packages/client/src/components/RecognitionDemo.tsx:1))
5.  **Local `MaterialProperty` Type in `materialService.ts` (Client)** ([`packages/client/src/services/materialService.ts`](packages/client/src/services/materialService.ts:19-22))
6.  **Type Safety of `process.env` Access in `UnifiedConfig`** ([`packages/shared/src/utils/unified-config.ts`](packages/shared/src/utils/unified-config.ts:1))
7.  **Jitter Application in `applyJitter` (`cron-parser.ts`)** ([`packages/shared/src/utils/cron-parser.ts`](packages/shared/src/utils/cron-parser.ts:346-359))
8.  **Circular Dependency Check for Cache Warming Dependencies** ([`packages/shared/src/services/cache/cacheWarming.ts`](packages/shared/src/services/cache/cacheWarming.ts:717-742))
9.  **Pattern-Based Invalidation Fallback in `CacheInvalidationService`** ([`packages/shared/src/services/cache/cacheInvalidation.ts`](packages/shared/src/services/cache/cacheInvalidation.ts:1))
10. **Logger Inconsistency in `configValidator.ts`** ([`packages/shared/src/utils/configValidator.ts`](packages/shared/src/utils/configValidator.ts:8))
11. **Hardcoded `storageBucket` in `MaterialRecognitionProvider`** ([`packages/shared/src/services/recognition/materialProvider.ts`](packages/shared/src/services/recognition/materialProvider.ts:49))
12. **Missing `generateUniqueKey` in `SupabaseStorageProvider`** ([`packages/shared/src/services/storage/supabaseStorageProvider.ts`](packages/shared/src/services/storage/supabaseStorageProvider.ts:1))
13. **Direct `process.env.SUPABASE_URL` in `SupabaseStorageProvider` Fallback** ([`packages/shared/src/services/storage/supabaseStorageProvider.ts`](packages/shared/src/services/storage/supabaseStorageProvider.ts:48))
14. **Path/Bucket Handling Duplication (Storage Services)**
15. **Logger Inconsistency in `PropertyInheritanceService`** ([`packages/server/src/services/propertyInheritance/propertyInheritanceService.ts`](packages/server/src/services/propertyInheritance/propertyInheritanceService.ts:8))
16. **`isDefaultValue` Logic in `PropertyInheritanceService`** ([`packages/server/src/services/propertyInheritance/propertyInheritanceService.ts`](packages/server/src/services/propertyInheritance/propertyInheritanceService.ts:167-183))
17. **Logger Inconsistency in `QueryUnderstandingService`** ([`packages/server/src/services/search/query-understanding-service.ts`](packages/server/src/services/search/query-understanding-service.ts:11))
18. **`ensureTables` DDL via RPC in `QueryUnderstandingService`** ([`packages/server/src/services/search/query-understanding-service.ts`](packages/server/src/services/search/query-understanding-service.ts:96-157))
19. **Error Fallback Embedding in `QueryUnderstandingService.enhanceQuery`** ([`packages/server/src/services/search/query-understanding-service.ts`](packages/server/src/services/search/query-understanding-service.ts:250))
20. **Logger Inconsistency in `ConversationalSearchService`** ([`packages/server/src/services/search/conversational-search-service.ts`](packages/server/src/services/search/conversational-search-service.ts:10))
21. **Unused `supabaseClient` Import in `sessionManager.service.ts`** ([`packages/server/src/services/auth/sessionManager.service.ts`](packages/server/src/services/auth/sessionManager.service.ts:23))
22. **`setInterval` for Scheduled Cleanups in Auth Services** ([`packages/server/src/services/auth/apiKeyManager.service.ts`](packages/server/src/services/auth/apiKeyManager.service.ts:156), [`packages/server/src/services/auth/sessionManager.service.ts`](packages/server/src/services/auth/sessionManager.service.ts:294))
23. **Hardcoded `embedding_quality` in `EnhancedVectorServiceImpl.storeEmbedding`** ([`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:308))
24. **Hardcoded `model_name` in `EnhancedVectorServiceImpl.logEmbeddingMetrics`** ([`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:345))
25. **Assumed `vector_search_performance` Table in `EnhancedVectorServiceImpl.getPerformanceStats`** ([`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:833))
26. **Logger Inconsistency in `EnhancedVectorServiceImpl`** ([`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:13))
27. **Programmatic Index Creation in `SupabaseVectorSearch.createIndex`** ([`packages/server/src/services/supabase/vector-search.ts`](packages/server/src/services/supabase/vector-search.ts:208))
28. **Logger Inconsistency in `vector-search.ts`** ([`packages/server/src/services/supabase/vector-search.ts`](packages/server/src/services/supabase/vector-search.ts:10))
29. **Unused `SupabaseVectorSearch` Dependency in `SupabaseHybridSearch`** ([`packages/server/src/services/supabase/hybrid-search.ts`](packages/server/src/services/supabase/hybrid-search.ts:51))
30. **Logger Inconsistency in `hybrid-search.ts`** ([`packages/server/src/services/supabase/hybrid-search.ts`](packages/server/src/services/supabase/hybrid-search.ts:10))
31. **Widespread use of `as any` in `SupabaseDatasetService`** ([`packages/server/src/services/supabase/supabase-dataset-service.ts`](packages/server/src/services/supabase/supabase-dataset-service.ts:1))
32. **Generic Error Re-throwing in `SupabaseDatasetService`** ([`packages/server/src/services/supabase/supabase-dataset-service.ts`](packages/server/src/services/supabase/supabase-dataset-service.ts:1))
33. **Logger Inconsistency in `SupabaseDatasetService`** ([`packages/server/src/services/supabase/supabase-dataset-service.ts`](packages/server/src/services/supabase/supabase-dataset-service.ts:9))
34. **Counter Update Efficiency in `SupabaseDatasetService` (Observation)** ([`packages/server/src/services/supabase/supabase-dataset-service.ts`](packages/server/src/services/supabase/supabase-dataset-service.ts:1))
35. **Review RPCs in `SupabaseMaterialService.getKnowledgeBaseStats`** ([`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:762))
36. **CSV Parsing in `SupabaseMaterialService.getKnowledgeBaseStats`** ([`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:802))
37. **Logger Inconsistency in `SupabaseMaterialService`** ([`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:10))
38. **Generic Error Re-throwing in `SupabaseMaterialService`** ([`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:1))
39. **Assumed Table Schemas in `SupabaseMaterialService.getKnowledgeBaseStats`** ([`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:1))
40. **Vector Index Discrepancy (Schema vs. Service Default)** ([`packages/server/src/services/supabase/supabase-schema.md`](packages/server/src/services/supabase/supabase-schema.md:77), [`packages/server/src/services/supabase/vector-search.ts`](packages/server/src/services/supabase/vector-search.ts:211))
41. **`vector_indexes` Table Schema vs. Service Usage Discrepancy** ([`packages/server/src/services/supabase/supabase-schema.md`](packages/server/src/services/supabase/supabase-schema.md:211), [`packages/server/src/services/supabase/supabase-material-service.ts`](packages/server/src/services/supabase/supabase-material-service.ts:802), [`packages/server/src/services/supabase/enhanced-vector-service.ts`](packages/server/src/services/supabase/enhanced-vector-service.ts:833))
42. **Logger Inconsistency in `SupabaseHelper`** ([`packages/server/src/services/supabase/supabaseHelper.ts`](packages/server/src/services/supabase/supabaseHelper.ts:10))
43. **Logger Inconsistency in `SupabaseUtilityService` (`supabase-sync.ts`)** ([`packages/server/src/services/supabase/supabase-sync.ts`](packages/server/src/services/supabase/supabase-sync.ts:9))
44. **`healthCheck` Status Logic in `SupabaseUtilityService`** ([`packages/server/src/services/supabase/supabase-sync.ts`](packages/server/src/services/supabase/supabase-sync.ts:75))
45. **Optimization TODO in `ModelRegistry.selectBestModel`** ([`packages/server/src/services/ai/modelRegistry.ts`](packages/server/src/services/ai/modelRegistry.ts:289))
46. **Logger Inconsistency in `ModelRegistry`** ([`packages/server/src/services/ai/modelRegistry.ts`](packages/server/src/services/ai/modelRegistry.ts:11))
47. **Use of `as any` in `ModelRegistry` Data Mapping** ([`packages/server/src/services/ai/modelRegistry.ts`](packages/server/src/services/ai/modelRegistry.ts:459))
48. **Logger Inconsistency in `ModelRouter`** ([`packages/server/src/services/ai/modelRouter.ts`](packages/server/src/services/ai/modelRouter.ts:10))
49. **Singleton Pattern Inconsistency in `PromptIntegrationService`** ([`packages/server/src/services/ai/promptIntegrationService.ts`](packages/server/src/services/ai/promptIntegrationService.ts:76))
50. **Logger Inconsistency in `RelationshipAwareTrainingService`:**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:8)
    *   **Issue:** Uses `logger` from `../../../utils/logger`.
    *   **Action:** Align with the project-wide logging strategy.
    *   **Priority:** Low

51. **Database Schema for `RelationshipAwareTrainingService` Tables (Observation):**
    *   **File:** [`packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts`](packages/server/src/services/ai/relationship-aware-training/relationshipAwareTrainingService.ts:1)
    *   **Issue:** The service programmatically attempts to create tables and uses Prisma for `PropertyRelationship`.
    *   **Action:** Ensure all tables defined via migrations, Prisma schema aligned.
    *   **Priority:** Low (Observation, but linked to Critical #31)

52. **Logger Inconsistency in `PromptMLService`:**
    *   **File:** [`packages/server/src/services/ai/promptMLService.ts`](packages/server/src/services/ai/promptMLService.ts:14)
    *   **Action:** Align with project-wide logging.
    *   **Priority:** Low

53. **Database Table Definition for `password_reset_tokens`:**
    *   **File:** [`packages/server/src/controllers/auth/passwordReset.controller.ts`](packages/server/src/controllers/auth/passwordReset.controller.ts:1) (Implicit)
    *   **Issue:** The controller relies on a `password_reset_tokens` table.
    *   **Impact:** Functionality will fail if the table is not correctly defined with appropriate schema and RLS.
    *   **Action:** Ensure `password_reset_tokens` table is defined in a Supabase SQL migration file with columns like `userId` (FK to `auth.users`), `token` (text, unique, indexed), `expiresAt` (timestamptz), `isUsed` (boolean). Implement restrictive RLS policies (e.g., inserts/updates by service_role only).
    *   **Priority:** Low (Assuming it might exist but needs verification)

54. **Database Table and RLS for `two_factor_settings`:**
    *   **File:** [`packages/server/src/controllers/auth/twoFactor.controller.ts`](packages/server/src/controllers/auth/twoFactor.controller.ts:1) (Implicit)
    *   **Issue:** The controller relies on a `two_factor_settings` table (interacted with via `twoFactor.model.ts`).
    *   **Impact:** 2FA functionality will fail if this table is not correctly defined with appropriate schema and restrictive RLS.
    *   **Action:** Ensure the `two_factor_settings` table is defined in a Supabase SQL migration. Columns should include `userId` (FK to `auth.users`), `method` (enum: 'totp', 'sms', 'email'), `secret` (text, encrypted), `phoneNumber` (text, nullable), `email` (text, nullable), `isVerified` (boolean), `isEnabled` (boolean), `backupCodes` (text[], nullable), `lastUsedAt` (timestamptz, nullable). Implement RLS policies (e.g., users can select/update their own settings, inserts/deletes by service_role or specific backend role).
    *   **Priority:** Low (Assuming it might exist but needs schema and RLS verification)

55. **`any` Type Usage in `materialComparisonService.ts`:**
    *   **File:** [`packages/server/src/services/comparison/materialComparisonService.ts`](packages/server/src/services/comparison/materialComparisonService.ts:1) (e.g., [line 226-227](packages/server/src/services/comparison/materialComparisonService.ts:226-227), [line 428](packages/server/src/services/comparison/materialComparisonService.ts:428))
    *   **Issue:** `material1`, `material2` parameters, and `material` in `getPropertyValue` are typed as `any`.
    *   **Impact:** Reduces TypeScript type safety.
    *   **Action:** Use a more specific type (e.g., Prisma `Material` type or a shared material type if available).
    *   **Priority:** Low

56. **Placeholder `saveComparisonResult` in `materialComparisonService.ts`:**
    *   **File:** [`packages/server/src/services/comparison/materialComparisonService.ts`](packages/server/src/services/comparison/materialComparisonService.ts:698)
    *   **Issue:** The `saveComparisonResult` method is a placeholder.
    *   **Impact:** Comparison results are not persisted.
    *   **Action:** Implement the database insertion logic using Prisma to save the `ComparisonResult` to the `comparison_results` table (or equivalent).
    *   **Priority:** Low