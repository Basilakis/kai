#!/usr/bin/env node

/**
 * PR Analyzer Script
 * Advanced analysis and categorization of pull requests for changelog generation
 */

const fs = require('fs');
const path = require('path');

class PRAnalyzer {
  constructor(prData, commits, files) {
    this.pr = prData;
    this.commits = commits;
    this.files = files;
  }

  /**
   * Analyze the PR and generate comprehensive metadata
   */
  analyze() {
    const analysis = {
      category: this.categorizeChange(),
      impact: this.assessImpact(),
      scope: this.determineScope(),
      breakingChanges: this.detectBreakingChanges(),
      relatedIssues: this.extractRelatedIssues(),
      description: this.generateDescription(),
      technicalDetails: this.extractTechnicalDetails()
    };

    return analysis;
  }

  /**
   * Categorize the type of change based on multiple signals
   */
  categorizeChange() {
    const title = this.pr.title.toLowerCase();
    const body = (this.pr.body || '').toLowerCase();
    const commitMessages = this.commits.map(c => c.commit.message.toLowerCase());
    const fileChanges = this.files.map(f => f.filename.toLowerCase());

    // Check for conventional commit patterns
    const conventionalPattern = /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?!?:/;
    const conventionalMatch = this.pr.title.match(conventionalPattern);
    
    if (conventionalMatch) {
      const type = conventionalMatch[1];
      const isBreaking = conventionalMatch[0].includes('!');
      
      if (isBreaking) return 'breaking';
      
      switch (type) {
        case 'feat': return 'added';
        case 'fix': return 'fixed';
        case 'docs': return 'documentation';
        case 'perf': return 'changed';
        case 'refactor': return 'changed';
        case 'test': return 'changed';
        case 'ci': case 'build': return 'changed';
        case 'revert': return 'removed';
        default: return 'changed';
      }
    }

    // Security-related changes
    if (this.containsSecurityKeywords(title, body, commitMessages)) {
      return 'security';
    }

    // Breaking changes
    if (this.containsBreakingKeywords(title, body, commitMessages)) {
      return 'breaking';
    }

    // Bug fixes
    if (this.containsBugFixKeywords(title, body, commitMessages)) {
      return 'fixed';
    }

    // Feature additions
    if (this.containsFeatureKeywords(title, body, commitMessages)) {
      return 'added';
    }

    // Deprecations
    if (this.containsDeprecationKeywords(title, body, commitMessages)) {
      return 'deprecated';
    }

    // Removals
    if (this.containsRemovalKeywords(title, body, commitMessages)) {
      return 'removed';
    }

    // Documentation only changes
    if (this.isDocumentationOnly(fileChanges)) {
      return 'documentation';
    }

    // Default to changed
    return 'changed';
  }

  /**
   * Assess the impact level of the changes
   */
  assessImpact() {
    const fileCount = this.files.length;
    const totalChanges = this.files.reduce((sum, f) => sum + f.changes, 0);
    const criticalFiles = this.files.filter(f => this.isCriticalFile(f.filename));
    
    if (criticalFiles.length > 0 || totalChanges > 500) {
      return 'high';
    } else if (fileCount > 10 || totalChanges > 100) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Determine the scope/area of changes
   */
  determineScope() {
    const scopes = new Set();
    
    this.files.forEach(file => {
      const filename = file.filename.toLowerCase();
      
      // Frontend/UI changes
      if (filename.includes('frontend') || filename.includes('client') || 
          filename.includes('ui') || filename.includes('components') ||
          filename.match(/\.(jsx?|tsx?|vue|svelte)$/)) {
        scopes.add('frontend');
      }
      
      // Backend/API changes
      if (filename.includes('backend') || filename.includes('server') || 
          filename.includes('api') || filename.includes('service') ||
          filename.match(/\.(py|java|go|rb|php)$/)) {
        scopes.add('backend');
      }
      
      // Database changes
      if (filename.includes('migration') || filename.includes('schema') ||
          filename.includes('database') || filename.includes('sql') ||
          filename.match(/\.(sql|migration)$/)) {
        scopes.add('database');
      }
      
      // Infrastructure changes
      if (filename.includes('docker') || filename.includes('k8s') ||
          filename.includes('terraform') || filename.includes('helm') ||
          filename.match(/\.(yml|yaml|tf|dockerfile)$/i)) {
        scopes.add('infrastructure');
      }
      
      // Documentation changes
      if (filename.match(/\.(md|rst|txt)$/i) || filename.includes('docs')) {
        scopes.add('documentation');
      }
      
      // Testing changes
      if (filename.includes('test') || filename.includes('spec') ||
          filename.match(/\.(test|spec)\./)) {
        scopes.add('testing');
      }
      
      // CI/CD changes
      if (filename.includes('.github') || filename.includes('ci') ||
          filename.includes('pipeline')) {
        scopes.add('ci-cd');
      }
    });
    
    return Array.from(scopes);
  }

  /**
   * Detect breaking changes
   */
  detectBreakingChanges() {
    const breakingIndicators = [];
    
    // Check title and body for breaking change indicators
    const text = `${this.pr.title} ${this.pr.body || ''}`.toLowerCase();
    
    if (text.includes('breaking change') || text.includes('breaking:')) {
      breakingIndicators.push('Explicitly marked as breaking change');
    }
    
    if (text.includes('!:') || this.pr.title.includes('!:')) {
      breakingIndicators.push('Conventional commit breaking change marker');
    }
    
    // Check for API version changes
    const apiVersionPattern = /api.*v\d+/i;
    if (apiVersionPattern.test(text)) {
      breakingIndicators.push('API version change detected');
    }
    
    // Check for major dependency updates
    const packageFiles = this.files.filter(f => 
      f.filename.includes('package.json') || 
      f.filename.includes('requirements.txt') ||
      f.filename.includes('Gemfile') ||
      f.filename.includes('pom.xml')
    );
    
    if (packageFiles.length > 0) {
      breakingIndicators.push('Dependency changes that may be breaking');
    }
    
    return breakingIndicators;
  }

  /**
   * Extract related issues from PR body
   */
  extractRelatedIssues() {
    const body = this.pr.body || '';
    const issuePatterns = [
      /(?:fixes?|closes?|resolves?)\s+#(\d+)/gi,
      /(?:fixes?|closes?|resolves?)\s+https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/(\d+)/gi
    ];
    
    const issues = new Set();
    
    issuePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(body)) !== null) {
        issues.add(parseInt(match[1]));
      }
    });
    
    return Array.from(issues);
  }

  /**
   * Generate a comprehensive description
   */
  generateDescription() {
    let description = this.pr.title;
    
    // Clean up the title
    description = description.replace(/^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?!?:\s*/i, '');
    
    // Add context from PR body if available
    if (this.pr.body && this.pr.body.length > 0) {
      const bodyLines = this.pr.body
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed && 
                 !trimmed.startsWith('#') && 
                 !trimmed.startsWith('-') &&
                 !trimmed.includes('checklist') &&
                 !trimmed.includes('[x]') &&
                 !trimmed.includes('[ ]');
        })
        .slice(0, 2);
      
      if (bodyLines.length > 0) {
        const additionalContext = bodyLines.join('. ').replace(/[#*]/g, '').trim();
        if (additionalContext.length > 0 && additionalContext.length < 200) {
          description += ` - ${additionalContext}`;
        }
      }
    }
    
    // Add scope information if significant
    const scopes = this.determineScope();
    if (scopes.length > 0 && scopes.length <= 3) {
      description += ` (${scopes.join(', ')})`;
    }
    
    return description;
  }

  /**
   * Extract technical details
   */
  extractTechnicalDetails() {
    return {
      filesChanged: this.files.length,
      linesAdded: this.files.reduce((sum, f) => sum + f.additions, 0),
      linesDeleted: this.files.reduce((sum, f) => sum + f.deletions, 0),
      commits: this.commits.length,
      largestFile: this.files.reduce((max, f) => f.changes > max.changes ? f : max, { changes: 0 }),
      languages: this.detectLanguages(),
      testFiles: this.files.filter(f => this.isTestFile(f.filename)).length
    };
  }

  // Helper methods
  containsSecurityKeywords(title, body, commits) {
    const securityKeywords = ['security', 'vulnerability', 'cve-', 'exploit', 'xss', 'csrf', 'injection'];
    const allText = [title, body, ...commits].join(' ').toLowerCase();
    return securityKeywords.some(keyword => allText.includes(keyword));
  }

  containsBreakingKeywords(title, body, commits) {
    const breakingKeywords = ['breaking', 'breaking change', '!:', 'major version', 'incompatible'];
    const allText = [title, body, ...commits].join(' ').toLowerCase();
    return breakingKeywords.some(keyword => allText.includes(keyword));
  }

  containsBugFixKeywords(title, body, commits) {
    const bugKeywords = ['fix', 'bug', 'patch', 'hotfix', 'fixes #', 'closes #', 'resolves #'];
    const allText = [title, body, ...commits].join(' ').toLowerCase();
    return bugKeywords.some(keyword => allText.includes(keyword));
  }

  containsFeatureKeywords(title, body, commits) {
    const featureKeywords = ['feat', 'feature', 'add', 'implement', 'new', 'enhancement', 'introduce'];
    const allText = [title, body, ...commits].join(' ').toLowerCase();
    return featureKeywords.some(keyword => allText.includes(keyword));
  }

  containsDeprecationKeywords(title, body, commits) {
    const deprecationKeywords = ['deprecat', 'obsolete', 'legacy'];
    const allText = [title, body, ...commits].join(' ').toLowerCase();
    return deprecationKeywords.some(keyword => allText.includes(keyword));
  }

  containsRemovalKeywords(title, body, commits) {
    const removalKeywords = ['remove', 'delete', 'drop', 'eliminate'];
    const allText = [title, body, ...commits].join(' ').toLowerCase();
    return removalKeywords.some(keyword => allText.includes(keyword));
  }

  isDocumentationOnly(fileChanges) {
    const docExtensions = ['.md', '.rst', '.txt', '.adoc'];
    const docPaths = ['docs/', 'documentation/', 'readme'];
    
    return fileChanges.every(filename => {
      return docExtensions.some(ext => filename.endsWith(ext)) ||
             docPaths.some(path => filename.includes(path));
    });
  }

  isCriticalFile(filename) {
    const criticalPatterns = [
      'package.json',
      'requirements.txt',
      'Dockerfile',
      'docker-compose',
      '.github/workflows',
      'migration',
      'schema',
      'config',
      'security'
    ];
    
    return criticalPatterns.some(pattern => filename.toLowerCase().includes(pattern));
  }

  isTestFile(filename) {
    return filename.includes('test') || 
           filename.includes('spec') || 
           filename.match(/\.(test|spec)\./);
  }

  detectLanguages() {
    const languageMap = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.jsx': 'React',
      '.tsx': 'React TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.cs': 'C#',
      '.cpp': 'C++',
      '.c': 'C',
      '.rs': 'Rust',
      '.kt': 'Kotlin',
      '.swift': 'Swift',
      '.dart': 'Dart',
      '.vue': 'Vue.js',
      '.svelte': 'Svelte'
    };
    
    const languages = new Set();
    
    this.files.forEach(file => {
      const ext = path.extname(file.filename);
      if (languageMap[ext]) {
        languages.add(languageMap[ext]);
      }
    });
    
    return Array.from(languages);
  }
}

module.exports = PRAnalyzer;

// If run directly, export for use in GitHub Actions
if (require.main === module) {
  console.log('PR Analyzer script loaded successfully');
}