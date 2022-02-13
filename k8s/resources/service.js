const k8s = require("@pulumi/kubernetes");

// TODO: able to publish w/o a load balancer?  
// Currently multiple services = multiple public IPs.
// TODO: Add DNS registration
const createService = ({
    name,
    metadata,
    config: { appLabels, portName, port, protocol },
    provider }) => {

    return new k8s.core.v1.Service(
        name,
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

exports.createService = createService