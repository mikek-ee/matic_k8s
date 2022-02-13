const k8s = require("@pulumi/kubernetes");
const pulumi = require("@pulumi/pulumi")

const storage = require("../resources/storage")
const service = require("../resources/service")

// Required config:
// bor.chainStorage: Size of persistant storage disk (e.g. "200Gi")
// bor.genesisURI: URI of genesis file.  Must be accessible from pod.
// bor.image: Image to launch pod (e.g. "maticnetwork/bor:v0.2.14")
const cfg = new pulumi.Config().requireObject("bor")

// Creates a new bor workload on the supplied cluster
const createWorkload = (name, provider) => {

    // Create namespace & reused metadata
    const ns = new k8s.core.v1.Namespace(name, {}, { provider })
    const namespaceName = ns.metadata.apply(m => m.name)
    const appLabels = { appClass: name }
    const metadata = {
        namespace: namespaceName,
        labels: appLabels,
    }

    const { storageClass, pvClaim } = storage.createStorage({
        metadata, name, provider,
        config: { storageAmt: cfg.chainStorage }
    });

    const publicPorts = [
        { name: 'bor-peer-udp', port: 30303, protocol: 'UDP' },
        { name: 'bor-peer-tcp', port: 30303, protocol: 'TCP' },
        { name: 'bor-rpc-tcp', port: 30303, protocol: 'TCP' },
    ]

    const deployment = new k8s.apps.v1.Deployment(
        name,
        {
            metadata,
            spec: {
                replicas: 1,
                selector: { matchLabels: appLabels },
                template: {
                    metadata,
                    spec: {
                        volumes: [
                            {
                                name: "bor-datadir",
                                persistentVolumeClaim: {
                                    claimName: pvClaim.metadata.apply(m => m.name)
                                }
                            }
                        ],
                        containers: [
                            {
                                name: name,
                                image: cfg.image,
                                command: ["/bin/sh", "-c"],
                                args: [`curl ${cfg.genesisURI} > ~/genesis.json; 
                                bor --datadir /datadir init ~/genesis.json; 
                                bor --datadir /datadir \
                                    --port 30303 \
                                    --http \
                                    --http.addr 0.0.0.0 \
                                    --http.vhosts '*' \
                                    --http.corsdomain '*' \
                                    --http.port 8545 \
                                    --http.api 'admin,web3,eth,txpool'`],

                                ports: publicPorts.map(p => ({
                                    name: p.name,
                                    containerPort: p.port,
                                    protocol: p.protocol
                                })),

                                volumeMounts: [{
                                    mountPath: "/datadir",
                                    name: "bor-datadir",
                                }]
                            }
                        ]
                    }
                }
            }
        },
        { provider }
    )
    const deploymentName = deployment.metadata.apply(m => m.name)

    const services = publicPorts.map(p => {
        return service.createService({
            metadata,
            config: {
                appLabels,
                svcName: `${p.name}-svc`,
                portName: p.name,
                port: p.port,
                protocol: p.protocol,
            },
            provider
        })
    })

    return {
        namespaceName,
        deploymentName,
        services,
    }
}

exports.createWorkload = createWorkload