# Digital Ocean Kubernetes Setup Guide for Kai

This guide provides detailed instructions for setting up a Kubernetes cluster on Digital Ocean specifically optimized for the Kai application.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Creating a Digital Ocean Kubernetes Cluster](#creating-a-digital-ocean-kubernetes-cluster)
- [Node Pool Configuration](#node-pool-configuration)
- [Networking Setup](#networking-setup)
- [Storage Configuration](#storage-configuration)
- [Monitoring and Logging](#monitoring-and-logging)
- [Cost Optimization](#cost-optimization)
- [Maintenance and Upgrades](#maintenance-and-upgrades)

## Prerequisites

Before starting, you'll need:

- A Digital Ocean account with billing set up
- `doctl` CLI installed and configured
- `kubectl` installed locally
- Domain name(s) with ability to configure DNS settings

## Creating a Digital Ocean Kubernetes Cluster

### Step 1: Log in to the Digital Ocean Console

Visit [https://cloud.digitalocean.com/login](https://cloud.digitalocean.com/login) and log in to your Digital Ocean account.

### Step 2: Create a Kubernetes Cluster

1. Navigate to the **Kubernetes** section in the left menu
2. Click **Create Cluster**
3. Choose a datacenter region (select the region closest to your users)
4. Select Kubernetes version (recommended: latest stable version)

### Step 3: Configure the Initial Node Pool

For a production Kai deployment, we recommend:

**API Server Node Pool:**
- Machine Type: Standard Droplets 
- Node Size: At least 4GB RAM / 2 vCPUs ($24/month)
- Number of Nodes: 3 (for high availability)
- Name: `api-server-pool`

### Step 4: Add a ML Services Node Pool

After creating the initial node pool, add a specialized node pool for ML services:

1. Click **Add Node Pool**
2. Configure the node pool:
   - Machine Type: CPU-Optimized Droplets
   - Node Size: 8GB RAM / 4 vCPUs ($48/month) or higher
   - Number of Nodes: 2
   - Name: `ml-services-pool`

**For production with heavy ML workloads**, consider:
- CPU-Optimized Droplets with 16GB RAM / 8 vCPUs ($96/month)
- GPU Droplets if available (for faster inference)

### Step 5: Cluster Configuration

1. Name your cluster (e.g., `kai-production`)
2. Select VPC Network (default is fine for most deployments)
3. Click **Create Cluster**

The cluster creation process takes approximately 5-10 minutes.

## Node Pool Configuration

### Adding Labels to Node Pools

It's important to add Kubernetes labels to your node pools to control pod scheduling:

```bash
# Label the API server nodes
kubectl label nodes -l doks.digitalocean.com/node-pool=api-server-pool node-type=api-server

# Label the ML services nodes
kubectl label nodes -l doks.digitalocean.com/node-pool=ml-services-pool node-type=ml
```

### Node Selectors in Deployments

Update your deployments to use node selectors:

**API Server Deployment:**
```yaml
spec:
  template:
    spec:
      nodeSelector:
        node-type: api-server
```

**ML Services Deployment:**
```yaml
spec:
  template:
    spec:
      nodeSelector:
        node-type: ml
```

### Resource Limits and Requests

Set appropriate resource limits and requests for your deployments:

**API Server Deployment (per pod):**
```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

**ML Services Deployment (per pod):**
```yaml
resources:
  requests:
    memory: "2Gi"
    cpu: "1000m"
  limits:
    memory: "4Gi"
    cpu: "2000m"
```

## Networking Setup

### Configure Load Balancer and Ingress

Digital Ocean Kubernetes automatically provisions a Load Balancer when you create an ingress resource.

1. Install NGINX Ingress Controller:
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.7.0/deploy/static/provider/cloud/deploy.yaml
   ```

2. Wait for the Load Balancer to be provisioned:
   ```bash
   kubectl get service -n ingress-nginx ingress-nginx-controller
   ```

3. Configure DNS Records:
   - Get the Load Balancer's external IP
   - Create DNS A records:
     - `api.kai.yourdomain.com` -> [Load Balancer IP]

### TLS/SSL Setup with cert-manager

1. Install cert-manager:
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.11.0/cert-manager.yaml
   ```

2. Create a ClusterIssuer for Let's Encrypt:
   ```bash
   cat <<EOF | kubectl apply -f -
   apiVersion: cert-manager.io/v1
   kind: ClusterIssuer
   metadata:
     name: letsencrypt-prod
   spec:
     acme:
       server: https://acme-v02.api.letsencrypt.org/directory
       email: your-email@example.com
       privateKeySecretRef:
         name: letsencrypt-prod
       solvers:
       - http01:
           ingress:
             class: nginx
   EOF
   ```

## Storage Configuration

### Digital Ocean Block Storage for ML Models

1. Create a StorageClass for Digital Ocean Block Storage:
   ```bash
   cat <<EOF | kubectl apply -f -
   apiVersion: storage.k8s.io/v1
   kind: StorageClass
   metadata:
     name: do-block-storage
     annotations:
       storageclass.kubernetes.io/is-default-class: "true"
   provisioner: dobs.csi.digitalocean.com
   parameters:
     fsType: ext4
   reclaimPolicy: Retain
   allowVolumeExpansion: true
   EOF
   ```

2. Create a PersistentVolumeClaim for ML models:
   ```bash
   cat <<EOF | kubectl apply -f -
   apiVersion: v1
   kind: PersistentVolumeClaim
   metadata:
     name: ml-models-pvc
     namespace: kai
   spec:
     accessModes:
       - ReadWriteOnce
     resources:
       requests:
         storage: 20Gi
     storageClassName: do-block-storage
   EOF
   ```

3. Mount the PVC in your ML Services deployment:
   ```yaml
   volumeMounts:
   - name: ml-models
     mountPath: /app/models
   volumes:
   - name: ml-models
     persistentVolumeClaim:
       claimName: ml-models-pvc
   ```

## Monitoring and Logging

### Setting Up DigitalOcean Monitoring

DigitalOcean provides built-in monitoring capabilities:

1. Navigate to your cluster in the DigitalOcean console
2. Go to the **Insights** tab
3. View metrics for:
   - CPU Usage
   - Memory Usage
   - Disk I/O
   - Network Traffic

### Deploying Prometheus and Grafana

For more advanced monitoring, deploy Prometheus and Grafana:

1. Add the Prometheus Helm repository:
   ```bash
   helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
   helm repo update
   ```

2. Install Prometheus and Grafana:
   ```bash
   kubectl create namespace monitoring
   
   helm install prometheus prometheus-community/kube-prometheus-stack \
     --namespace monitoring \
     --set grafana.adminPassword=your-secure-password
   ```

3. Access Grafana:
   ```bash
   kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
   ```
   
   Then visit: http://localhost:3000

### Setting Up Centralized Logging

1. Deploy Loki stack for log management:
   ```bash
   helm repo add grafana https://grafana.github.io/helm-charts
   helm repo update
   
   helm install loki grafana/loki-stack \
     --namespace monitoring \
     --set grafana.enabled=false
   ```

2. Configure Promtail to send logs to Loki:
   ```bash
   helm install promtail grafana/promtail \
     --namespace monitoring \
     --set "loki.serviceName=loki"
   ```

3. Import the Loki data source in Grafana:
   - Go to Grafana > Configuration > Data Sources
   - Add Loki with URL: http://loki:3100

## Cost Optimization

### Autoscaling Configuration

Set up the Kubernetes Horizontal Pod Autoscaler (HPA) to automatically scale your workloads:

1. Create an HPA for the API server:
   ```bash
   kubectl autoscale deployment kai-api-server -n kai \
     --cpu-percent=75 \
     --min=3 \
     --max=10
   ```

2. Create an HPA for the ML services:
   ```bash
   kubectl autoscale deployment kai-ml-services -n kai \
     --cpu-percent=60 \
     --min=2 \
     --max=5
   ```

### Node Pool Autoscaling

Enable node pool autoscaling:

1. In the DigitalOcean console, go to your Kubernetes cluster
2. Select the node pool you want to autoscale
3. Click **Edit** and enable autoscaling
4. Set minimum and maximum node count:
   - API Server Pool: Min 3, Max 6
   - ML Services Pool: Min 2, Max 4

### Resource Quota Management

Set up resource quotas to limit resource consumption:

```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ResourceQuota
metadata:
  name: kai-quota
  namespace: kai
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    limits.cpu: "16"
    limits.memory: 32Gi
    persistentvolumeclaims: "10"
EOF
```

## Maintenance and Upgrades

### Regular Backup Procedures

1. Set up regular backups for persistent volumes:
   ```bash
   # Install Velero for backup management
   velero install \
     --provider aws \
     --plugins velero/velero-plugin-for-aws:v1.5.0 \
     --bucket kai-k8s-backups \
     --secret-file ./credentials-velero \
     --use-volume-snapshots=true \
     --backup-location-config region=us-east-1 \
     --snapshot-location-config region=us-east-1
   
   # Create a daily backup schedule
   velero schedule create daily-backup \
     --schedule="0 0 * * *" \
     --include-namespaces kai
   ```

2. Set up database backups (if using MongoDB outside the cluster):
   - Configure MongoDB Atlas backups
   - Set up periodic exports to S3

### Kubernetes Version Upgrades

DigitalOcean makes it easy to upgrade your Kubernetes cluster:

1. In the DigitalOcean console, go to your Kubernetes cluster
2. Click on the **Upgrade Cluster** button when a new version is available
3. Before upgrading, ensure:
   - All your workloads have multiple replicas for zero-downtime upgrades
   - You have recent backups of all persistent data
   - You've tested the upgrade process in a staging environment

### Node Maintenance

For node maintenance:

1. Cordon a node to prevent new pods from being scheduled:
   ```bash
   kubectl cordon <node-name>
   ```

2. Drain a node to safely evict all pods:
   ```bash
   kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
   ```

3. After maintenance, uncordon the node:
   ```bash
   kubectl uncordon <node-name>
   ```

## Conclusion

Following this guide, you'll have a production-ready Kubernetes cluster on Digital Ocean optimized for running the Kai application. The cluster is configured with appropriate resources, monitoring, and high availability features to ensure reliable operation.

Remember to regularly monitor your cluster, maintain backups, and keep your Kubernetes version up-to-date for the best performance and security.