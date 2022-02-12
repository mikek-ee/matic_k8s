"use strict";
const pulumi = require("@pulumi/pulumi");
const gcp = require("@pulumi/gcp");
const fs = require("fs");

const dns = require("../paas/dns")
const createARecord = dns.createARecord

const createComputeEntities = () => {
    const bootImage = gcp.compute.getImage({ family: "debian-10", project: "debian-cloud" })
    const startupScript = fs.readFileSync("./scalegroupdo.sh").toString()

    const template = new gcp.compute.InstanceTemplate("scalegroup-template-1", {
        namePrefix: "instance-template-",
        machineType: "e2-micro",
        zone: "europe-west1-b",
        disks: [{ sourceImage: bootImage.then(bootImage => bootImage.selfLink) }],
        networkInterfaces: [{
            network: "default",
            accessConfigs: [{}],
        }],
        metadataStartupScript: startupScript,
        serviceAccount: {
            email: "847681964306-compute@developer.gserviceaccount.com",
            scopes: ["cloud-platform"]
        }
    })

    const healthCheck = new gcp.compute.HttpHealthCheck("defaultHttpHealthCheck", {
        name: "healthcheck",
        requestPath: "/",
        checkIntervalSec: 1,
        timeoutSec: 1,
    });

    const manager = new gcp.compute.InstanceGroupManager("scalegroup-manager-1", {
        InstanceTemplate: template.id,
        baseInstanceName: "inst",
        zone: "europe-west1-b",
        versions: [{
            instanceTemplate: template.id
        }],
        autoHealingPolicies: {
            healthCheck: healthCheck.id,
            initialDelaySec: 30
        },
        targetSize: 3,
        namedPorts: [{ name: "custom-http", port: 80 }],
        updatePolicy: {
            minimalAction: "REPLACE",
            type: "PROACTIVE",
            maxUnavailableFixed: 1,
        }
    })

    return { bootImage, template, healthCheck, manager }
}

const createNetworkEntites = (healthCheck, instanceGroup) => {
    const backendService = new gcp.compute.BackendService("backendService", {
        name: "backend",
        portName: "custom-http",
        protocol: "HTTP",
        healthChecks: healthCheck.id,
        backends: [{
            group: instanceGroup
        }]
    });

    const urlmap = new gcp.compute.URLMap("url-map", {
        defaultService: backendService.selfLink,
        hostRules: [
            { hosts: ["*"], pathMatcher: "allpaths" }
        ],
        pathMatchers: [
            { name: "allpaths", defaultService: backendService.selfLink }
        ]
    })

    const targetHttpProxy = new gcp.compute.TargetHttpProxy("scale-httpproxy", {
        backendService: backendService.id,
        urlMap: urlmap.selfLink
    })

    const globalAddress = new gcp.compute.GlobalAddress("scale-globaladdr", {})
    const forwardingRule = new gcp.compute.GlobalForwardingRule("scale-fwd-rule", {
        target: targetHttpProxy.selfLink,
        ipAddress: globalAddress.address,
        portRange: "80",
    })

    return {
        backendService,
        urlmap,
        targetHttpProxy,
        globalAddress,
        forwardingRule
    }
}

// Creates all scale group entities
const createScaleGroup = (dnsName) => {
    const {
        bootImage,
        template,
        healthCheck,
        manager
    } = createComputeEntities()

    const {
        backendService,
        urlmap,
        targetHttpProxy,
        globalAddress,
        forwardingRule
    } = createNetworkEntites(healthCheck, manager.instanceGroup)

    const rec = createARecord("pb", dnsName, globalAddress.address)

    return {
        bootImage: bootImage,
        template: template,
        manager: manager,
        proxy: targetHttpProxy,
        address: globalAddress,
        dnsName: rec.name,
    }
}

exports.createScaleGroup = createScaleGroup