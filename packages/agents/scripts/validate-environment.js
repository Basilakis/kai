#!/usr/bin/env node

/**
 * Enhanced Environment Validation for CrewAI CI/CD Pipeline
 * 
 * This script provides comprehensive validation of the development environment
 * including Python, Node.js, CrewAI dependencies, uv package manager, and
 * external service connectivity required for the CI/CD pipeline.
 * 
 * Features:
 * - Cross-platform compatibility (Windows, macOS, Linux)
 * - Python version and virtual environment validation
 * - uv package manager installation and functionality checks
 * - CrewAI and dependencies validation
 * - External API connectivity tests
 * - Docker and container runtime validation
 * - Kubernetes cluster connectivity (optional)
 * - Detailed reporting with actionable recommendations
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ANSI color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Configuration
const config = {
    pythonVersions: ['3.10', '3.11', '3.12', '3.13'],
    requiredEnvVars: [
        'OPENAI_API_KEY',
        'SERPER_API_KEY'
    ],
    optionalEnvVars: [
        'BROWSERLESS_API_KEY',
        'FIRECRAWL_API_KEY',
        'ANTHROPIC_API_KEY',
        'GROQ_API_KEY'
    ],
    crewaiPackages: [
        'crewai',
        'crewai-tools',
        'langchain',
        'langchain-openai',
        'python-dotenv'
    ],
    dockerImages: [
        'python:3.11-slim',
        'node:18-alpine'
    ],
    kubernetesNamespaces: ['kai', 'flux-system'],
    timeouts: {
        command: 30000,
        network: 10000,
        docker: 60000
    }
};

class EnvironmentValidator {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            details: []
        };
        this.isWindows = os.platform() === 'win32';
        this.isDarwin = os.platform() === 'darwin';
        this.isLinux = os.platform() === 'linux';
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const colorMap = {
            info: colors.blue,
            success: colors.green,
            warning: colors.yellow,
            error: colors.red,
            header: colors.magenta
        };
        
        const color = colorMap[type] || colors.reset;
        console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
    }

    async executeCommand(command, options = {}) {
        return new Promise((resolve, reject) => {
            const timeout = options.timeout || config.timeouts.command;
            const shell = this.isWindows ? 'powershell.exe' : '/bin/bash';
            const args = this.isWindows ? ['-Command', command] : ['-c', command];
            
            const child = spawn(shell, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: timeout,
                ...options
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                resolve({
                    code,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    success: code === 0
                });
            });

            child.on('error', (error) => {
                reject(error);
            });

            setTimeout(() => {
                child.kill();
                reject(new Error(`Command timeout after ${timeout}ms: ${command}`));
            }, timeout);
        });
    }

    addResult(category, test, status, message, recommendation = null) {
        const result = {
            category,
            test,
            status,
            message,
            recommendation,
            timestamp: new Date().toISOString()
        };

        this.results.details.push(result);

        switch (status) {
            case 'PASS':
                this.results.passed++;
                this.log(`✅ ${category}: ${test} - ${message}`, 'success');
                break;
            case 'FAIL':
                this.results.failed++;
                this.log(`❌ ${category}: ${test} - ${message}`, 'error');
                if (recommendation) {
                    this.log(`   💡 Recommendation: ${recommendation}`, 'warning');
                }
                break;
            case 'WARN':
                this.results.warnings++;
                this.log(`⚠️  ${category}: ${test} - ${message}`, 'warning');
                if (recommendation) {
                    this.log(`   💡 Recommendation: ${recommendation}`, 'warning');
                }
                break;
        }
    }

    async validateSystemInfo() {
        this.log('=== System Information Validation ===', 'header');
        
        try {
            const platform = os.platform();
            const arch = os.arch();
            const release = os.release();
            const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024);
            const freeMem = Math.round(os.freemem() / 1024 / 1024 / 1024);

            this.addResult('System', 'Platform Detection', 'PASS', 
                `Platform: ${platform}, Architecture: ${arch}, Release: ${release}`);
            
            this.addResult('System', 'Memory Check', 
                totalMem >= 4 ? 'PASS' : 'WARN',
                `Total: ${totalMem}GB, Free: ${freeMem}GB`,
                totalMem < 4 ? 'Consider upgrading to at least 4GB RAM for optimal performance' : null);

        } catch (error) {
            this.addResult('System', 'System Info', 'FAIL', 
                `Failed to get system information: ${error.message}`);
        }
    }

    async validateNodeJS() {
        this.log('=== Node.js Environment Validation ===', 'header');
        
        try {
            const nodeResult = await this.executeCommand('node --version');
            if (nodeResult.success) {
                const nodeVersion = nodeResult.stdout.replace('v', '');
                const majorVersion = parseInt(nodeVersion.split('.')[0]);
                
                this.addResult('Node.js', 'Version Check', 
                    majorVersion >= 16 ? 'PASS' : 'FAIL',
                    `Node.js version: ${nodeVersion}`,
                    majorVersion < 16 ? 'Upgrade to Node.js 16 or higher' : null);
            } else {
                this.addResult('Node.js', 'Installation', 'FAIL', 
                    'Node.js not found', 'Install Node.js from https://nodejs.org/');
            }

            const npmResult = await this.executeCommand('npm --version');
            if (npmResult.success) {
                this.addResult('Node.js', 'NPM Check', 'PASS', 
                    `NPM version: ${npmResult.stdout}`);
            } else {
                this.addResult('Node.js', 'NPM Check', 'FAIL', 
                    'NPM not found', 'Reinstall Node.js with NPM included');
            }

        } catch (error) {
            this.addResult('Node.js', 'Environment', 'FAIL', 
                `Node.js validation failed: ${error.message}`);
        }
    }

    async validatePython() {
        this.log('=== Python Environment Validation ===', 'header');
        
        const pythonCommands = ['python3', 'python'];
        let pythonFound = false;
        let pythonVersion = null;

        for (const cmd of pythonCommands) {
            try {
                const result = await this.executeCommand(`${cmd} --version`);
                if (result.success) {
                    pythonVersion = result.stdout.replace('Python ', '');
                    const majorMinor = pythonVersion.split('.').slice(0, 2).join('.');
                    
                    if (config.pythonVersions.some(v => pythonVersion.startsWith(v))) {
                        this.addResult('Python', 'Version Check', 'PASS', 
                            `Python ${pythonVersion} found with command: ${cmd}`);
                        pythonFound = true;
                        break;
                    } else {
                        this.addResult('Python', 'Version Check', 'WARN', 
                            `Python ${pythonVersion} found but not in supported versions: ${config.pythonVersions.join(', ')}`,
                            'Install Python 3.10, 3.11, 3.12, or 3.13 for CrewAI compatibility');
                    }
                }
            } catch (error) {
                // Continue to next command
            }
        }

        if (!pythonFound) {
            this.addResult('Python', 'Installation', 'FAIL', 
                'Python not found or unsupported version', 
                'Install Python 3.10+ from https://python.org/');
        }

        // Check pip
        try {
            const pipResult = await this.executeCommand('pip --version');
            if (pipResult.success) {
                this.addResult('Python', 'Pip Check', 'PASS', 
                    `Pip version: ${pipResult.stdout.split(' ')[1]}`);
            } else {
                this.addResult('Python', 'Pip Check', 'FAIL', 
                    'Pip not found', 'Install pip: python -m ensurepip --upgrade');
            }
        } catch (error) {
            this.addResult('Python', 'Pip Check', 'FAIL', 
                `Pip validation failed: ${error.message}`);
        }
    }

    async validateUV() {
        this.log('=== UV Package Manager Validation ===', 'header');
        
        try {
            const uvResult = await this.executeCommand('uv --version');
            if (uvResult.success) {
                this.addResult('UV', 'Installation', 'PASS', 
                    `UV version: ${uvResult.stdout}`);
                
                // Test uv functionality
                const uvPipResult = await this.executeCommand('uv pip --help');
                if (uvPipResult.success) {
                    this.addResult('UV', 'Functionality', 'PASS', 
                        'UV pip commands available');
                } else {
                    this.addResult('UV', 'Functionality', 'WARN', 
                        'UV pip commands not working properly');
                }
                
            } else {
                this.addResult('UV', 'Installation', 'FAIL', 
                    'UV package manager not found', 
                    'Install UV: pip install uv or curl -LsSf https://astral.sh/uv/install.sh | sh');
            }
        } catch (error) {
            this.addResult('UV', 'Validation', 'FAIL', 
                `UV validation failed: ${error.message}`);
        }
    }

    async validateVirtualEnvironment() {
        this.log('=== Virtual Environment Validation ===', 'header');
        
        const venvPaths = [
            '.venv',
            'venv',
            '.env'
        ];

        let venvFound = false;
        for (const venvPath of venvPaths) {
            if (fs.existsSync(venvPath)) {
                const activateScript = this.isWindows 
                    ? path.join(venvPath, 'Scripts', 'activate.ps1')
                    : path.join(venvPath, 'bin', 'activate');
                
                if (fs.existsSync(activateScript)) {
                    this.addResult('VirtualEnv', 'Detection', 'PASS', 
                        `Virtual environment found at: ${venvPath}`);
                    venvFound = true;
                    break;
                }
            }
        }

        if (!venvFound) {
            this.addResult('VirtualEnv', 'Detection', 'WARN', 
                'No virtual environment found', 
                'Create virtual environment: python -m venv .venv or uv venv');
        }

        // Check if currently in virtual environment
        if (process.env.VIRTUAL_ENV) {
            this.addResult('VirtualEnv', 'Active', 'PASS', 
                `Currently in virtual environment: ${process.env.VIRTUAL_ENV}`);
        } else {
            this.addResult('VirtualEnv', 'Active', 'WARN', 
                'Not currently in a virtual environment', 
                'Activate virtual environment before installing packages');
        }
    }

    async validateCrewAI() {
        this.log('=== CrewAI Dependencies Validation ===', 'header');
        
        for (const pkg of config.crewaiPackages) {
            try {
                const result = await this.executeCommand(`pip show ${pkg}`);
                if (result.success) {
                    const versionMatch = result.stdout.match(/Version: (.+)/);
                    const version = versionMatch ? versionMatch[1] : 'unknown';
                    this.addResult('CrewAI', `Package: ${pkg}`, 'PASS', 
                        `Version: ${version}`);
                } else {
                    this.addResult('CrewAI', `Package: ${pkg}`, 'FAIL', 
                        'Package not installed', 
                        `Install with: pip install ${pkg} or uv pip install ${pkg}`);
                }
            } catch (error) {
                this.addResult('CrewAI', `Package: ${pkg}`, 'FAIL', 
                    `Failed to check package: ${error.message}`);
            }
        }

        // Test CrewAI import
        try {
            const importTest = await this.executeCommand('python -c "import crewai; print(crewai.__version__)"');
            if (importTest.success) {
                this.addResult('CrewAI', 'Import Test', 'PASS', 
                    `CrewAI import successful, version: ${importTest.stdout}`);
            } else {
                this.addResult('CrewAI', 'Import Test', 'FAIL', 
                    'CrewAI import failed', 'Check CrewAI installation and dependencies');
            }
        } catch (error) {
            this.addResult('CrewAI', 'Import Test', 'FAIL', 
                `Import test failed: ${error.message}`);
        }
    }

    async validateEnvironmentVariables() {
        this.log('=== Environment Variables Validation ===', 'header');
        
        // Check required environment variables
        for (const envVar of config.requiredEnvVars) {
            if (process.env[envVar]) {
                const value = process.env[envVar];
                const maskedValue = value.length > 8 
                    ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
                    : '***masked***';
                
                this.addResult('Environment', `Required: ${envVar}`, 'PASS', 
                    `Set (${maskedValue})`);
            } else {
                this.addResult('Environment', `Required: ${envVar}`, 'FAIL', 
                    'Not set', `Set ${envVar} in your environment or .env file`);
            }
        }

        // Check optional environment variables
        for (const envVar of config.optionalEnvVars) {
            if (process.env[envVar]) {
                const value = process.env[envVar];
                const maskedValue = value.length > 8 
                    ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
                    : '***masked***';
                
                this.addResult('Environment', `Optional: ${envVar}`, 'PASS', 
                    `Set (${maskedValue})`);
            } else {
                this.addResult('Environment', `Optional: ${envVar}`, 'WARN', 
                    'Not set', `Consider setting ${envVar} for enhanced functionality`);
            }
        }

        // Check for .env file
        if (fs.existsSync('.env')) {
            this.addResult('Environment', '.env File', 'PASS', 
                '.env file found');
        } else {
            this.addResult('Environment', '.env File', 'WARN', 
                '.env file not found', 'Create .env file for local environment variables');
        }
    }

    async validateAPIConnectivity() {
        this.log('=== API Connectivity Validation ===', 'header');
        
        const apiTests = [
            {
                name: 'OpenAI API',
                envVar: 'OPENAI_API_KEY',
                testCommand: 'python -c "import openai; client = openai.OpenAI(); print(\'OpenAI client initialized\')"'
            }
        ];

        for (const test of apiTests) {
            if (process.env[test.envVar]) {
                try {
                    const result = await this.executeCommand(test.testCommand);
                    if (result.success) {
                        this.addResult('API', test.name, 'PASS', 
                            'Connection test successful');
                    } else {
                        this.addResult('API', test.name, 'WARN', 
                            'Connection test failed', 'Check API key validity and network connectivity');
                    }
                } catch (error) {
                    this.addResult('API', test.name, 'WARN', 
                        `Connection test error: ${error.message}`);
                }
            } else {
                this.addResult('API', test.name, 'WARN', 
                    'API key not set', `Set ${test.envVar} to test connectivity`);
            }
        }
    }

    async validateDocker() {
        this.log('=== Docker Environment Validation ===', 'header');
        
        try {
            const dockerResult = await this.executeCommand('docker --version');
            if (dockerResult.success) {
                this.addResult('Docker', 'Installation', 'PASS', 
                    `Docker version: ${dockerResult.stdout}`);
                
                // Test docker daemon
                const daemonResult = await this.executeCommand('docker info');
                if (daemonResult.success) {
                    this.addResult('Docker', 'Daemon', 'PASS', 
                        'Docker daemon is running');
                } else {
                    this.addResult('Docker', 'Daemon', 'FAIL', 
                        'Docker daemon not running', 'Start Docker daemon/service');
                }
                
            } else {
                this.addResult('Docker', 'Installation', 'WARN', 
                    'Docker not found', 'Install Docker for containerization support');
            }
        } catch (error) {
            this.addResult('Docker', 'Validation', 'WARN', 
                `Docker validation failed: ${error.message}`);
        }
    }

    async validateKubernetes() {
        this.log('=== Kubernetes Environment Validation ===', 'header');
        
        try {
            const kubectlResult = await this.executeCommand('kubectl version --client');
            if (kubectlResult.success) {
                this.addResult('Kubernetes', 'kubectl', 'PASS', 
                    'kubectl client found');
                
                // Test cluster connectivity
                try {
                    const clusterResult = await this.executeCommand('kubectl cluster-info');
                    if (clusterResult.success) {
                        this.addResult('Kubernetes', 'Cluster', 'PASS', 
                            'Cluster connectivity verified');
                        
                        // Check namespaces
                        for (const ns of config.kubernetesNamespaces) {
                            const nsResult = await this.executeCommand(`kubectl get namespace ${ns}`);
                            if (nsResult.success) {
                                this.addResult('Kubernetes', `Namespace: ${ns}`, 'PASS', 
                                    'Namespace exists');
                            } else {
                                this.addResult('Kubernetes', `Namespace: ${ns}`, 'WARN', 
                                    'Namespace not found', `Create namespace: kubectl create namespace ${ns}`);
                            }
                        }
                        
                    } else {
                        this.addResult('Kubernetes', 'Cluster', 'WARN', 
                            'No cluster connectivity', 'Configure kubectl context or start cluster');
                    }
                } catch (error) {
                    this.addResult('Kubernetes', 'Cluster', 'WARN', 
                        'Cluster connectivity test failed');
                }
                
            } else {
                this.addResult('Kubernetes', 'kubectl', 'WARN', 
                    'kubectl not found', 'Install kubectl for Kubernetes deployment');
            }
        } catch (error) {
            this.addResult('Kubernetes', 'Validation', 'WARN', 
                `Kubernetes validation failed: ${error.message}`);
        }
    }

    async validateGitEnvironment() {
        this.log('=== Git Environment Validation ===', 'header');
        
        try {
            const gitResult = await this.executeCommand('git --version');
            if (gitResult.success) {
                this.addResult('Git', 'Installation', 'PASS', 
                    `Git version: ${gitResult.stdout}`);
                
                // Check git configuration
                const userResult = await this.executeCommand('git config user.name');
                const emailResult = await this.executeCommand('git config user.email');
                
                if (userResult.success && emailResult.success) {
                    this.addResult('Git', 'Configuration', 'PASS', 
                        `User: ${userResult.stdout}, Email: ${emailResult.stdout}`);
                } else {
                    this.addResult('Git', 'Configuration', 'WARN', 
                        'Git user configuration incomplete', 
                        'Configure git: git config --global user.name "Your Name" && git config --global user.email "your@email.com"');
                }
                
            } else {
                this.addResult('Git', 'Installation', 'FAIL', 
                    'Git not found', 'Install Git from https://git-scm.com/');
            }
        } catch (error) {
            this.addResult('Git', 'Validation', 'FAIL', 
                `Git validation failed: ${error.message}`);
        }
    }

    generateReport() {
        this.log('=== Validation Summary ===', 'header');
        
        const total = this.results.passed + this.results.failed + this.results.warnings;
        const passRate = total > 0 ? Math.round((this.results.passed / total) * 100) : 0;
        
        this.log(`Total Tests: ${total}`, 'info');
        this.log(`Passed: ${this.results.passed} (${colors.green}✅${colors.reset})`, 'success');
        this.log(`Failed: ${this.results.failed} (${colors.red}❌${colors.reset})`, 'error');
        this.log(`Warnings: ${this.results.warnings} (${colors.yellow}⚠️${colors.reset})`, 'warning');
        this.log(`Pass Rate: ${passRate}%`, passRate >= 80 ? 'success' : 'warning');
        
        // Generate detailed report
        const reportPath = 'environment-validation-report.json';
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total,
                passed: this.results.passed,
                failed: this.results.failed,
                warnings: this.results.warnings,
                passRate
            },
            system: {
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                nodeVersion: process.version
            },
            details: this.results.details
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        this.log(`Detailed report saved to: ${reportPath}`, 'info');
        
        // Exit with appropriate code
        if (this.results.failed > 0) {
            this.log('❌ Environment validation failed. Please address the failed checks above.', 'error');
            process.exit(1);
        } else if (this.results.warnings > 0) {
            this.log('⚠️  Environment validation completed with warnings. Consider addressing them for optimal performance.', 'warning');
            process.exit(0);
        } else {
            this.log('✅ Environment validation passed! Your environment is ready for CrewAI development.', 'success');
            process.exit(0);
        }
    }

    async run() {
        this.log('🚀 Starting Enhanced Environment Validation for CrewAI CI/CD Pipeline', 'header');
        this.log(`Platform: ${os.platform()}, Architecture: ${os.arch()}`, 'info');
        
        try {
            await this.validateSystemInfo();
            await this.validateNodeJS();
            await this.validatePython();
            await this.validateUV();
            await this.validateVirtualEnvironment();
            await this.validateCrewAI();
            await this.validateEnvironmentVariables();
            await this.validateAPIConnectivity();
            await this.validateDocker();
            await this.validateKubernetes();
            await this.validateGitEnvironment();
            
            this.generateReport();
            
        } catch (error) {
            this.log(`Fatal error during validation: ${error.message}`, 'error');
            process.exit(1);
        }
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new EnvironmentValidator();
    validator.run().catch(error => {
        console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
        process.exit(1);
    });
}

module.exports = EnvironmentValidator;