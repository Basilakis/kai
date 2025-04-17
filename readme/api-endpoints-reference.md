# API Endpoints Reference

## Overview

This document provides a comprehensive reference of all API endpoints in the Kai platform, including their access control settings and rate limit configurations. This serves as both implementation documentation and a reference for administrators.

**Important Note**: All endpoint access settings are fully configurable through the Network Access Control panel in the admin dashboard. No endpoints have hardcoded access restrictions.

## Access Control Configuration

Each API endpoint can be configured with the following access settings:

| Setting | Description |
|---------|-------------|
| Internal Access | When enabled, the endpoint can be accessed from defined internal networks |
| External Access | When enabled, the endpoint can be accessed from external networks |
| Rate Limit | Per-endpoint rate limits based on source network |

## Rate Limit Configuration

Rate limits can be configured for different networks:

- **Default Rate Limit**: Applied to all requests from undefined networks (default: 30 req/min)
- **Custom Rate Limits**: Specific limits for particular IP addresses or CIDR ranges
- **Endpoint Category Multipliers**: Different endpoint categories have different rate limit multipliers

## Authentication APIs

| Endpoint | Method | Description | Default Access | Default Rate Limit |
|----------|--------|-------------|---------------|-------------------|
| `/api/auth/login` | POST | User login | Internal & External | 20 req/min |
| `/api/auth/register` | POST | User registration | Internal & External | 10 req/min |
| `/api/auth/refresh-token` | POST | Refresh authentication token | Internal & External | 60 req/min |
| `/api/auth/forgot-password` | POST | Request password reset | Internal & External | 5 req/min |
| `/api/auth/reset-password` | PUT | Reset password with token | Internal & External | 5 req/min |
| `/api/auth/verify-email` | POST | Verify user email address | Internal & External | 5 req/min |
| `/api/auth/change-password` | PUT | Change user password | Internal & External | 5 req/min |

## User Management APIs

| Endpoint | Method | Description | Default Access | Default Rate Limit |
|----------|--------|-------------|---------------|-------------------|
| `/api/users/profile` | GET | Get user profile | Internal & External | 30 req/min |
| `/api/users/profile` | PUT | Update user profile | Internal & External | 10 req/min |
| `/api/users/preferences` | GET | Get user preferences | Internal & External | 30 req/min |
| `/api/users/preferences` | PUT | Update user preferences | Internal & External | 10 req/min |
| `/api/users/:userId` | GET | Get user by ID | Internal Only | 30 req/min |
| `/api/users` | GET | List all users | Internal Only | 20 req/min |
| `/api/users/history` | GET | Get user activity history | Internal & External | 20 req/min |

## Material APIs

| Endpoint | Method | Description | Default Access | Default Rate Limit |
|----------|--------|-------------|---------------|-------------------|
| `/api/materials` | GET | List materials | Internal & External | 60 req/min |
| `/api/materials/:id` | GET | Get material by ID | Internal & External | 60 req/min |
| `/api/materials` | POST | Create new material | Internal & External | 30 req/min |
| `/api/materials/:id` | PUT | Update material | Internal & External | 20 req/min |
| `/api/materials/:id` | DELETE | Delete material | Internal Only | 10 req/min |
| `/api/materials/search` | POST | Search materials | Internal & External | 60 req/min |
| `/api/materials/batch-import` | POST | Import multiple materials | Internal Only | 5 req/min |
| `/api/materials/metadata` | GET | Get material metadata fields | Internal & External | 30 req/min |

## Recognition APIs

| Endpoint | Method | Description | Default Access | Default Rate Limit |
|----------|--------|-------------|---------------|-------------------|
| `/api/recognition` | POST | Recognize material | Internal & External | 20 req/min |
| `/api/recognition/batch` | POST | Batch recognition | Internal & External | 5 req/min |
| `/api/recognition/history` | GET | Get recognition history | Internal & External | 30 req/min |
| `/api/recognition/feedback` | POST | Submit recognition feedback | Internal & External | 20 req/min |
| `/api/recognition/confidence` | GET | Get recognition confidence scores | Internal Only | 30 req/min |
| `/api/recognition/retrain` | POST | Start recognition model retraining | Internal Only | 1 req/10min |

## Search APIs

| Endpoint | Method | Description | Default Access | Default Rate Limit |
|----------|--------|-------------|---------------|-------------------|
| `/api/search` | GET | Unified search | Internal & External | 60 req/min |
| `/api/search/vector` | POST | Vector similarity search | Internal & External | 30 req/min |
| `/api/search/hybrid` | POST | Hybrid (text + vector) search | Internal & External | 30 req/min |
| `/api/search/autocomplete` | GET | Search autocomplete suggestions | Internal & External | 100 req/min |
| `/api/search/config` | GET | Get search configuration | Internal & External | 10 req/min |
| `/api/search/config` | PUT | Update search configuration | Internal Only | 5 req/min |
| `/api/search/reindex` | POST | Rebuild search index | Internal Only | 1 req/hour |

## Analytics APIs

| Endpoint | Method | Description | Default Access | Default Rate Limit |
|----------|--------|-------------|---------------|-------------------|
| `/api/analytics/events` | POST | Track analytics event | Internal & External | 100 req/min |
| `/api/analytics/events` | GET | Get analytics events | Internal Only | 30 req/min |
| `/api/analytics/trends` | GET | Get analytics trends | Internal Only | 20 req/min |
| `/api/analytics/stats` | GET | Get analytics statistics | Internal Only | 20 req/min |
| `/api/analytics/data` | DELETE | Clear analytics data | Internal Only | 1 req/day |
| `/api/analytics/dashboard` | GET | Get analytics dashboard data | Internal Only | 20 req/min |
| `/api/analytics/export` | POST | Export analytics data | Internal Only | 3 req/hour |

## ML Service APIs

| Endpoint | Method | Description | Default Access | Default Rate Limit |
|----------|--------|-------------|---------------|-------------------|
| `/api/ml/models` | GET | List ML models | Internal Only | 10 req/min |
| `/api/ml/models/:id` | GET | Get ML model details | Internal Only | 10 req/min |
| `/api/ml/training/start` | POST | Start model training | Internal Only | 3 req/hour |
| `/api/ml/training/:jobId/status` | GET | Get training job status | Internal Only | 30 req/min |
| `/api/ml/training/:jobId/stop` | POST | Stop training job | Internal Only | 5 req/min |
| `/api/ml/inference` | POST | Run model inference | Internal & External | 30 req/min |
| `/api/ml/embeddings` | POST | Generate embeddings | Internal & External | 30 req/min |

## Dataset APIs

| Endpoint | Method | Description | Default Access | Default Rate Limit |
|----------|--------|-------------|---------------|-------------------|
| `/api/admin/datasets` | GET | List all datasets | Internal Only | 30 req/min |
| `/api/admin/datasets/:id` | GET | Get dataset details | Internal Only | 30 req/min |
| `/api/admin/datasets/upload/zip` | POST | Upload ZIP dataset | Internal Only | 5 req/min |
| `/api/admin/datasets/upload/csv` | POST | Upload CSV dataset | Internal Only | 5 req/min |
| `/api/admin/datasets/import/premade` | POST | Import premade dataset | Internal Only | 3 req/hour |
| `/api/admin/datasets/:id/split` | POST | Split dataset into train/validation/test sets | Internal Only | 10 req/min |
| `/api/admin/datasets/:id/train` | POST | Start training job for dataset | Internal Only | 3 req/hour |
| `/api/admin/datasets/:id/quality` | GET | Get dataset quality metrics | Internal Only | 20 req/min |
| `/api/admin/datasets/:id` | DELETE | Delete dataset | Internal Only | 5 req/min |
| `/api/admin/datasets/:id/classes` | GET | List dataset classes | Internal Only | 30 req/min |
| `/api/admin/datasets/:id/images` | GET | List dataset images | Internal Only | 30 req/min |
| `/api/admin/training/:jobId/status` | GET | Get training job status | Internal Only | 30 req/min |
| `/api/admin/training/:jobId/stop` | POST | Stop training job | Internal Only | 5 req/min |
| `/api/admin/training/:jobId/metrics` | GET | Get training job metrics | Internal Only | 30 req/min |

## PDF Processing APIs

| Endpoint | Method | Description | Default Access | Default Rate Limit |
|----------|--------|-------------|---------------|-------------------|
| `/api/pdf/extract` | POST | Extract text from PDF | Internal & External | 10 req/min |
| `/api/pdf/process` | POST | Process PDF document | Internal & External | 5 req/min |
| `/api/pdf/analyze` | POST | Analyze PDF structure | Internal & External | 5 req/min |
| `/api/pdf/ocr` | POST | Run OCR on PDF | Internal & External | 3 req/min |
| `/api/pdf/queue` | GET | Get PDF processing queue status | Internal Only | 30 req/min |
| `/api/pdf/jobs/:jobId` | GET | Get PDF job status | Internal & External | 30 req/min |

## 3D Designer APIs

| Endpoint | Method | Description | Default Access | Default Rate Limit |
|----------|--------|-------------|---------------|-------------------|
| `/api/3d-designer/scene` | POST | Create new 3D scene | Internal & External | 10 req/min |
| `/api/3d-designer/scene/:id` | GET | Get 3D scene | Internal & External | 30 req/min |
| `/api/3d-designer/scene/:id` | PUT | Update 3D scene | Internal & External | 10 req/min |
| `/api/3d-designer/scene/:id` | DELETE | Delete 3D scene | Internal & External | 5 req/min |
| `/api/3d-designer/render` | POST | Render 3D scene | Internal & External | 5 req/min |
| `/api/3d-designer/export` | POST | Export 3D scene | Internal & External | 5 req/min |

## Agent APIs

| Endpoint | Method | Description | Default Access | Default Rate Limit |
|----------|--------|-------------|---------------|-------------------|
| `/api/agents/chat` | POST | Send message to agent | Internal & External | 30 req/min |
| `/api/agents/sessions` | GET | List agent sessions | Internal & External | 30 req/min |
| `/api/agents/sessions/:id` | GET | Get agent session | Internal & External | 30 req/min |
| `/api/agents/sessions/:id` | DELETE | Delete agent session | Internal & External | 10 req/min |
| `/api/agents/feedback` | POST | Submit agent feedback | Internal & External | 10 req/min |
| `/api/agents/config` | GET | Get agent configuration | Internal Only | 10 req/min |
| `/api/agents/config` | PUT | Update agent configuration | Internal Only | 5 req/min |

## Admin APIs

| Endpoint | Method | Description | Default Access | Default Rate Limit |
|----------|--------|-------------|---------------|-------------------|
| `/api/admin/users` | GET | List all users (admin) | Internal Only | 20 req/min |
| `/api/admin/users/:id` | PUT | Update user (admin) | Internal Only | 10 req/min |
| `/api/admin/users/:id` | DELETE | Delete user (admin) | Internal Only | 5 req/min |
| `/api/admin/settings` | GET | Get system settings | Internal Only | 10 req/min |
| `/api/admin/settings` | PUT | Update system settings | Internal Only | 5 req/min |
| `/api/admin/metadata-fields` | GET | Get metadata fields | Internal Only | 10 req/min |
| `/api/admin/metadata-fields` | POST | Create metadata field | Internal Only | 5 req/min |
| `/api/admin/metadata-fields/:id` | PUT | Update metadata field | Internal Only | 5 req/min |
| `/api/admin/metadata-fields/:id` | DELETE | Delete metadata field | Internal Only | 5 req/min |
| `/api/admin/jobs` | GET | List background jobs | Internal Only | 20 req/min |
| `/api/admin/jobs/:id` | GET | Get job details | Internal Only | 30 req/min |
| `/api/admin/jobs/:id` | DELETE | Cancel job | Internal Only | 10 req/min |

## Network Access Control APIs

| Endpoint | Method | Description | Default Access | Default Rate Limit |
|----------|--------|-------------|---------------|-------------------|
| `/api/admin/network/internal-networks` | GET | List internal networks | Internal Only | 10 req/min |
| `/api/admin/network/internal-networks` | POST | Add internal network | Internal Only | 5 req/min |
| `/api/admin/network/internal-networks/:id` | DELETE | Remove internal network | Internal Only | 5 req/min |
| `/api/admin/network/endpoints` | GET | List endpoint permissions | Internal Only | 10 req/min |
| `/api/admin/network/endpoints/:id` | PUT | Update endpoint permissions | Internal Only | 5 req/min |
| `/api/admin/network/rate-limits` | GET | Get rate limit settings | Internal Only | 10 req/min |
| `/api/admin/network/rate-limits` | PUT | Update default rate limit | Internal Only | 5 req/min |
| `/api/admin/network/rate-limits/custom` | GET | List custom rate limits | Internal Only | 10 req/min |
| `/api/admin/network/rate-limits/custom` | POST | Add custom rate limit | Internal Only | 5 req/min |
| `/api/admin/network/rate-limits/custom/:id` | DELETE | Remove custom rate limit | Internal Only | 5 req/min |

## Subscription APIs

| Endpoint | Method | Description | Default Access | Default Rate Limit |
|----------|--------|-------------|---------------|-------------------|
| `/api/subscription/plans` | GET | List subscription plans | Internal & External | 30 req/min |
| `/api/subscription/subscribe` | POST | Subscribe to plan | Internal & External | 10 req/min |
| `/api/subscription/status` | GET | Get subscription status | Internal & External | 30 req/min |
| `/api/subscription/cancel` | POST | Cancel subscription | Internal & External | 10 req/min |
| `/api/subscription/upgrade` | POST | Upgrade subscription | Internal & External | 10 req/min |
| `/api/subscription/invoices` | GET | List subscription invoices | Internal & External | 20 req/min |
| `/api/admin/subscription/plans` | GET | List all plans (admin) | Internal Only | 10 req/min |
| `/api/admin/subscription/plans` | POST | Create plan (admin) | Internal Only | 5 req/min |
| `/api/admin/subscription/plans/:id` | PUT | Update plan (admin) | Internal Only | 5 req/min |
| `/api/admin/subscription/plans/:id` | DELETE | Delete plan (admin) | Internal Only | 5 req/min |

## How to Configure Access Settings

Access settings for each endpoint can be configured through the admin panel under **Settings** → **Network Access**:

1. Navigate to the API Endpoint Access Control section
2. Use the search box to find specific endpoints
3. Enable or disable internal/external access using the checkboxes
4. Save your changes

## How to Configure Rate Limits

Rate limits can be configured:

1. **Default Rate Limit**: Set the default requests per minute allowed from undefined networks
2. **Custom Rate Limits**: Define specific rate limits for particular IP addresses or CIDR ranges
3. **Per-endpoint limits**: Contact development team if specific endpoints need custom rate limits

## Implementation Notes

All endpoints in this document have the default recommended access settings that can be modified through the admin interface. The system provides a full audit trail of access changes for security monitoring purposes.