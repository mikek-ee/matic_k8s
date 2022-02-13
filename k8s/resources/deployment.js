const k8s = require("@pulumi/kubernetes");

const createDeployment = ({
    name,
    metadata,
    config: { matchLabels },
    provider }) => {

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
    return deployment
}
exports.createDeployment = createDeployment