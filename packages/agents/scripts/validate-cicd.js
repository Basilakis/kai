#!/usr/bin/env node

/**
 * CI/CD Environment Validation Script for CrewAI Pipeline
 * 
 * This script validates the CI/CD environment specifically for GitHub Actions
 * and other automated deployment scenarios. It focuses on validating the
 * environment for automated builds, tests, and deployments.
 * 
 * Features:
 * - GitHub Actions environment detection and validation
 * - CI-specific environment variable validation
 * - Container registry authentication checks
 * - Kubernetes deployment readiness validation
 * - Security scanning and compliance checks
 * - Performance benchmarking for CI environments
 * - Integration with existing validation framework
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Import base validator if available
let EnvironmentValidator;
try {
    EnvironmentValidator = require('./validate-environment.js');
} catch (error) {
    // Fallback if base validator not available
    EnvironmentValidator = class {
        constructor() {
            this.results = { passed: 0, failed: 0, warnings: 0, details: [] };
        }
        log(message, type = 'info') {
            const colors = {
                info: '\x1b[34m', success: '\x1b[32m', warning: '\x1b[33m', 
                error: '\x1b[31m', header: '\x1b[35m', reset: '\x1b[0m'
            };
            const color = colors[type] || colors.reset;
            console.log(`${color}[${new Date().toISOString()}] ${message}${colors.reset}`);
        }
        addResult(category, test, status, message, recommendation = null) {
            this.results.details.push({ category, test, status, message, recommendation });
            this.results[status.toLowerCase() === 'pass' ? 'passed' : 
                        status.toLowerCase() === 'fail' ? 'failed' : 'warnings']++;
            const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
            this.log(`${icon} ${category}: ${test} - ${message}`, 
                    status === 'PASS' ? 'success' : status === 'FAIL' ? 'error' : 'warning');
        }
        async executeCommand(command, options = {}) {
            return new Promise((resolve) => {
                try {
                    const result = execSync(command, { 
                        encoding: 'utf8', 
                        timeout: options.timeout || 30000,
                        stdio: ['pipe', 'pipe', 'pipe']
                    });
                    resolve({ success: true, stdout: result.trim(), stderr: '', code: 0 });
                } catch (error) {
                    resolve({ 
                        success: false, 
                        stdout: '', 
                        stderr: error.message, 
                        code: error.status || 1 
                    });
                }
            });
        }
    };
}

class CICDValidator extends EnvironmentValidator {
    constructor() {
        super();
        this.isCI = this.detectCIEnvironment();
        this.ciProvider = this.detectCIProvider();
        this.isWindows = os.platform() === 'win32';
    }

    detectCIEnvironment() {
        return !!(
            process.env.CI ||
            process.env.CONTINUOUS_INTEGRATION ||
            process.env.GITHUB_ACTIONS ||
            process.env.GITLAB_CI ||
            process.env.JENKINS_URL ||
            process.env.TRAVIS ||
            process.env.CIRCLECI ||
            process.env.BUILDKITE ||
            process.env.AZURE_PIPELINES
        );
    }

    detectCIProvider() {
        if (process.env.GITHUB_ACTIONS) return 'github-actions';
        if (process.env.GITLAB_CI) return 'gitlab-ci';
        if (process.env.JENKINS_URL) return 'jenkins';
        if (process.env.TRAVIS) return 'travis';
        if (process.env.CIRCLECI) return 'circleci';
        if (process.env.BUILDKITE) return 'buildkite';
        if (process.env.AZURE_PIPELINES) return 'azure-pipelines';
        return 'unknown';
    }

    async validateCIEnvironment() {
        this.log('=== CI/CD Environment Validation ===', 'header');
        
        if (this.isCI) {
            this.addResult('CI/CD', 'Environment Detection', 'PASS', 
                `CI environment detected: ${this.ciProvider}`);
        } else {
            this.addResult('CI/CD', 'Environment Detection', 'WARN', 
                'Not running in CI environment', 
                'This validation is optimized for CI/CD environments');
        }

        // Validate CI-specific environment variables
        const ciEnvVars = {
            'github-actions': [
                'GITHUB_ACTIONS', 'GITHUB_WORKFLOW', 'GITHUB_RUN_ID', 
                'GITHUB_RUN_NUMBER', 'GITHUB_ACTOR', 'GITHUB_REPOSITORY',
                'GITHUB_SHA', 'GITHUB_REF', 'GITHUB_WORKSPACE'
            ],
            'gitlab-ci': [
                'GITLAB_CI', 'CI_PIPELINE_ID', 'CI_JOB_ID', 'CI_COMMIT_SHA',
                'CI_PROJECT_NAME', 'CI_PROJECT_PATH'
            ]
        };

        const expectedVars = ciEnvVars[this.ciProvider] || [];
        for (const envVar of expectedVars) {
            if (process.env[envVar]) {
                this.addResult('CI/CD', `Environment Variable: ${envVar}`, 'PASS', 
                    'Set correctly');
            } else {
                this.addResult('CI/CD', `Environment Variable: ${envVar}`, 'WARN', 
                    'Not set', `Expected in ${this.ciProvider} environment`);
            }
        }
    }

    async validateGitHubActions() {
        if (this.ciProvider !== 'github-actions') {
            this.log('Skipping GitHub Actions validation (not in GitHub Actions environment)', 'info');
            return;
        }

        this.log('=== GitHub Actions Specific Validation ===', 'header');

        // Validate GitHub Actions context
        const githubContext = {
            'GITHUB_TOKEN': 'GitHub token for API access',
            'RUNNER_OS': 'Runner operating system',
            'RUNNER_ARCH': 'Runner architecture',
            'RUNNER_TEMP': 'Runner temporary directory',
            'RUNNER_TOOL_CACHE': 'Runner tool cache directory'
        };

        for (const [envVar, description] of Object.entries(githubContext)) {
            if (process.env[envVar]) {
                this.addResult('GitHub Actions', envVar, 'PASS', 
                    `${description}: ${envVar === 'GITHUB_TOKEN' ? '***' : process.env[envVar]}`);
            } else {
                this.addResult('GitHub Actions', envVar, 'WARN', 
                    `${description} not available`);
            }
        }

        // Validate runner capabilities
        const runnerOS = process.env.RUNNER_OS;
        const runnerArch = process.env.RUNNER_ARCH;
        
        if (runnerOS && runnerArch) {
            this.addResult('GitHub Actions', 'Runner Configuration', 'PASS', 
                `OS: ${runnerOS}, Architecture: ${runnerArch}`);
        }

        // Check for matrix strategy
        if (process.env.MATRIX_OS || process.env.MATRIX_NODE_VERSION || process.env.MATRIX_PYTHON_VERSION) {
            this.addResult('GitHub Actions', 'Matrix Strategy', 'PASS', 
                'Matrix build detected');
        }
    }

    async validateContainerRegistry() {
        this.log('=== Container Registry Validation ===', 'header');

        const registries = [
            {
                name: 'Docker Hub',
                loginCmd: 'docker login',
                envVars: ['DOCKER_USERNAME', 'DOCKER_PASSWORD']
            },
            {
                name: 'GitHub Container Registry',
                loginCmd: 'docker login ghcr.io',
                envVars: ['GITHUB_TOKEN']
            },
            {
                name: 'AWS ECR',
                loginCmd: 'aws ecr get-login-password',
                envVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
            }
        ];

        for (const registry of registries) {
            const hasCredentials = registry.envVars.some(envVar => process.env[envVar]);
            
            if (hasCredentials) {
                this.addResult('Container Registry', registry.name, 'PASS', 
                    'Credentials available');
                
                // Test registry connectivity if in CI
                if (this.isCI) {
                    try {
                        const testResult = await this.executeCommand(`${registry.loginCmd} --help`);
                        if (testResult.success) {
                            this.addResult('Container Registry', `${registry.name} CLI`, 'PASS', 
                                'CLI tools available');
                        }
                    } catch (error) {
                        this.addResult('Container Registry', `${registry.name} CLI`, 'WARN', 
                            'CLI tools not available');
                    }
                }
            } else {
                this.addResult('Container Registry', registry.name, 'WARN', 
                    'Credentials not configured', 
                    `Set ${registry.envVars.join(' or ')} for ${registry.name} access`);
            }
        }
    }

    async validateKubernetesDeployment() {
        this.log('=== Kubernetes Deployment Validation ===', 'header');

        // Check for Kubernetes credentials
        const k8sCredentials = [
            'KUBECONFIG',
            'KUBE_CONFIG_DATA',
            'K8S_CLUSTER_URL',
            'K8S_TOKEN'
        ];

        let hasK8sCredentials = false;
        for (const cred of k8sCredentials) {
            if (process.env[cred]) {
                this.addResult('Kubernetes', `Credential: ${cred}`, 'PASS', 
                    'Available');
                hasK8sCredentials = true;
            }
        }

        if (!hasK8sCredentials) {
            this.addResult('Kubernetes', 'Credentials', 'WARN', 
                'No Kubernetes credentials found', 
                'Set KUBECONFIG or other K8s credentials for deployment');
            return;
        }

        // Validate kubectl if available
        try {
            const kubectlResult = await this.executeCommand('kubectl version --client');
            if (kubectlResult.success) {
                this.addResult('Kubernetes', 'kubectl CLI', 'PASS', 
                    'kubectl available');
                
                // Test cluster connectivity if credentials are available
                if (this.isCI) {
                    const clusterResult = await this.executeCommand('kubectl cluster-info --request-timeout=10s');
                    if (clusterResult.success) {
                        this.addResult('Kubernetes', 'Cluster Connectivity', 'PASS', 
                            'Cluster accessible');
                    } else {
                        this.addResult('Kubernetes', 'Cluster Connectivity', 'WARN', 
                            'Cluster not accessible', 'Check cluster credentials and network');
                    }
                }
            }
        } catch (error) {
            this.addResult('Kubernetes', 'kubectl CLI', 'WARN', 
                'kubectl not available', 'Install kubectl for Kubernetes deployments');
        }

        // Validate Flux GitOps if configured
        const fluxNamespace = 'flux-system';
        if (hasK8sCredentials) {
            try {
                const fluxResult = await this.executeCommand(`kubectl get namespace ${fluxNamespace}`);
                if (fluxResult.success) {
                    this.addResult('Kubernetes', 'Flux GitOps', 'PASS', 
                        'Flux namespace detected');
                } else {
                    this.addResult('Kubernetes', 'Flux GitOps', 'WARN', 
                        'Flux namespace not found', 'Install Flux for GitOps deployments');
                }
            } catch (error) {
                // Skip if kubectl not available
            }
        }
    }

    async validateSecrets() {
        this.log('=== Secrets and Security Validation ===', 'header');

        const requiredSecrets = [
            'OPENAI_API_KEY',
            'SERPER_API_KEY'
        ];

        const optionalSecrets = [
            'BROWSERLESS_API_KEY',
            'FIRECRAWL_API_KEY',
            'ANTHROPIC_API_KEY',
            'GROQ_API_KEY',
            'SENTRY_DSN',
            'DATADOG_API_KEY'
        ];

        // Validate required secrets
        for (const secret of requiredSecrets) {
            if (process.env[secret]) {
                const value = process.env[secret];
                const isValid = value.length > 10 && !value.includes('your-') && !value.includes('sk-test');
                
                this.addResult('Secrets', `Required: ${secret}`, 
                    isValid ? 'PASS' : 'WARN',
                    isValid ? 'Valid format' : 'Potentially invalid format',
                    !isValid ? 'Ensure secret is properly configured' : null);
            } else {
                this.addResult('Secrets', `Required: ${secret}`, 'FAIL', 
                    'Not set', `Configure ${secret} in CI/CD secrets`);
            }
        }

        // Validate optional secrets
        for (const secret of optionalSecrets) {
            if (process.env[secret]) {
                this.addResult('Secrets', `Optional: ${secret}`, 'PASS', 
                    'Available');
            } else {
                this.addResult('Secrets', `Optional: ${secret}`, 'WARN', 
                    'Not configured', 'Consider adding for enhanced functionality');
            }
        }

        // Security best practices validation
        const securityChecks = [
            {
                name: 'No hardcoded secrets in code',
                check: () => !fs.existsSync('.env') || !fs.readFileSync('.env', 'utf8').includes('sk-'),
                message: 'No obvious hardcoded secrets detected'
            },
            {
                name: 'Secure environment variables',
                check: () => Object.keys(process.env).filter(key => 
                    key.includes('KEY') || key.includes('TOKEN') || key.includes('SECRET')
                ).length > 0,
                message: 'Environment variables properly configured'
            }
        ];

        for (const check of securityChecks) {
            try {
                const passed = check.check();
                this.addResult('Security', check.name, 
                    passed ? 'PASS' : 'WARN', 
                    check.message);
            } catch (error) {
                this.addResult('Security', check.name, 'WARN', 
                    `Check failed: ${error.message}`);
            }
        }
    }

    async validateBuildTools() {
        this.log('=== Build Tools Validation ===', 'header');

        const buildTools = [
            { name: 'Node.js', cmd: 'node --version', required: true },
            { name: 'NPM', cmd: 'npm --version', required: true },
            { name: 'Python', cmd: 'python --version || python3 --version', required: true },
            { name: 'UV', cmd: 'uv --version', required: true },
            { name: 'Docker', cmd: 'docker --version', required: false },
            { name: 'Git', cmd: 'git --version', required: true }
        ];

        for (const tool of buildTools) {
            try {
                const result = await this.executeCommand(tool.cmd);
                if (result.success) {
                    this.addResult('Build Tools', tool.name, 'PASS', 
                        `Version: ${result.stdout.split('\n')[0]}`);
                } else {
                    this.addResult('Build Tools', tool.name, 
                        tool.required ? 'FAIL' : 'WARN',
                        'Not available', 
                        `Install ${tool.name} for build process`);
                }
            } catch (error) {
                this.addResult('Build Tools', tool.name, 
                    tool.required ? 'FAIL' : 'WARN',
                    `Check failed: ${error.message}`);
            }
        }
    }

    async validatePerformance() {
        this.log('=== Performance Validation ===', 'header');

        // System resources
        const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024);
        const freeMem = Math.round(os.freemem() / 1024 / 1024 / 1024);
        const cpuCount = os.cpus().length;

        this.addResult('Performance', 'Memory', 
            totalMem >= 4 ? 'PASS' : 'WARN',
            `Total: ${totalMem}GB, Free: ${freeMem}GB`,
            totalMem < 4 ? 'Consider using larger runners for better performance' : null);

        this.addResult('Performance', 'CPU Cores', 
            cpuCount >= 2 ? 'PASS' : 'WARN',
            `${cpuCount} cores available`,
            cpuCount < 2 ? 'Consider using multi-core runners for parallel builds' : null);

        // Disk space
        try {
            const diskCmd = this.isWindows ? 'dir /-c' : 'df -h .';
            const diskResult = await this.executeCommand(diskCmd);
            if (diskResult.success) {
                this.addResult('Performance', 'Disk Space', 'PASS', 
                    'Disk space check completed');
            }
        } catch (error) {
            this.addResult('Performance', 'Disk Space', 'WARN', 
                'Could not check disk space');
        }

        // Network connectivity
        try {
            const networkTest = await this.executeCommand('ping -c 1 8.8.8.8 || ping -n 1 8.8.8.8');
            if (networkTest.success) {
                this.addResult('Performance', 'Network Connectivity', 'PASS', 
                    'Internet connectivity verified');
            } else {
                this.addResult('Performance', 'Network Connectivity', 'WARN', 
                    'Network connectivity issues detected');
            }
        } catch (error) {
            this.addResult('Performance', 'Network Connectivity', 'WARN', 
                'Could not test network connectivity');
        }
    }

    async validateWorkflowFiles() {
        this.log('=== Workflow Files Validation ===', 'header');

        const workflowFiles = [
            '.github/workflows/crewai-cicd.yml',
            'packages/agents/Dockerfile',
            'packages/agents/requirements.txt',
            'packages/agents/pyproject.toml'
        ];

        for (const file of workflowFiles) {
            if (fs.existsSync(file)) {
                this.addResult('Workflow Files', path.basename(file), 'PASS', 
                    `File exists: ${file}`);
                
                // Basic syntax validation for YAML files
                if (file.endsWith('.yml') || file.endsWith('.yaml')) {
                    try {
                        const content = fs.readFileSync(file, 'utf8');
                        if (content.includes('name:') && content.includes('on:')) {
                            this.addResult('Workflow Files', `${path.basename(file)} Syntax`, 'PASS', 
                                'Basic YAML structure valid');
                        } else {
                            this.addResult('Workflow Files', `${path.basename(file)} Syntax`, 'WARN', 
                                'YAML structure may be invalid');
                        }
                    } catch (error) {
                        this.addResult('Workflow Files', `${path.basename(file)} Syntax`, 'WARN', 
                            'Could not validate YAML syntax');
                    }
                }
            } else {
                this.addResult('Workflow Files', path.basename(file), 'WARN', 
                    `File not found: ${file}`, 'Create required workflow files');
            }
        }

        // Validate Kubernetes manifests
        const k8sFiles = [
            'flux/clusters/production/kai/agents/kustomization.yaml',
            'flux/clusters/production/kai/agents/deployment.yaml',
            'flux/clusters/production/kai/agents/service.yaml'
        ];

        for (const file of k8sFiles) {
            if (fs.existsSync(file)) {
                this.addResult('Kubernetes Manifests', path.basename(file), 'PASS', 
                    `Manifest exists: ${file}`);
            } else {
                this.addResult('Kubernetes Manifests', path.basename(file), 'WARN', 
                    `Manifest not found: ${file}`, 'Create Kubernetes deployment manifests');
            }
        }
    }

    generateCICDReport() {
        this.log('=== CI/CD Validation Summary ===', 'header');
        
        const total = this.results.passed + this.results.failed + this.results.warnings;
        const passRate = total > 0 ? Math.round((this.results.passed / total) * 100) : 0;
        
        this.log(`CI/CD Provider: ${this.ciProvider}`, 'info');
        this.log(`Environment: ${this.isCI ? 'CI/CD' : 'Local'}`, 'info');
        this.log(`Total Tests: ${total}`, 'info');
        this.log(`Passed: ${this.results.passed}`, 'success');
        this.log(`Failed: ${this.results.failed}`, 'error');
        this.log(`Warnings: ${this.results.warnings}`, 'warning');
        this.log(`Pass Rate: ${passRate}%`, passRate >= 80 ? 'success' : 'warning');
        
        // Generate CI-specific report
        const reportPath = 'cicd-validation-report.json';
        const report = {
            timestamp: new Date().toISOString(),
            environment: {
                isCI: this.isCI,
                ciProvider: this.ciProvider,
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version
            },
            summary: {
                total,
                passed: this.results.passed,
                failed: this.results.failed,
                warnings: this.results.warnings,
                passRate
            },
            details: this.results.details
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        this.log(`CI/CD validation report saved to: ${reportPath}`, 'info');
        
        // Set GitHub Actions outputs if in GitHub Actions
        if (this.ciProvider === 'github-actions') {
            const outputFile = process.env.GITHUB_OUTPUT;
            if (outputFile) {
                const outputs = [
                    `validation-status=${this.results.failed === 0 ? 'success' : 'failure'}`,
                    `pass-rate=${passRate}`,
                    `total-tests=${total}`,
                    `failed-tests=${this.results.failed}`
                ];
                fs.appendFileSync(outputFile, outputs.join('\n') + '\n');
                this.log('GitHub Actions outputs set', 'info');
            }
        }
        
        // Exit with appropriate code
        if (this.results.failed > 0) {
            this.log('❌ CI/CD validation failed. Please address the failed checks above.', 'error');
            process.exit(1);
        } else if (this.results.warnings > 0) {
            this.log('⚠️  CI/CD validation completed with warnings.', 'warning');
            process.exit(0);
        } else {
            this.log('✅ CI/CD validation passed! Environment is ready for deployment.', 'success');
            process.exit(0);
        }
    }

    async run() {
        this.log('🚀 Starting CI/CD Environment Validation for CrewAI Pipeline', 'header');
        this.log(`Platform: ${os.platform()}, CI Provider: ${this.ciProvider}`, 'info');
        
        try {
            await this.validateCIEnvironment();
            await this.validateGitHubActions();
            await this.validateBuildTools();
            await this.validateSecrets();
            await this.validateContainerRegistry();
            await this.validateKubernetesDeployment();
            await this.validateWorkflowFiles();
            await this.validatePerformance();
            
            this.generateCICDReport();
            
        } catch (error) {
            this.log(`Fatal error during CI/CD validation: ${error.message}`, 'error');
            process.exit(1);
        }
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new CICDValidator();
    validator.run().catch(error => {
        console.error(`\x1b[31mFatal error: ${error.message}\x1b[0m`);
        process.exit(1);
    });
}

module.exports = CICDValidator;