"use strict";

const k8s = require("@pulumi/kubernetes");
const pulumi = require("@pulumi/pulumi");

const dns = require("../../paas/dns")
const createARecord = dns.createARecord

const createGuestBook = (namespaceName, clusterProvider) => {
    const appLabels = { appClass: "guestbook" }

    const guestbook = new k8s.yaml.ConfigFile("guestbook",
        {
            file: "https://raw.githubusercontent.com/pulumi/pulumi-kubernetes/master/tests/sdk/nodejs/examples/yaml-guestbook/yaml/guestbook.yaml",
            transformations: [
                (obj) => {
                    // Do transformations on the YAML to use the same namespace and
                    // labels as the NGINX stack above
                    if (obj.metadata.labels) {
                        obj.metadata.labels['appClass'] = namespaceName
                    } else {
                        obj.metadata.labels = appLabels
                    }

                    // Make the 'frontend' Service public by setting it to be of type
                    // LoadBalancer
                    if (obj.kind == "Service" && obj.metadata.name == "frontend") {
                        if (obj.spec) {
                            obj.spec.type = "LoadBalancer"
                        }
                    }
                }
            ],
        },
        {
            providers: { "kubernetes": clusterProvider },
        },
    );

    // Export the Guestbook public LoadBalancer endpoint
    const guestbookPublicIP =
        guestbook.getResourceProperty("v1/Service", "frontend", "status").apply(s => s.loadBalancer.ingress[0].ip);

    createARecord("pb", "guestbook", guestbookPublicIP)

    return { guestbook, guestbookPublicIP }
}

exports.createGuestBook = createGuestBook