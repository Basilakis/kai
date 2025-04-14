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

### Step 4: Add Specialized Node Pools

After creating the initial node pool, add specialized node pools for the different workload types:

1. **CPU-Optimized Node Pool** (for the Coordinator service and general processing):
   - Click **Add Node Pool**
   - Machine Type: CPU-Optimized Droplets
   - Node Size: 8GB RAM / 4 vCPUs ($48/month)
   - Number of Nodes: 3
   - Name: `cpu-optimized-pool`

2. **GPU Node Pool** (for ML inference tasks like NeRF generation):
   - Click **Add Node Pool**
   - Machine Type: GPU Droplets
   - Node Size: With NVIDIA T4 GPUs
   - Number of Nodes: 2
   - Name: `gpu-optimized-pool`

3. **Memory-Optimized Node Pool** (for large model loading):
   - Click **Add Node Pool**
   - Machine Type: Memory-Optimized Droplets
   - Node Size: 16GB RAM / 4 vCPUs
   - Number of Nodes: 1
   - Name: `memory-optimized-pool`

4. **Spot Instance Pool** (for cost-effective batch processing):
   - Click **Add Node Pool**
   - Enable Spot Instances
   - Machine Type: Standard Droplets
   - Node Size: 8GB RAM / 4 vCPUs
   - Number of Nodes: 2-4
   - Name: `spot-instances-pool`

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

# Label the CPU-optimized nodes for coordinator service
kubectl label nodes -l doks.digitalocean.com/node-pool=cpu-optimized-pool node-type=cpu-optimized workload-class=orchestration

# Label the GPU nodes
kubectl label nodes -l doks.digitalocean.com/node-pool=gpu-optimized-pool node-type=gpu-optimized workload-class=ml-inference gpu=nvidia-t4

# Label the memory-optimized nodes
kubectl label nodes -l doks.digitalocean.com/node-pool=memory-optimized-pool node-type=memory-optimized workload-class=model-loading

# Label the spot instances
kubectl label nodes -l doks.digitalocean.com/node-pool=spot-instances-pool node-type=spot-instance workload-class=batch-processing
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

**Coordinator Service Deployment:**
```yaml
spec:
  template:
    spec:
      nodeSelector:
        node-type: cpu-optimized
        workload-class: orchestration
```

**Argo Workflow Steps:**
Different workflow steps can target specific node pools:

```yaml
# GPU-intensive steps (in the WorkflowTemplate)
spec:
  nodeSelector:
    node-type: gpu-optimized
    workload-class: ml-inference
  
# Memory-intensive steps
spec:
  nodeSelector:
    node-type: memory-optimized
    workload-class: model-loading
    
# Batch processing steps that can tolerate interruption
spec:
  nodeSelector:
    node-type: spot-instance
    workload-class: batch-processing
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

**Coordinator Service Deployment (per pod):**
```yaml
resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "1000m"
```

**ML Workflow Steps (per pod, example for GPU steps):**
```yaml
resources:
  requests:
    memory: "4Gi"
    cpu: "1000m"
    nvidia.com/gpu: "1"
  limits:
    memory: "8Gi"
    cpu: "2000m"
    nvidia.com/gpu: "1"
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

## Installing Argo Workflows

Argo Workflows is a critical component for the KAI ML Platform, handling the orchestration of complex ML pipelines.

### Step 1: Install Argo Workflows

1. Create the argo namespace:
   ```bash
   kubectl create namespace argo
   ```

2. Install Argo Workflows using kubectl:
   ```bash
   kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/download/v3.4.5/install.yaml
   ```

3. Configure Argo to use the default service account in the namespace:
   ```bash
   kubectl patch configmap/workflow-controller-configmap \
      -n argo \
      --type merge \
      -p '{"data":{"workflowNamespaces":"kai,argo"}}'
   ```

### Step 2: Create RBAC for Argo Workflows in the kai-ml namespace

Create the necessary RBAC configuration for Argo Workflows to run in the `kai-ml` namespace:

```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: argo-workflow
  namespace: kai-ml

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: workflow-role
  namespace: kai-ml
rules:
- apiGroups:
  - ""
  resources:
  - pods
  - pods/exec
  - pods/log
  verbs:
  - create
  - get
  - list
  - watch
  - update
  - patch
  - delete
- apiGroups:
  - ""
  resources:
  - configmaps
  - secrets
  - persistentvolumeclaims
  verbs:
  - create
  - get
  - list
  - watch
  - update
  - patch
  - delete
- apiGroups:
  - argoproj.io
  resources:
  - workflows
  - workflows/finalizers
  - workflowtasksets
  - workflowtasksets/finalizers
  - workflowtemplates
  - workflowtemplates/finalizers
  verbs:
  - create
  - get
  - list
  - watch
  - update
  - patch
  - delete

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: workflow-rolebinding
  namespace: kai-ml
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: workflow-role
subjects:
- kind: ServiceAccount
  name: argo-workflow
  namespace: kai-ml
EOF
```

### Step 3: Create RBAC for the Coordinator Service

The Coordinator service needs permissions to create and manage Argo Workflows:

```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: coordinator-service-account
  namespace: kai-ml

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: coordinator-workflow-manager
  namespace: kai-ml
rules:
- apiGroups:
  - argoproj.io
  resources:
  - workflows
  - workflows/finalizers
  - workflowtemplates
  - workflowtemplates/finalizers
  verbs:
  - create
  - delete
  - get
  - list
  - patch
  - update
  - watch
- apiGroups:
  - ""
  resources:
  - pods
  - pods/log
  - configmaps
  - secrets
  verbs:
  - get
  - list
  - watch
- apiGroups:
  - ""
  resources:
  - persistentvolumeclaims
  verbs:
  - create
  - delete
  - get
  - list
  - watch
  - update
  - patch
- apiGroups:
  - ""
  resources:
  - events
  verbs:
  - create
  - get
  - list
  - watch

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: coordinator-workflow-manager-binding
  namespace: kai-ml
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: coordinator-workflow-manager
subjects:
- kind: ServiceAccount
  name: coordinator-service-account
  namespace: kai-ml

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: coordinator-cluster-monitor
rules:
- apiGroups:
  - ""
  resources:
  - nodes
  verbs:
  - get
  - list
  - watch
- apiGroups:
  - metrics.k8s.io
  resources:
  - pods
  - nodes
  verbs:
  - get
  - list
  - watch
- apiGroups:
  - custom.metrics.k8s.io
  resources:
  - "*"
  verbs:
  - get
  - list
  - watch

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: coordinator-cluster-monitor-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: coordinator-cluster-monitor
subjects:
- kind: ServiceAccount
  name: coordinator-service-account
  namespace: kai-ml
EOF
```

### Step 4: Configure Artifact Repository

Create a secret for accessing your S3-compatible storage:

```bash
kubectl create secret generic s3-artifact-repository \
  --namespace kai-ml \
  --from-literal=accessKey=YOUR_ACCESS_KEY \
  --from-literal=secretKey=YOUR_SECRET_KEY
```

Configure an artifact repository for Argo to store input/output artifacts:

```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: artifact-repositories
  namespace: kai-ml
data:
  s3: |
    s3:
      bucket: kai-workflow-artifacts
      endpoint: nyc3.digitaloceanspaces.com
      insecure: false
      accessKeySecret:
        name: s3-artifact-repository
        key: accessKey
      secretKeySecret:
        name: s3-artifact-repository
        key: secretKey
      region: us-east-1
EOF
```

## Storage Configuration

### Digital Ocean Block Storage for Persistent Data

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

2. Create a StorageClass for workflow data (with Delete reclaim policy):
   ```bash
   cat <<EOF | kubectl apply -f -
   apiVersion: storage.k8s.io/v1
   kind: StorageClass
   metadata:
     name: workflow-storage
   provisioner: dobs.csi.digitalocean.com
   parameters:
     fsType: ext4
   reclaimPolicy: Delete
   allowVolumeExpansion: true
   EOF
   ```

3. Create PVCs for shared resources:
   ```bash
   cat <<EOF | kubectl apply -f -
   apiVersion: v1
   kind: PersistentVolumeClaim
   metadata:
     name: coordinator-cache-pvc
     namespace: kai-ml
   spec:
     accessModes:
       - ReadWriteOnce
     resources:
       requests:
         storage: 20Gi
     storageClassName: do-block-storage
   ---
   apiVersion: v1
   kind: PersistentVolumeClaim
   metadata:
     name: model-repository-pvc
     namespace: kai-ml
   spec:
     accessModes:
       - ReadWriteMany
     resources:
       requests:
         storage: 50Gi
     storageClassName: do-block-storage
   EOF
   ```

4. Volume handling in Argo Workflows:
   Argo Workflows will use the `workflow-storage` StorageClass for its volume claim templates:
   
   ```yaml
   # In the WorkflowTemplate
   volumeClaimTemplates:
   - metadata:
       name: workdir
     spec:
       accessModes: ["ReadWriteOnce"]
       storageClassName: workflow-storage
       resources:
         requests:
           storage: 10Gi
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

### Deploy the Monitoring Stack

The KAI ML Platform uses a comprehensive monitoring stack including Prometheus, Grafana, and Jaeger:

1. Create a monitoring namespace:
   ```bash
   kubectl create namespace monitoring
   ```

2. Add the Prometheus Helm repository:
   ```bash
   helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
   helm repo update
   ```

3. Install Prometheus and Grafana:
   ```bash
   helm install prometheus prometheus-community/kube-prometheus-stack \
     --namespace monitoring \
     --set grafana.adminPassword=your-secure-password \
     --values - <<EOF
   grafana:
     dashboards:
       default:
         kubernetes-dashboard:
           url: https://raw.githubusercontent.com/dotdc/grafana-dashboards-kubernetes/master/dashboards/k8s-views-global.json
         ml-workflows-dashboard:
           url: https://raw.githubusercontent.com/argoproj/argo-workflows/master/examples/grafana-dashboard.json
     dashboardProviders:
       dashboardproviders.yaml:
         apiVersion: 1
         providers:
         - name: 'default'
           orgId: 1
           folder: ''
           type: file
           disableDeletion: false
           editable: true
           options:
             path: /var/lib/grafana/dashboards/default
   EOF
   ```

4. Install Jaeger for distributed tracing:
   ```bash
   kubectl apply -f https://github.com/jaegertracing/jaeger-operator/releases/download/v1.37.0/jaeger-operator.yaml

   # Wait for the operator to be ready, then create Jaeger instance
   kubectl apply -f - <<EOF
   apiVersion: jaegertracing.io/v1
   kind: Jaeger
   metadata:
     name: jaeger
     namespace: monitoring
   spec:
     strategy: production
     storage:
       type: elasticsearch
       options:
         es:
           server-urls: http://elasticsearch:9200
     ingress:
       enabled: true
       hosts:
         - jaeger.yourdomain.com
       tls:
         - hosts:
             - jaeger.yourdomain.com
   EOF
   ```

5. Configure monitoring access:
   ```bash
   # Create Ingress for Grafana
   kubectl apply -f - <<EOF
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: grafana
     namespace: monitoring
     annotations:
       kubernetes.io/ingress.class: nginx
       cert-manager.io/cluster-issuer: letsencrypt-prod
       nginx.ingress.kubernetes.io/ssl-redirect: "true"
   spec:
     tls:
     - hosts:
       - grafana.yourdomain.com
       secretName: grafana-tls
     rules:
     - host: grafana.yourdomain.com
       http:
         paths:
         - path: /
           pathType: Prefix
           backend:
             service:
               name: prometheus-grafana
               port:
                 number: 80
   EOF
   ```

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
   kubectl autoscale deployment kai-api-server -n kai-ml \
     --cpu-percent=75 \
     --min=3 \
     --max=10
   ```

2. Create an HPA for the Coordinator service:
   ```bash
   kubectl autoscale deployment coordinator-service -n kai-ml \
     --cpu-percent=70 \
     --min=3 \
     --max=6
   ```

### Node Pool Autoscaling

Enable node pool autoscaling:

1. In the DigitalOcean console, go to your Kubernetes cluster
2. Select the node pool you want to autoscale
3. Click **Edit** and enable autoscaling
4. Set minimum and maximum node count:
   - API Server Pool: Min 3, Max 6
   - CPU-Optimized Pool: Min 3, Max 6
   - GPU-Optimized Pool: Min 1, Max 4
   - Memory-Optimized Pool: Min 1, Max 3
   - Spot Instances Pool: Min 0, Max 6 (can scale to zero when not needed)

### Resource Quota Management

Set up resource quotas to limit resource consumption:

```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ResourceQuota
metadata:
  name: kai-quota
  namespace: kai-ml
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
     --include-namespaces kai-ml
   ```
### Backing Up Argo Workflows

For workflow state and templates:

```bash
# Backup Argo workflow templates
kubectl get workflowtemplates -n kai-ml -o yaml > workflow-templates-backup.yaml

# Backup completed workflows for reference
kubectl get workflows -n kai-ml --field-selector status.phase=Succeeded -o yaml > completed-workflows-backup.yaml
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

The architecture specifically supports the Argo Workflows-based orchestration of ML pipelines with specialized node pools for different workload types. This ensures efficient resource utilization, with GPU-intensive tasks running on appropriate hardware and lower-priority tasks utilizing cost-effective spot instances.

Remember to regularly monitor your cluster, maintain backups, and keep your Kubernetes version up-to-date for the best performance and security. For more detailed information about the architecture, refer to the [Kubernetes Architecture Documentation](./kubernetes-architecture.md).