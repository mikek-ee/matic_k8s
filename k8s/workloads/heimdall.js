const k8s = require("@pulumi/kubernetes")
const pulumi = require("@pulumi/pulumi")

const storage = require("../resources/storage")
const service = require("../resources/service")
const deployment = require("../resources/deployment")

// Required config:
const cfg = new pulumi.Config().requireObject("heimdall")

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

    // Define network reqs
    const publicPorts = [
        { name: `${name}-p2p`, port: 26656, protocol: 'TCP' },
        { name: `${name}-rpc`, port: 26657, protocol: 'TCP' },
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
    // TODO: Create init & launch commands for Heimdall
    const shellCmd = ``

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