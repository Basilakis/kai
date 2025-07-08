+++
id = "quick-start-deployment-commands"
title = "Quick Start: Essential Deployment Commands"
context_type = "documentation"
scope = "Essential commands for rapid deployment and troubleshooting"
target_audience = ["devops", "developers", "operators"]
granularity = "reference"
status = "active"
last_updated = "2025-07-08"
tags = ["deployment", "commands", "quick-reference", "troubleshooting"]
related_context = [
    ".ruru/docs/deployment/comprehensive-deployment-guide.md"
]
+++

# Quick Start: Essential Deployment Commands

## Prerequisites Setup

### Environment Variables
```bash
# Required for all operations
export DIGITALOCEAN_TOKEN="your_do_token_here"
export REGISTRY_URL="ghcr.io/basilakis/kai"
```

### Tool Installation Check
```bash
# Verify all required tools are installed
terraform version    # Should be >= 1.0
kubectl version      # Should be >= 1.28
flux version         # Should be >= 2.0
helm version         # Should be >= 3.0
git --version        # Any recent version
```

## 🚀 Complete Deployment (Fresh Start)

### 1. Infrastructure Deployment
```bash
# Navigate to infrastructure directory
cd infra/

# Initialize and apply Terraform
terraform init
terraform plan
terraform apply -auto-approve

# Get cluster credentials
CLUSTER_ID=$(terraform output -raw cluster-id)
doctl kubernetes cluster kubeconfig save $CLUSTER_ID

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### 2. GitOps Setup
```bash
# Install Flux
flux check --pre
flux install

# Apply production configuration
kubectl apply -k flux/clusters/production/

# Verify Flux installation
flux get all
```

### 3. Application Deployment
```bash
# Deploy all Kai services
kubectl apply -k flux/clusters/production/kai/

# Check deployment status
kubectl get pods -n kai
kubectl get svc -n kai
```

## 🔍 Status Checking Commands

### Infrastructure Status
```bash
# Check Terraform state
cd infra/ && terraform show

# Check cluster nodes
kubectl get nodes -o wide

# Check cluster resources
kubectl top nodes
kubectl top pods --all-namespaces
```

### GitOps Status
```bash
# Check all Flux resources
flux get all

# Check specific components
flux get sources git
flux get sources helm
flux get helmreleases
flux get kustomizations
```

### Application Status
```bash
# Check all Kai services
kubectl get all -n kai

# Check specific deployments
kubectl get deployment -n kai
kubectl get pods -n kai -o wide

# Check service endpoints
kubectl get svc -n kai
kubectl get ingress -n kai
```

## 🐛 Troubleshooting Commands

### Flux Issues
```bash
# Force reconciliation
flux reconcile source git kai-charts
flux reconcile helmrelease api-server
flux reconcile helmrelease coordinator

# Check Flux logs
kubectl logs -n flux-system deployment/source-controller -f
kubectl logs -n flux-system deployment/helm-controller -f
kubectl logs -n flux-system deployment/kustomize-controller -f
```

### Application Issues
```bash
# Check pod logs
kubectl logs -n kai deployment/api-server -f
kubectl logs -n kai deployment/coordinator -f

# Check pod details
kubectl describe pod -n kai <pod-name>

# Check events
kubectl get events -n kai --sort-by='.lastTimestamp'

# Check resource usage
kubectl top pods -n kai
```

### Image Pull Issues
```bash
# Check image pull secrets
kubectl get secrets -n kai

# Test image accessibility
docker pull ghcr.io/basilakis/kai/api-server:latest

# Check registry credentials
kubectl describe secret -n kai <secret-name>
```

## 🔄 Update & Maintenance Commands

### Update Application Images
```bash
# Update specific service image
kubectl set image deployment/api-server -n kai api-server=ghcr.io/basilakis/kai/api-server:v1.2.3

# Restart deployment (force pull latest)
kubectl rollout restart deployment/api-server -n kai

# Check rollout status
kubectl rollout status deployment/api-server -n kai
```

### Scale Services
```bash
# Scale specific deployment
kubectl scale deployment api-server -n kai --replicas=3

# Scale cluster nodes (via Terraform)
cd infra/
terraform apply -var="max_nodes=10"
```

### Update Flux Configuration
```bash
# After making changes to flux/ directory
kubectl apply -k flux/clusters/production/

# Force Flux to sync changes
flux reconcile source git kai-charts --with-source
```

## 🧹 Cleanup Commands

### Remove Applications
```bash
# Remove all Kai applications
kubectl delete -k flux/clusters/production/kai/

# Remove specific service
kubectl delete -f flux/clusters/production/releases/api-server.yaml
```

### Remove Flux
```bash
# Uninstall Flux (keeps CRDs)
flux uninstall

# Complete removal (including CRDs)
flux uninstall --crds
```

### Destroy Infrastructure
```bash
# WARNING: This destroys the entire cluster
cd infra/
terraform destroy -auto-approve
```

## 📊 Monitoring Commands

### Resource Usage
```bash
# Node resource usage
kubectl top nodes

# Pod resource usage
kubectl top pods --all-namespaces

# Specific namespace usage
kubectl top pods -n kai
```

### Service Health
```bash
# Check service endpoints
kubectl get endpoints -n kai

# Test service connectivity
kubectl run test-pod --image=busybox -it --rm -- /bin/sh
# Inside pod: wget -qO- http://api-server.kai.svc.cluster.local:8080/health
```

### Logs Collection
```bash
# Collect logs from all Kai services
kubectl logs -n kai -l app=api-server --tail=100
kubectl logs -n kai -l app=coordinator --tail=100

# Export logs to file
kubectl logs -n kai deployment/api-server > api-server.log
```

## 🔐 Security Commands

### Check RBAC
```bash
# Check service accounts
kubectl get serviceaccounts -n kai

# Check role bindings
kubectl get rolebindings -n kai
kubectl get clusterrolebindings | grep kai
```

### Secrets Management
```bash
# List secrets
kubectl get secrets -n kai

# Check secret content (base64 encoded)
kubectl get secret coordinator-secrets -n kai -o yaml

# Create/update secret
kubectl create secret generic new-secret \
  --from-literal=key1=value1 \
  --from-literal=key2=value2 \
  -n kai
```

## 🚨 Emergency Procedures

### Complete Service Restart
```bash
# Restart all Kai services
kubectl rollout restart deployment -n kai

# Wait for all deployments to be ready
kubectl wait --for=condition=available --timeout=300s deployment --all -n kai
```

### Cluster Recovery
```bash
# If cluster is unresponsive, recreate from Terraform
cd infra/
terraform destroy -auto-approve
terraform apply -auto-approve

# Then redeploy everything
CLUSTER_ID=$(terraform output -raw cluster-id)
doctl kubernetes cluster kubeconfig save $CLUSTER_ID
flux install
kubectl apply -k flux/clusters/production/
```

### Rollback Deployment
```bash
# Check rollout history
kubectl rollout history deployment/api-server -n kai

# Rollback to previous version
kubectl rollout undo deployment/api-server -n kai

# Rollback to specific revision
kubectl rollout undo deployment/api-server -n kai --to-revision=2
```

## 📝 Useful Aliases

Add these to your shell profile for faster operations:

```bash
# Kubernetes shortcuts
alias k='kubectl'
alias kgp='kubectl get pods'
alias kgs='kubectl get svc'
alias kgd='kubectl get deployment'
alias kdp='kubectl describe pod'
alias kl='kubectl logs'

# Kai-specific shortcuts
alias kai-pods='kubectl get pods -n kai'
alias kai-logs='kubectl logs -n kai'
alias kai-status='kubectl get all -n kai'

# Flux shortcuts
alias fga='flux get all'
alias fgs='flux get sources'
alias fgr='flux get helmreleases'
```

## 🔗 Quick Links

- **Full Documentation**: [`.ruru/docs/deployment/comprehensive-deployment-guide.md`](.ruru/docs/deployment/comprehensive-deployment-guide.md)
- **Infrastructure Code**: [`infra/`](../../infra/)
- **Flux Configuration**: [`flux/clusters/production/`](../../flux/clusters/production/)
- **Helm Charts**: [`helm-charts/`](../../helm-charts/)

## 📞 Support

For issues not covered by these commands:

1. Check the comprehensive deployment guide
2. Review Kubernetes events: `kubectl get events --sort-by='.lastTimestamp'`
3. Check Flux logs: `kubectl logs -n flux-system -l app=source-controller`
4. Verify infrastructure state: `cd infra/ && terraform show`