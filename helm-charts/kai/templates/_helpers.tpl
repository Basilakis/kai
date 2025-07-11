{{/*
Expand the name of the chart.
*/}}
{{- define "kai.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "kai.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "kai.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "kai.labels" -}}
helm.sh/chart: {{ include "kai.chart" . }}
{{ include "kai.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: {{ .Values.global.labels.app | default "kai-platform" }}
environment: {{ .Values.global.environment }}
{{- with .Values.global.labels }}
{{- toYaml . | nindent 0 }}
{{- end }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "kai.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kai.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Service-specific labels
*/}}
{{- define "kai.serviceLabels" -}}
{{ include "kai.labels" . }}
app.kubernetes.io/component: {{ .Values.component | default "service" }}
{{- if .Values.tier }}
app.kubernetes.io/tier: {{ .Values.tier }}
{{- end }}
{{- end }}

{{/*
Service-specific selector labels
*/}}
{{- define "kai.serviceSelectorLabels" -}}
{{ include "kai.selectorLabels" . }}
app.kubernetes.io/component: {{ .Values.component | default "service" }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "kai.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "kai.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Generate image name with registry and tag
*/}}
{{- define "kai.image" -}}
{{- $registry := .Values.global.registry.url | default "ghcr.io" }}
{{- $repository := .Values.global.repository | default "kai" }}
{{- $service := .Values.serviceName | required "serviceName is required" }}
{{- $tag := .Values.global.image.tag | default .Chart.AppVersion | default "latest" }}
{{- printf "%s/%s/kai-%s:%s" $registry $repository $service $tag }}
{{- end }}

{{/*
Generate resource requests and limits with multiplier support
*/}}
{{- define "kai.resources" -}}
{{- $multiplier := .Values.global.resourceMultiplier | default 1 }}
{{- if .Values.resources }}
resources:
  {{- if .Values.resources.requests }}
  requests:
    {{- if .Values.resources.requests.cpu }}
    cpu: {{ .Values.resources.requests.cpu | quote }}
    {{- end }}
    {{- if .Values.resources.requests.memory }}
    memory: {{ .Values.resources.requests.memory | quote }}
    {{- end }}
  {{- end }}
  {{- if .Values.resources.limits }}
  limits:
    {{- if .Values.resources.limits.cpu }}
    cpu: {{ .Values.resources.limits.cpu | quote }}
    {{- end }}
    {{- if .Values.resources.limits.memory }}
    memory: {{ .Values.resources.limits.memory | quote }}
    {{- end }}
  {{- end }}
{{- end }}
{{- end }}

{{/*
Generate common environment variables
*/}}
{{- define "kai.commonEnv" -}}
- name: NODE_ENV
  value: {{ .Values.global.environment | quote }}
- name: LOG_LEVEL
  value: {{ .Values.logLevel | default "info" | quote }}
- name: SERVICE_NAME
  value: {{ .Values.serviceName | quote }}
- name: NAMESPACE
  valueFrom:
    fieldRef:
      fieldPath: metadata.namespace
- name: POD_NAME
  valueFrom:
    fieldRef:
      fieldPath: metadata.name
- name: POD_IP
  valueFrom:
    fieldRef:
      fieldPath: status.podIP
{{- end }}

{{/*
Generate health check probes
*/}}
{{- define "kai.healthProbes" -}}
{{- if .Values.healthCheck.enabled | default true }}
livenessProbe:
  httpGet:
    path: {{ .Values.healthCheck.liveness.path | default "/health" }}
    port: {{ .Values.healthCheck.liveness.port | default "http" }}
  initialDelaySeconds: {{ .Values.healthCheck.liveness.initialDelaySeconds | default 30 }}
  periodSeconds: {{ .Values.healthCheck.liveness.periodSeconds | default 10 }}
  timeoutSeconds: {{ .Values.healthCheck.liveness.timeoutSeconds | default 5 }}
  failureThreshold: {{ .Values.healthCheck.liveness.failureThreshold | default 3 }}
readinessProbe:
  httpGet:
    path: {{ .Values.healthCheck.readiness.path | default "/health/ready" }}
    port: {{ .Values.healthCheck.readiness.port | default "http" }}
  initialDelaySeconds: {{ .Values.healthCheck.readiness.initialDelaySeconds | default 10 }}
  periodSeconds: {{ .Values.healthCheck.readiness.periodSeconds | default 5 }}
  timeoutSeconds: {{ .Values.healthCheck.readiness.timeoutSeconds | default 2 }}
  failureThreshold: {{ .Values.healthCheck.readiness.failureThreshold | default 3 }}
{{- end }}
{{- end }}

{{/*
Generate security context
*/}}
{{- define "kai.securityContext" -}}
securityContext:
  runAsNonRoot: true
  runAsUser: {{ .Values.securityContext.runAsUser | default 1001 }}
  runAsGroup: {{ .Values.securityContext.runAsGroup | default 1001 }}
  fsGroup: {{ .Values.securityContext.fsGroup | default 1001 }}
  allowPrivilegeEscalation: false
  capabilities:
    drop:
    - ALL
  readOnlyRootFilesystem: {{ .Values.securityContext.readOnlyRootFilesystem | default true }}
{{- end }}

{{/*
Generate pod security context
*/}}
{{- define "kai.podSecurityContext" -}}
securityContext:
  runAsNonRoot: true
  runAsUser: {{ .Values.podSecurityContext.runAsUser | default 1001 }}
  runAsGroup: {{ .Values.podSecurityContext.runAsGroup | default 1001 }}
  fsGroup: {{ .Values.podSecurityContext.fsGroup | default 1001 }}
  seccompProfile:
    type: RuntimeDefault
{{- end }}

{{/*
Generate affinity rules for better pod distribution
*/}}
{{- define "kai.affinity" -}}
{{- if .Values.affinity.enabled | default true }}
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchExpressions:
          - key: app.kubernetes.io/name
            operator: In
            values:
            - {{ include "kai.name" . }}
          - key: app.kubernetes.io/component
            operator: In
            values:
            - {{ .Values.component | default "service" }}
        topologyKey: "kubernetes.io/hostname"
  {{- if .Values.affinity.nodeAffinity }}
  nodeAffinity:
    {{- toYaml .Values.affinity.nodeAffinity | nindent 4 }}
  {{- end }}
{{- end }}
{{- end }}

{{/*
Generate monitoring annotations
*/}}
{{- define "kai.monitoringAnnotations" -}}
{{- if .Values.monitoring.enabled | default true }}
prometheus.io/scrape: "true"
prometheus.io/port: {{ .Values.monitoring.port | default "8080" | quote }}
prometheus.io/path: {{ .Values.monitoring.path | default "/metrics" | quote }}
{{- end }}
{{- end }}

{{/*
Generate canary deployment labels
*/}}
{{- define "kai.canaryLabels" -}}
{{- if .Values.global.canary.enabled }}
deployment-type: "canary"
canary-weight: {{ .Values.global.canary.weight | quote }}
{{- else }}
deployment-type: "stable"
{{- end }}
{{- end }}