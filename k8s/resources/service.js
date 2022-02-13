const k8s = require("@pulumi/kubernetes");
const { provider } = require("@pulumi/pulumi");

// TODO: able to publish w/o a load balancer?  
// Currently multiple services = multiple public IPs.
// TODO: Add DNS registration
const createService = ({
    metadata,
    config: { appLabels, svcName, portName, port, protocol },
    provider }) => {

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

exports.createService = createService