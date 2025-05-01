# Load Environment Variables Action

This GitHub Action loads environment variables from a structured set of `.env` files and makes them available to the workflow.

## Purpose

The purpose of this action is to implement a structured approach to environment variable management:

1. **Base Configuration**: Load sensitive variables from `.env`
2. **Environment-Specific Overrides**: Load non-sensitive, environment-specific variables from `.env.{environment}`

This ensures consistency between local development and CI/CD workflows while maintaining proper separation of concerns.

## Usage

```yaml
steps:
  - name: Checkout code
    uses: actions/checkout@v3

  - name: Load environment variables
    uses: ./.github/actions/load-env
    with:
      env-file: '.env'  # Optional, defaults to '.env'
      environment: 'production'  # Optional, defaults to 'development'
      fallback-file: '.env.template'  # Optional, defaults to '.env.template'

  - name: Use environment variables
    run: |
      echo "Using environment variables:"
      echo "API_URL: $API_URL"
      echo "NODE_ENV: $NODE_ENV"
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `env-file` | Path to the base environment file | No | `.env` |
| `environment` | Environment (production, staging, development) | No | `development` |
| `fallback-file` | Fallback file if env-file does not exist | No | `.env.template` |

## Behavior

1. The action first checks if the specified `.env` file exists.
2. If not, it falls back to the specified fallback file (default: `.env.template`).
3. It loads all environment variables from the base file.
4. It then loads environment-specific variables from `.env.{environment}` (e.g., `.env.production`), overriding any existing values.
5. All loaded variables are made available to subsequent steps in the workflow.

## File Structure

The KAI platform uses the following environment file structure:

- `.env` - Contains all sensitive configuration variables (API keys, secrets, etc.)
- `.env.template` - Template for `.env` with empty values (committed to repository)
- `.env.development` - Development-specific configuration (non-sensitive)
- `.env.staging` - Staging-specific configuration (non-sensitive)
- `.env.production` - Production-specific configuration (non-sensitive)

## Notes

- Comments and empty lines in the `.env` files are ignored.
- Variables are set using GitHub's `GITHUB_ENV` file, which makes them available to all subsequent steps in the job.
- Secret values in the `.env` file will be visible in the workflow logs. For sensitive information, use GitHub Secrets instead.
- The `.env` file should be added to `.gitignore` to prevent committing sensitive information.
