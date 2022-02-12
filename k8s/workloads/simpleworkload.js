const k8s = require("@pulumi/kubernetes");
const pulumi = require("@pulumi/pulumi");

const dns = require("../../paas/dns")
const createARecord = dns.createARecord

const createWorkload = (name, clusterProvider) => {
    const ns = new k8s.core.v1.Namespace(name, {}, { provider: clusterProvider })
    const namespaceName = ns.metadata.apply(m => m.name)

    const appLabels = { appClass: name }

    const deployment = new k8s.apps.v1.Deployment(
        name,
        {
            metadata: {
                namespace: namespaceName,
                labels: appLabels,
            },
            spec: {
                replicas: 1,
                selector: { matchLabels: appLabels },
                template: {
                    metadata: {
                        labels: appLabels,
                    },
                    spec: {
                        containers: [
                            {
                                name: name,
                                image: "nginx:latest",
                                ports: [{ name: "http", containerPort: 80 }]
                            }
                        ]
                    }
                }
            }
        },
        { provider: clusterProvider }
    )
    const deploymentName = deployment.metadata.apply(m => m.name)

    const service = new k8s.core.v1.Service(
        name,
        {
            metadata: {
                labels: appLabels,
                namespace: namespaceName
            },
            spec: {
                type: "LoadBalancer",
                ports: [{ port: 80, targetPort: "http" }],
                selector: appLabels
            }
        },
        { provider: clusterProvider }
    )

    const serviceName = service.metadata.apply(m => m.name)
    const servicePublicIP = service.status.apply(s => s.loadBalancer.ingress[0].ip)

    createARecord("pb", "kubetest", servicePublicIP)

    return {
        namespaceName,
        deploymentName,
        serviceName,
        servicePublicIP

    }
}

exports.createWorkload = createWorkload