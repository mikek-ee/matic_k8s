const k8s = require("@pulumi/kubernetes");
const pulumi = require("@pulumi/pulumi")
const dns = require("../../paas/dns")

// Required config:
// chainStorage: Size of persistant storage disk (e.g. "200Gi")
// genesisURI: URI of genesis file.  Must be accessible from pod.
// image: Image to launch pod (e.g. "maticnetwork/bor:v0.2.14")
const cfg = new pulumi.Config().requireObject("bor")

// Creates a new BOR workload on the supplied cluster
const createWorkload = (name, provider) => {
    // Create namespace & reused metadata
    const ns = new k8s.core.v1.Namespace(name, {}, { provider })
    const namespaceName = ns.metadata.apply(m => m.name)
    const appLabels = { appClass: name }
    const metadata = {
        namespace: namespaceName,
        labels: appLabels,
    }

    // Create auto-provisioning storage class
    const storageClass = new k8s.storage.v1.StorageClass(
        name,
        {
            metadata,
            provisioner: "kubernetes.io/gce-pd",
            parameters: {
                type: "pd-ssd",
            }
        },
        { provider }
    )

    // Create storage claim for 
    const pvClaim = new k8s.core.v1.PersistentVolumeClaim(
        name,
        {
            metadata,
            spec: {
                storageClassName: storageClass.metadata.apply(m => m.name),
                accessModes: ["ReadWriteOnce"],
                resources: {
                    requests: {
                        storage: cfg.chainStorage
                    }
                }
            }
        },
        { provider }
    )

    // const genesisURI = "https://raw.githubusercontent.com/maticnetwork/launch/master/mainnet-v1/sentry/sentry/bor/genesis.json"
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
                                    --http.api 'eth,net,web3,txpool,bor'`],
                                ports: [
                                    { name: "borrpc", containerPort: 8545 },
                                    { name: "borpeertcp", containerPort: 30303, protocol: "TCP" },
                                    { name: "borpeerudp", containerPort: 30303, protocol: "UDP" },
                                ],
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

    // TODO: able to publish w/o a load balancer?  Multiple services = multiple public IPs.
    const createService = (svcName, portName, port, protocol) => {
        return new k8s.core.v1.Service(
            svcName,
            {
                metadata,
                spec: {
                    type: "LoadBalancer",
                    sessionAffinity: "ClientIP",
                    ports: [
                        { name: portName, port, protocol },
                    ],
                    selector: appLabels
                }
            },
            { provider }
        )
    }

    const udpService = createService(`${name}-svc-udp`, 'bor-peer-udp', 30303, "UDP")
    const tcpService = createService(`${name}-svc-tcp`, 'bor-peer-tcp', 30303, "TCP")
    const rpcService = createService(`${name}-svc-rpc`, 'bor-peer-rpc', 8545, "TCP")

    const rpcIP = rpcService.status.apply(s => s.loadBalancer.ingress[0].ip);
    const rpcName = dns.createARecord("pb", "borrpc", rpcIP)

    return {
        namespaceName,
        deploymentName,
        rpcName
    }
}

exports.createWorkload = createWorkload