const k8s = require("@pulumi/kubernetes");
const pulumi = require("@pulumi/pulumi")

const createStorage = ({ metadata, name, provider, config }) => {
    // Create auto-provisioning storage class
    const storageClass = new k8s.storage.v1.StorageClass(
        name,
        {
            metadata,
            provisioner: "kubernetes.io/gce-pd",
            parameters: {
                type: "pd-standard",
            }
        },
        { provider }
    )

    // Create storage claim 
    const pvClaim = new k8s.core.v1.PersistentVolumeClaim(
        name,
        {
            metadata,
            spec: {
                storageClassName: storageClass.metadata.apply(m => m.name),
                accessModes: ["ReadWriteOnce"],
                resources: {
                    requests: {
                        storage: config.storageAmt
                    }
                }
            }
        },
        { provider }
    )

    return { storageClass, pvClaim }
}

exports.createStorage = createStorage;