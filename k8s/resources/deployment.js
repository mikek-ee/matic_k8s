const k8s = require("@pulumi/kubernetes");

// Note: replicas > 1 & persistent storage are currently mutually exclusive

const createDeployment = ({
    name,
    metadata,
    config: {
        replicas, matchLabels, storageNeeds,
        image, shellCmd, publicPorts },
    provider }) => {

    const deployment = new k8s.apps.v1.Deployment(
        name,
        {
            metadata,
            spec: {
                replicas,
                selector: { matchLabels },
                template: {
                    metadata,
                    spec: {
                        volumes: storageNeeds.map(s => ({
                            name: s.name,
                            persistentVolumeClaim: {
                                claimName: s.pvClaim.metadata.apply(m => m.name)
                            }
                        })),

                        containers: [
                            {
                                name: name,
                                image: image,
                                command: ["/bin/sh", "-c"],
                                args: [shellCmd],

                                ports: publicPorts.map(p => ({
                                    name: p.name,
                                    containerPort: p.port,
                                    protocol: p.protocol,
                                })),

                                volumeMounts: storageNeeds.map(s => ({
                                    name: s.name,
                                    mountPath: s.mountPath,
                                })),
                            }
                        ]
                    }
                }
            }
        },
        { provider }
    )
    return deployment
}
exports.createDeployment = createDeployment