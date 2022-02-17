const k8s = require("@pulumi/kubernetes")
const pulumi = require("@pulumi/pulumi")

const storage = require("../resources/storage")
const service = require("../resources/service")
const deployment = require("../resources/deployment")

// Required config:
// bor.chainStorage: Size of persistant storage disk (e.g. "200Gi")
// bor.genesisURI: URI of genesis file.  Must be accessible from pod.
// bor.image: Image to launch pod (e.g. "maticnetwork/bor:v0.2.14")
const cfg = new pulumi.Config().requireObject("bor")

// Creates a new bor workload on the supplied cluster
const createWorkload = ({ name, provider }) => {

    // Create namespace & reused metadata
    const ns = new k8s.core.v1.Namespace(name, {}, { provider })
    const namespaceName = ns.metadata.apply(m => m.name)
    const appLabels = { appClass: name }
    const metadata = {
        namespace: namespaceName,
        labels: appLabels,
    }

    // Define network reqs
    const publicPorts = [
        { name: `${name}-peer-udp`, port: 30303, protocol: 'UDP' },
        { name: `${name}-peer-tcp`, port: 30303, protocol: 'TCP' },
        { name: `${name}-rpc-tcp`, port: 8545, protocol: 'TCP' },
    ]

    // Define storage reqs
    let storageNeeds = [
        { name: `${name}-datadir`, storageAmt: cfg.chainStorage, mountPath: "/datadir" }
    ]

    // Create storage
    storageNeeds = storageNeeds.map(s => (
        {
            ...s,
            ...storage.createStorage({
                name,
                metadata,
                config: { storageAmt: s.storageAmt },
                provider
            })
        }
    ))

    // Create deployment

    // Shell command will download a genesis block, initialise the data dir and 
    // launch bor.
    const shellCmd = `curl ${cfg.genesisURI} > ~/genesis.json; 
    bor --datadir /datadir init ~/genesis.json; 
    bor --datadir /datadir \
        --port 30303 \
        --http \
        --http.addr 0.0.0.0 \
        --http.vhosts '*' \
        --http.corsdomain '*' \
        --http.port 8545 \
        --http.api 'admin,web3,eth,txpool'`

    const dep = deployment.createDeployment({
        name,
        metadata,
        config: {
            replicas: 1,
            matchLabels: appLabels,
            storageNeeds,
            image: cfg.image,
            shellCmd,
            publicPorts
        },
        provider
    })
    const deploymentName = dep.metadata.apply(m => m.name)

    // Create network svcs
    const services = publicPorts.map(p => {
        return service.createService({
            name: `${p.name}-svc`,
            metadata,
            config: {
                appLabels,
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