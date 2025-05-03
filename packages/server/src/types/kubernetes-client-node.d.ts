/**
 * Type declarations for @kubernetes/client-node
 */
declare module '@kubernetes/client-node' {
  export class KubeConfig {
    loadFromDefault(): void;
    makeApiClient<T>(apiClientType: new (server: string) => T): T;
  }

  export class CoreV1Api {
    listNamespacedPod(
      namespace: string,
      pretty?: string,
      allowWatchBookmarks?: boolean,
      _continue?: string,
      fieldSelector?: string,
      labelSelector?: string,
      limit?: number,
      resourceVersion?: string,
      resourceVersionMatch?: string,
      timeoutSeconds?: number,
      watch?: boolean,
      options?: any
    ): Promise<{ body: { items: V1Pod[] } }>;

    listNamespacedService(
      namespace: string,
      pretty?: string,
      allowWatchBookmarks?: boolean,
      _continue?: string,
      fieldSelector?: string,
      labelSelector?: string,
      limit?: number,
      resourceVersion?: string,
      resourceVersionMatch?: string,
      timeoutSeconds?: number,
      watch?: boolean,
      options?: any
    ): Promise<{ body: { items: any[] } }>;

    readNamespacedPodLog(
      name: string,
      namespace: string,
      container?: string,
      follow?: boolean,
      insecureSkipTLSVerifyBackend?: boolean,
      limitBytes?: number,
      pretty?: string,
      previous?: boolean,
      sinceSeconds?: number,
      tailLines?: number,
      timestamps?: boolean,
      options?: any
    ): Promise<{ body: string }>;
  }

  export class BatchV1Api {
    listNamespacedJob(
      namespace: string,
      pretty?: string,
      allowWatchBookmarks?: boolean,
      _continue?: string,
      fieldSelector?: string,
      labelSelector?: string,
      limit?: number,
      resourceVersion?: string,
      resourceVersionMatch?: string,
      timeoutSeconds?: number,
      watch?: boolean,
      options?: any
    ): Promise<{ body: { items: any[] } }>;

    readNamespacedJob(
      name: string,
      namespace: string,
      pretty?: string,
      options?: any
    ): Promise<{ body: any }>;

    createNamespacedJob(
      namespace: string,
      body: any,
      pretty?: string,
      dryRun?: string,
      fieldManager?: string,
      options?: any
    ): Promise<{ body: any }>;

    deleteNamespacedJob(
      name: string,
      namespace: string,
      pretty?: string,
      dryRun?: string,
      gracePeriodSeconds?: number,
      orphanDependents?: boolean,
      propagationPolicy?: string,
      options?: any
    ): Promise<{ body: any }>;
  }

  export class AppsV1Api {
    listNamespacedDeployment(
      namespace: string,
      pretty?: string,
      allowWatchBookmarks?: boolean,
      _continue?: string,
      fieldSelector?: string,
      labelSelector?: string,
      limit?: number,
      resourceVersion?: string,
      resourceVersionMatch?: string,
      timeoutSeconds?: number,
      watch?: boolean,
      options?: any
    ): Promise<{ body: { items: any[] } }>;
  }

  export interface V1Pod {
    metadata?: {
      name?: string;
      namespace?: string;
      creationTimestamp?: string;
      labels?: { [key: string]: string };
    };
    spec?: {
      containers?: V1Container[];
    };
    status?: {
      phase?: string;
      conditions?: any[];
      containerStatuses?: any[];
    };
  }

  export interface V1Container {
    name: string;
    image?: string;
    resources?: {
      limits?: {
        cpu?: string;
        memory?: string;
      };
      requests?: {
        cpu?: string;
        memory?: string;
      };
    };
  }
}
