/**
 * Type declarations for dependencyService
 */
declare module '../services/dependencyService' {
  interface ScanStatus {
    status: 'idle' | 'running' | 'completed' | 'failed';
    lastRun: Date | null;
    duration?: number;
    completed?: boolean;
  }

  interface PendingPR {
    id: string;
    title: string;
    url: string;
    status: string;
    type: string;
  }

  interface RecentUpdate {
    name: string;
    from: string;
    to: string;
    date: string;
    type: string;
  }

  interface PackageInfo {
    name: string;
    current: string;
    latest: string;
    type: 'nodejs' | 'python';
    updateType: 'major' | 'minor' | 'patch';
    compatibilityRisk: 'low' | 'medium' | 'high';
    configImpact: boolean;
    notes?: string;
  }

  interface DependencyService {
    getScanStatus(): Promise<ScanStatus>;
    triggerDependencyScan(): Promise<any>;
    getOutdatedPackages(): Promise<any>;
    getPendingPRs(): Promise<PendingPR[]>;
    getRecentUpdates(): Promise<RecentUpdate[]>;
    updatePackage(packageName: string, packageType: 'nodejs' | 'python'): Promise<any>;
    updatePackages(packageNames: string[], updateType: 'safe' | 'caution' | 'manual'): Promise<any>;
    getJobLogs(jobId: string): Promise<string>;
    getCompatibilityAnalysis(packageName: string, packageType: 'nodejs' | 'python'): Promise<any>;
  }

  const dependencyService: DependencyService;
  export default dependencyService;
}
