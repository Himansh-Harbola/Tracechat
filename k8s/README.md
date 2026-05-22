# Self-Hosted Kubernetes Deployment

These manifests deploy TraceChat on a self-hosted Kubernetes cluster with:

- web frontend
- API server
- ingestion worker
- PostgreSQL
- Redis queue
- NGINX ingress

## Steps

1. Build and push images to your registry:

```bash
docker build -f apps/server/Dockerfile -t your-registry/tracechat-server:latest .
docker build -f apps/client/Dockerfile -t your-registry/tracechat-client:latest .
docker push your-registry/tracechat-server:latest
docker push your-registry/tracechat-client:latest
```

2. Replace image names in:

- `server.yaml`
- `worker.yaml`
- `client.yaml`

3. Copy and edit secrets:

```bash
cp k8s/secrets.example.yaml k8s/secrets.yaml
```

4. Update host/config in:

- `configmap.yaml`
- `ingress.yaml`

5. Apply:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/server.yaml
kubectl apply -f k8s/worker.yaml
kubectl apply -f k8s/client.yaml
kubectl apply -f k8s/ingress.yaml
```

6. Verify:

```bash
kubectl get pods -n tracechat
kubectl logs deploy/tracechat-api -n tracechat
kubectl logs deploy/tracechat-worker -n tracechat
```
