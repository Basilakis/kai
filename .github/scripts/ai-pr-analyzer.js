const { Octokit } = require('@octokit/rest');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Initialize clients
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuration
const CONFIG = {
  maxTokens: 1000,
  temperature: 0.3,
  model: 'gpt-4o-mini', // Cost-effective model for this task
  changelogPath: 'readme/CHANGELOG.md',
  maxFilesToAnalyze: 20,
  maxCommitsToAnalyze: 10,
};

class AIPRAnalyzer {
  constructor() {
    this.prData = {
      number: process.env.PR_NUMBER,
      title: process.env.PR_TITLE,
      body: process.env.PR_BODY || '',
      url: process.env.PR_URL,
      author: process.env.PR_AUTHOR,
      owner: process.env.REPO_OWNER,
      repo: process.env.REPO_NAME,
    };
  }

  async analyzePR() {
    try {
      console.log(`🤖 Starting AI analysis for PR #${this.prData.number}: ${this.prData.title}`);

      // Gather PR context
      const context = await this.gatherPRContext();
      
      // Analyze with AI
      const analysis = await this.performAIAnalysis(context);
      
      // Update changelog
      await this.updateChangelog(analysis);
      
      // Create PR comment
      await this.createPRComment(analysis, context);
      
      console.log('✅ AI analysis and changelog update completed successfully');
      
    } catch (error) {
      console.error('❌ Error in AI PR analysis:', error);
      process.exit(1);
    }
  }

  async gatherPRContext() {
    console.log('📊 Gathering PR context...');

    // Get commits
    const commits = await octokit.rest.pulls.listCommits({
      owner: this.prData.owner,
      repo: this.prData.repo,
      pull_number: this.prData.number,
    });

    // Get changed files
    const files = await octokit.rest.pulls.listFiles({
      owner: this.prData.owner,
      repo: this.prData.repo,
      pull_number: this.prData.number,
    });

    // Process and limit data for AI analysis
    const processedCommits = commits.data
      .slice(0, CONFIG.maxCommitsToAnalyze)
      .map(commit => ({
        message: commit.commit.message,
        author: commit.commit.author.name,
      }));

    const processedFiles = files.data
      .slice(0, CONFIG.maxFilesToAnalyze)
      .map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
      }));

    return {
      pr: {
        title: this.prData.title,
        body: this.prData.body,
        author: this.prData.author,
      },
      commits: processedCommits,
      files: processedFiles,
      stats: {
        totalFiles: files.data.length,
        totalCommits: commits.data.length,
        totalAdditions: files.data.reduce((sum, f) => sum + f.additions, 0),
        totalDeletions: files.data.reduce((sum, f) => sum + f.deletions, 0),
      },
    };
  }

  async performAIAnalysis(context) {
    console.log('🧠 Performing AI analysis...');

    const prompt = this.buildAnalysisPrompt(context);

    try {
      const response = await openai.chat.completions.create({
        model: CONFIG.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert software engineer analyzing pull requests for changelog generation. 
            You must respond with valid JSON only, no additional text or formatting.
            
            Analyze the PR and provide:
            1. A clear, concise changelog entry (1-2 sentences max)
            2. The appropriate category (Added, Changed, Fixed, Deprecated, Removed, Security)
            3. Impact level (Low, Medium, High)
            4. Scope/area affected (frontend, backend, api, docs, infrastructure, etc.)
            5. Whether it's a breaking change
            6. A brief technical summary for the PR comment
            
            Focus on user-facing changes and business value, not implementation details.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: CONFIG.maxTokens,
        temperature: CONFIG.temperature,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      // Validate and set defaults
      return {
        changelogEntry: analysis.changelogEntry || this.prData.title,
        category: this.validateCategory(analysis.category),
        impact: analysis.impact || 'Medium',
        scope: analysis.scope || 'general',
        isBreaking: analysis.isBreaking || false,
        technicalSummary: analysis.technicalSummary || 'No technical summary provided',
        confidence: analysis.confidence || 'medium',
      };

    } catch (error) {
      console.warn('⚠️ AI analysis failed, falling back to rule-based analysis:', error.message);
      return this.fallbackAnalysis(context);
    }
  }

  buildAnalysisPrompt(context) {
    return `Analyze this pull request for changelog generation:

**PR Title:** ${context.pr.title}

**PR Description:**
${context.pr.body || 'No description provided'}

**Commit Messages:**
${context.commits.map(c => `- ${c.message}`).join('\n')}

**Changed Files (${context.files.length} of ${context.stats.totalFiles}):**
${context.files.map(f => `- ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`).join('\n')}

**Statistics:**
- Total files changed: ${context.stats.totalFiles}
- Total commits: ${context.stats.totalCommits}
- Lines added: ${context.stats.totalAdditions}
- Lines deleted: ${context.stats.totalDeletions}

Respond with JSON containing:
{
  "changelogEntry": "Clear, user-focused description of what changed",
  "category": "Added|Changed|Fixed|Deprecated|Removed|Security",
  "impact": "Low|Medium|High",
  "scope": "area affected (e.g., frontend, backend, api, docs)",
  "isBreaking": boolean,
  "technicalSummary": "Brief technical overview for developers",
  "confidence": "low|medium|high"
}`;
  }

  validateCategory(category) {
    const validCategories = ['Added', 'Changed', 'Fixed', 'Deprecated', 'Removed', 'Security'];
    return validCategories.includes(category) ? category : 'Changed';
  }

  fallbackAnalysis(context) {
    console.log('🔄 Using fallback rule-based analysis...');
    
    const title = context.pr.title.toLowerCase();
    const body = context.pr.body.toLowerCase();
    
    let category = 'Changed';
    let impact = 'Medium';
    
    // Simple rule-based categorization
    if (title.includes('feat') || title.includes('add') || title.includes('new')) {
      category = 'Added';
    } else if (title.includes('fix') || title.includes('bug') || body.includes('fixes #')) {
      category = 'Fixed';
    } else if (title.includes('security') || title.includes('vulnerability')) {
      category = 'Security';
      impact = 'High';
    } else if (title.includes('remove') || title.includes('delete')) {
      category = 'Removed';
    } else if (title.includes('deprecat')) {
      category = 'Deprecated';
    }

    // Determine scope from files
    const fileTypes = context.files.map(f => f.filename.toLowerCase());
    let scope = 'general';
    
    if (fileTypes.some(f => f.includes('frontend') || f.includes('ui') || f.includes('.vue') || f.includes('.jsx'))) {
      scope = 'frontend';
    } else if (fileTypes.some(f => f.includes('backend') || f.includes('api') || f.includes('server'))) {
      scope = 'backend';
    } else if (fileTypes.some(f => f.includes('doc') || f.includes('readme') || f.includes('.md'))) {
      scope = 'documentation';
    }

    return {
      changelogEntry: context.pr.title,
      category,
      impact,
      scope,
      isBreaking: title.includes('breaking') || body.includes('breaking change'),
      technicalSummary: `${category.toLowerCase()} changes affecting ${scope}`,
      confidence: 'low',
    };
  }

  async updateChangelog(analysis) {
    console.log('📝 Updating changelog...');

    try {
      let changelogContent = fs.readFileSync(CONFIG.changelogPath, 'utf8');
      
      // Create changelog entry
      let changeEntry = `- ${analysis.changelogEntry}`;
      
      // Add scope if not general
      if (analysis.scope && analysis.scope !== 'general') {
        changeEntry += ` (${analysis.scope})`;
      }
      
      // Mark breaking changes
      if (analysis.isBreaking) {
        changeEntry = `- **BREAKING:** ${analysis.changelogEntry}`;
      }
      
      // Add PR link
      changeEntry += ` ([#${this.prData.number}](${this.prData.url}))`;

      // Find and update the [Unreleased] section
      const unreleasedRegex = /## \[Unreleased\]([\s\S]*?)(?=## \[|$)/;
      const unreleasedMatch = changelogContent.match(unreleasedRegex);
      
      if (!unreleasedMatch) {
        throw new Error('Could not find [Unreleased] section in changelog');
      }

      let unreleasedSection = unreleasedMatch[1];
      
      // Add or update the category section
      const targetSection = analysis.category;
      const sectionRegex = new RegExp(`### ${targetSection}([\\s\\S]*?)(?=### |$)`);
      const sectionMatch = unreleasedSection.match(sectionRegex);
      
      if (sectionMatch) {
        // Section exists, add to it
        const existingEntries = sectionMatch[1].trim();
        const newSectionContent = existingEntries 
          ? `### ${targetSection}\n${existingEntries}\n${changeEntry}\n`
          : `### ${targetSection}\n${changeEntry}\n`;
        
        unreleasedSection = unreleasedSection.replace(sectionRegex, newSectionContent);
      } else {
        // Section doesn't exist, create it in the right order
        const sectionOrder = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
        const targetIndex = sectionOrder.indexOf(targetSection);
        
        let insertPosition = unreleasedSection.length;
        for (let i = targetIndex + 1; i < sectionOrder.length; i++) {
          const nextSectionRegex = new RegExp(`### ${sectionOrder[i]}`);
          const nextSectionMatch = unreleasedSection.search(nextSectionRegex);
          if (nextSectionMatch !== -1) {
            insertPosition = nextSectionMatch;
            break;
          }
        }
        
        const newSection = `\n### ${targetSection}\n${changeEntry}\n`;
        unreleasedSection = unreleasedSection.slice(0, insertPosition) + newSection + unreleasedSection.slice(insertPosition);
      }
      
      // Update the changelog content
      const updatedChangelog = changelogContent.replace(unreleasedRegex, `## [Unreleased]${unreleasedSection}`);
      
      // Write the updated changelog
      fs.writeFileSync(CONFIG.changelogPath, updatedChangelog);
      
      console.log(`✅ Added changelog entry: ${changeEntry}`);
      
    } catch (error) {
      console.error('❌ Error updating changelog:', error);
      throw error;
    }
  }

  async createPRComment(analysis, context) {
    console.log('💬 Creating PR comment...');

    const impactEmojis = {
      'Low': '🟢',
      'Medium': '🟡', 
      'High': '🔴'
    };

    const categoryEmojis = {
      'Added': '✨',
      'Changed': '🔄',
      'Fixed': '🐛',
      'Deprecated': '⚠️',
      'Removed': '🗑️',
      'Security': '🔒'
    };

    const emoji = categoryEmojis[analysis.category] || '📝';
    const impactEmoji = impactEmojis[analysis.impact] || '🟡';

    const comment = `## ${emoji} AI-Powered PR Analysis & Changelog Update

**🤖 AI Analysis Results:**
- **Type:** ${analysis.category}
- **Impact:** ${impactEmoji} ${analysis.impact}
- **Scope:** ${analysis.scope}
- **Breaking Change:** ${analysis.isBreaking ? '💥 Yes' : '✅ No'}
- **AI Confidence:** ${analysis.confidence}

**📊 Change Statistics:**
- **Files Changed:** ${context.stats.totalFiles}
- **Lines Added:** +${context.stats.totalAdditions}
- **Lines Deleted:** -${context.stats.totalDeletions}
- **Commits:** ${context.stats.totalCommits}

**📝 Generated Changelog Entry:**
\`\`\`
${analysis.changelogEntry}${analysis.scope !== 'general' ? ` (${analysis.scope})` : ''} ([#${this.prData.number}](${this.prData.url}))
\`\`\`

**🔍 Technical Summary:**
${analysis.technicalSummary}

**📋 Changelog Location:**
The changelog has been automatically updated in \`${CONFIG.changelogPath}\` under the **[Unreleased] → ${analysis.category}** section.

---
*This analysis was generated using OpenAI ${CONFIG.model} and automatically applied to the changelog.*`;

    try {
      await octokit.rest.issues.createComment({
        owner: this.prData.owner,
        repo: this.prData.repo,
        issue_number: this.prData.number,
        body: comment,
      });
      
      console.log('✅ PR comment created successfully');
    } catch (error) {
      console.error('❌ Error creating PR comment:', error);
      // Don't fail the entire process if comment creation fails
    }
  }
}

// Main execution
async function main() {
  // Validate required environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  if (!process.env.GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  const analyzer = new AIPRAnalyzer();
  await analyzer.analyzePR();
}

// Run the analyzer
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});