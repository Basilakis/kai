# AI-Powered Changelog & PR Updates GitHub Action

This GitHub Action uses **OpenAI's GPT models** to intelligently analyze merged pull requests and automatically update your changelog with AI-generated summaries and smart categorization.

## 🤖 AI-Powered Features

### 🧠 Intelligent PR Analysis with OpenAI
- **AI-Driven Summarization**: Uses GPT-4o-mini to generate human-like, contextual PR summaries
- **Smart Categorization**: AI determines the most appropriate changelog category based on full context
- **Impact Assessment**: AI evaluates the significance and scope of changes
- **Breaking Change Detection**: Intelligent identification of breaking changes and API modifications
- **Technical Context Understanding**: AI comprehends code changes, file relationships, and project structure

### 📝 AI-Generated Changelog Entries
- **Context-Aware Descriptions**: AI creates meaningful, user-focused changelog entries
- **Automatic Scope Detection**: AI identifies affected areas (frontend, backend, infrastructure, etc.)
- **Confidence Scoring**: AI provides confidence levels for its analysis
- **Fallback Protection**: Rule-based analysis as backup when AI is unavailable

### 💬 Enhanced PR Comments
- **AI Analysis Results**: Shows AI confidence, technical summaries, and reasoning
- **Detailed Statistics**: Comprehensive change metrics and impact assessment
- **Professional Formatting**: Clean, structured comments with emojis and clear sections

## How It Works

1. **Trigger**: Activates when a PR is merged to main/master branch
2. **Context Gathering**: Collects PR data, commits, and file changes
3. **AI Analysis**: Sends structured data to OpenAI for intelligent analysis
4. **Smart Processing**: AI generates changelog entry, categorization, and technical summary
5. **Changelog Update**: Automatically updates the changelog with AI-generated content
6. **Git Operations**: Commits changes back to repository
7. **PR Comment**: Posts detailed AI analysis results on the original PR

## Setup Instructions

### 1. Prerequisites

**Required Secrets:**
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions
- `OPENAI_API_KEY`: Your OpenAI API key (required for AI analysis)

**Required Files:**
- `readme/CHANGELOG.md`: Your changelog file with proper structure

### 2. Add OpenAI API Key

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. In your GitHub repository, go to Settings → Secrets and variables → Actions
4. Add a new secret named `OPENAI_API_KEY` with your API key

### 3. Add the Workflow File

Create `.github/workflows/changelog-pr-updates.yml`:

```yaml
name: AI-Powered Changelog & PR Updates

on:
  pull_request:
    types: [closed]
    branches: [main, master]

permissions:
  contents: write
  pull-requests: write

jobs:
  ai-changelog-update:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          npm install @octokit/rest openai

      - name: AI-Powered PR Analysis and Changelog Update
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          PR_TITLE: ${{ github.event.pull_request.title }}
          PR_BODY: ${{ github.event.pull_request.body }}
          PR_URL: ${{ github.event.pull_request.html_url }}
          PR_AUTHOR: ${{ github.event.pull_request.user.login }}
          REPO_OWNER: ${{ github.repository_owner }}
          REPO_NAME: ${{ github.event.repository.name }}
        run: |
          node .github/scripts/ai-pr-analyzer.js

      - name: Commit changelog updates
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action Bot"
          
          if git diff --quiet readme/CHANGELOG.md; then
            echo "No changes to commit"
          else
            git add readme/CHANGELOG.md
            git commit -m "🤖 AI-generated changelog update for PR #${{ github.event.pull_request.number }}

            Automatically analyzed and categorized changes using OpenAI
            
            [skip ci]"
            git push
          fi
```

### 4. Add the AI Analyzer Script

The workflow references `.github/scripts/ai-pr-analyzer.js` which contains the AI analysis logic. This script:

- Gathers PR context (commits, files, metadata)
- Sends structured prompts to OpenAI for analysis
- Processes AI responses with validation
- Updates the changelog with AI-generated content
- Creates detailed PR comments with analysis results

### 5. Ensure Changelog Structure

Create or verify `readme/CHANGELOG.md` has this structure:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [1.0.0] - 2024-01-01

### Added
- Initial release
```

## AI Analysis Process

### 1. Context Collection
The system gathers comprehensive PR context:
- PR title, description, and metadata
- Commit messages and authors
- Changed files with statistics
- Repository and branch information

### 2. AI Prompt Engineering
A structured prompt is sent to OpenAI containing:
- Clear instructions for changelog generation
- PR context and technical details
- Expected JSON response format
- Guidelines for categorization and impact assessment

### 3. AI Response Processing
The AI returns structured analysis including:
- **Changelog Entry**: User-focused description of changes
- **Category**: Appropriate section (Added, Changed, Fixed, etc.)
- **Impact Level**: Low, Medium, or High
- **Scope**: Affected areas (frontend, backend, docs, etc.)
- **Breaking Changes**: Boolean flag for breaking changes
- **Technical Summary**: Developer-focused technical overview
- **Confidence**: AI's confidence in the analysis

### 4. Fallback Mechanism
If AI analysis fails, the system uses rule-based analysis:
- Pattern matching on PR titles and descriptions
- File extension and path analysis
- Conventional commit recognition
- Keyword-based categorization

## Example AI-Generated Output

### Changelog Entry
```markdown
### Added
- Implement real-time user authentication with OAuth2 and JWT token management (backend, security) ([#156](https://github.com/user/repo/pull/156))
```

### PR Comment
```markdown
## ✨ AI-Powered PR Analysis & Changelog Update

**🤖 AI Analysis Results:**
- **Type:** Added
- **Impact:** 🟡 Medium
- **Scope:** backend
- **Breaking Change:** ✅ No
- **AI Confidence:** high

**📊 Change Statistics:**
- **Files Changed:** 12
- **Lines Added:** +245
- **Lines Deleted:** -18
- **Commits:** 3

**📝 Generated Changelog Entry:**
```
Implement real-time user authentication with OAuth2 and JWT token management (backend, security) ([#156](https://github.com/user/repo/pull/156))
```

**🔍 Technical Summary:**
Added comprehensive authentication system with OAuth2 integration, JWT token management, and secure session handling. Includes middleware for route protection and user session persistence.

**📋 Changelog Location:**
The changelog has been automatically updated in `readme/CHANGELOG.md` under the **[Unreleased] → Added** section.

---
*This analysis was generated using OpenAI gpt-4o-mini and automatically applied to the changelog.*
```

## Configuration Options

### AI Model Settings
The action uses configurable AI settings:
- **Model**: `gpt-4o-mini` (cost-effective, fast)
- **Max Tokens**: 1000 (sufficient for analysis)
- **Temperature**: 0.3 (balanced creativity/consistency)

### Customization Options
- **Changelog Path**: Modify `changelogPath` in the script
- **File Limits**: Adjust `maxFilesToAnalyze` and `maxCommitsToAnalyze`
- **AI Parameters**: Tune model, temperature, and token limits

### Branch Configuration
- **Target Branches**: Modify the `branches` array in workflow
- **Trigger Events**: Customize the `on` section for different events

## Advanced Features

### 1. Intelligent Scope Detection
AI analyzes file paths and changes to determine:
- **Frontend**: UI components, styles, client-side code
- **Backend**: Server logic, APIs, database changes
- **Infrastructure**: DevOps, deployment, configuration
- **Documentation**: README, docs, comments

### 2. Breaking Change Analysis
AI identifies breaking changes through:
- API signature modifications
- Database schema changes
- Configuration requirement changes
- Dependency version bumps

### 3. Impact Assessment
AI evaluates change impact based on:
- **Low**: Documentation, minor fixes, internal refactoring
- **Medium**: Feature additions, non-breaking API changes
- **High**: Major features, breaking changes, security fixes

### 4. Confidence Scoring
AI provides confidence levels:
- **High**: Clear categorization with strong signals
- **Medium**: Reasonable categorization with some ambiguity
- **Low**: Uncertain categorization, may need review

## Troubleshooting

### Common Issues

**1. OpenAI API Errors**
- Verify `OPENAI_API_KEY` is correctly set in repository secrets
- Check API key has sufficient credits and permissions
- Monitor rate limits and usage quotas

**2. Changelog Not Updating**
- Ensure `readme/CHANGELOG.md` exists with proper structure
- Verify `[Unreleased]` section is present
- Check file permissions and repository access

**3. AI Analysis Failures**
- System automatically falls back to rule-based analysis
- Check GitHub Actions logs for detailed error messages
- Verify network connectivity and API availability

**4. Permission Issues**
- Ensure workflow has `contents: write` and `pull-requests: write`
- Verify `GITHUB_TOKEN` has necessary permissions
- Check repository settings for Actions permissions

### Debug Information

The action provides comprehensive logging:
- AI request/response details
- Fallback analysis triggers
- Changelog update confirmations
- Error handling and recovery

## Best Practices

### For Better AI Analysis

1. **Clear PR Titles**: Use descriptive, specific titles
   - ✅ "Add OAuth2 authentication with JWT tokens"
   - ❌ "Auth stuff"

2. **Detailed Descriptions**: Provide context and rationale
   - Explain what changed and why
   - Reference related issues
   - Mention breaking changes explicitly

3. **Logical Commits**: Use meaningful commit messages
   - Follow conventional commit format when possible
   - Group related changes together

4. **Structured Changes**: Organize code changes logically
   - Separate concerns into different files
   - Use clear file and directory naming

### Cost Management

1. **Monitor Usage**: Track OpenAI API usage and costs
2. **Optimize Prompts**: Keep prompts concise but informative
3. **Set Limits**: Configure reasonable file and commit limits
4. **Use Efficiently**: Consider AI analysis for significant PRs only

### Quality Assurance

1. **Review AI Output**: Periodically review AI-generated entries
2. **Manual Adjustments**: Edit entries when AI categorization needs refinement
3. **Feedback Loop**: Use patterns in AI mistakes to improve prompts
4. **Fallback Monitoring**: Ensure rule-based fallback works correctly

## Security Considerations

1. **API Key Protection**: Store OpenAI API key securely in GitHub Secrets
2. **Minimal Permissions**: Use least-privilege access for tokens
3. **Data Privacy**: Be aware that PR content is sent to OpenAI
4. **Rate Limiting**: Implement appropriate rate limiting for API calls

## Contributing

To improve this AI-powered GitHub Action:

1. Fork the repository
2. Enhance the AI prompts or analysis logic
3. Test with various PR types and scenarios
4. Submit pull requests with clear descriptions
5. Document any new features or improvements

## License

This AI-powered GitHub Action configuration is provided as-is for use in your projects. Modify and distribute freely according to your needs.