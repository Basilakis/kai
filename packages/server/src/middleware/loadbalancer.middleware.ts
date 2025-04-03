import { Request, Response, NextFunction, ServiceNode, RedisConfig, LoadBalancerConfig, Redis } from '../types/middleware';
import createLogger from '../utils/logger';

const logger = createLogger('LoadBalancer');

class LoadBalancer {
  private static instance: LoadBalancer;
  private services: Map<string, ServiceNode[]> = new Map();
  private redis: Redis | null = null;
  private readonly healthKey = 'kai:loadbalancer:health';
  
  private constructor() {}

  public static getInstance(): LoadBalancer {
    if (!LoadBalancer.instance) {
      LoadBalancer.instance = new LoadBalancer();
    }
    return LoadBalancer.instance;
  }

  public async connectRedis(config: RedisConfig) {
    try {
      this.redis = new Redis(config);
      logger.info('Connected to Redis for load balancer');
      
      // Restore service health from Redis
      await this.restoreHealth();
    } catch (error) {
      logger.error(`Failed to connect to Redis: ${error}`);
    }
  }

  private async restoreHealth() {
    if (!this.redis) return;

    try {
      const healthData = await this.redis.get(this.healthKey);
      if (healthData) {
        const health = JSON.parse(healthData);
        for (const [service, nodes] of Object.entries(health)) {
          this.services.set(service, nodes as ServiceNode[]);
        }
      }
    } catch (error) {
      logger.error(`Failed to restore health data: ${error}`);
    }
  }

  private async saveHealth() {
    if (!this.redis) return;

    try {
      const health = Object.fromEntries(this.services.entries());
      await this.redis.set(this.healthKey, JSON.stringify(health));
    } catch (error) {
      logger.error(`Failed to save health data: ${error}`);
    }
  }

  public registerService(serviceName: string, nodes: Array<{ url: string; weight?: number }>) {
    const serviceNodes = nodes.map(node => ({
      url: node.url,
      weight: node.weight || 1,
      health: {
        healthy: true,
        lastCheck: Date.now(),
        failureCount: 0,
        responseTime: 0
      }
    }));

    this.services.set(serviceName, serviceNodes);
    this.saveHealth();
  }

  public async getHealthyNode(serviceName: string): Promise<string | null> {
    const nodes = this.services.get(serviceName);
    if (!nodes || nodes.length === 0) {
      return null;
    }

    // Filter healthy nodes
    const healthyNodes = nodes.filter(node => node.health.healthy);
    if (healthyNodes.length === 0) {
      // If no healthy nodes, reset health of all nodes and try again
      nodes.forEach(node => {
        node.health.healthy = true;
        node.health.failureCount = 0;
      });
      await this.saveHealth();
      return nodes[0]?.url ?? null;
    }

    // Weighted round-robin selection
    const totalWeight = healthyNodes.reduce((sum, node) => sum + node.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const node of healthyNodes) {
      random -= node.weight;
      if (random <= 0) {
        return node.url;
      }
    }

    return healthyNodes[0]?.url ?? null;
  }

  public async updateNodeHealth(
    serviceName: string, 
    nodeUrl: string, 
    healthy: boolean, 
    responseTime?: number
  ): Promise<void> {
    const nodes = this.services.get(serviceName);
    if (!nodes) return;

    const node = nodes.find(n => n.url === nodeUrl);
    if (!node) return;

    if (!healthy) {
      node.health.failureCount++;
      if (node.health.failureCount >= 3) {
        node.health.healthy = false;
        logger.warn(`Node ${nodeUrl} marked unhealthy after ${node.health.failureCount} failures`);
      }
    } else {
      node.health.failureCount = 0;
      node.health.healthy = true;
      if (responseTime) {
        node.health.responseTime = responseTime;
      }
    }

    node.health.lastCheck = Date.now();
    await this.saveHealth();
  }

  public async checkNodeHealth(serviceName: string, nodeUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${nodeUrl}/health`);
      const healthy = response.ok;
      const responseTime = response.headers.get('x-response-time');
      
      await this.updateNodeHealth(
        serviceName, 
        nodeUrl, 
        healthy, 
        responseTime ? parseInt(responseTime) : undefined
      );
      
      return healthy;
    } catch (error) {
      await this.updateNodeHealth(serviceName, nodeUrl, false);
      return false;
    }
  }
}

// Middleware factory
export const createLoadBalancerMiddleware = (config: LoadBalancerConfig) => {
  const loadBalancer = LoadBalancer.getInstance();
  
  if (config.redis) {
    loadBalancer.connectRedis(config.redis);
  }

  loadBalancer.registerService(config.serviceName, config.nodes);

  // Health check interval
  setInterval(async () => {
    for (const node of config.nodes) {
      await loadBalancer.checkNodeHealth(config.serviceName, node.url);
    }
  }, 30000); // Check every 30 seconds

  return async (req: Request, res: Response, next: NextFunction) => {
    const nodeUrl = await loadBalancer.getHealthyNode(config.serviceName);
    if (!nodeUrl) {
      return res.status(503).json({ error: 'No healthy nodes available' });
    }

    // Attach the selected node URL to the request for downstream middleware
    req.targetNode = nodeUrl;
    next();
    return undefined; // Explicit return for type safety
  };
};

// Health check endpoint middleware
export const healthEndpoint = (req: Request, res: Response) => {
  // Add response time header
  res.setHeader('x-response-time', Date.now() - (req.startTime || Date.now()));
  res.status(200).json({ status: 'healthy' });
};

export default createLoadBalancerMiddleware;