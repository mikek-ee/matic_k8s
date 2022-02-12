const k8s = require("@pulumi/kubernetes");
const pulumi = require("@pulumi/pulumi");
const gcp = require("@pulumi/gcp");

// Required config items:
// machineType: Instance type for k8s nodes
// initialNodeCount: Initial node qty
const cfg = new pulumi.Config().requireObject("k8s")

const createCluster = (name = "k8s-cluster") => {
  const engineVersion = gcp.container.getEngineVersions().then(v => v.latestMasterVersion)
  const cluster = new gcp.container.Cluster(name, {
    initialNodeCount: cfg.initialNodeCount,
    minMasterVersion: engineVersion,
    nodeVersion: engineVersion,
    nodeConfig: {
      machineType: cfg.machineType,
      oauthScopes: [
        "https://www.googleapis.com/auth/compute",
        "https://www.googleapis.com/auth/devstorage.read_only",
        "https://www.googleapis.com/auth/logging.write",
        "https://www.googleapis.com/auth/monitoring"]
    }
  })

  // TODO: migrate to javascript objects from YAML
  const kubeconfig = pulumi
    .all([cluster.name, cluster.endpoint, cluster.masterAuth])
    .apply(([name, endpoint, masterAuth]) => {
      const context = `${gcp.config.project}_${gcp.config.zone}_${name}`
      return `apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${masterAuth.clusterCaCertificate}
    server: https://${endpoint}
  name: ${context}
contexts:
- context:
    cluster: ${context}
    user: ${context}
  name: ${context}
current-context: ${context}
kind: Config
preferences: {}
users:
- name: ${context}
  user:
    auth-provider:
      config:
        cmd-args: config config-helper --format=json
        cmd-path: gcloud
        expiry-key: '{.credential.token_expiry}'
        token-key: '{.credential.access_token}'
      name: gcp`
    });

  const clusterProvider = new k8s.Provider(name, { kubeconfig: kubeconfig })

  return {
    cluster,
    clusterProvider,
    kubeconfig
  }
}

exports.createCluster = createCluster