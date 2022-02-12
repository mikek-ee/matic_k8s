"use strict";
const config = JSON.parse(require("fs").readFileSync("./features.json"))

// Create a web publishing storage bucket
if (config["webBucket"]) {
    const web = require("./paas/web")
    const webRes = web.createWeb()
    exports.bucketName = webRes.bucketName
    exports.bucketEndpoint = webRes.bucketEndpoint
}

// Create a singleton compute instance
if (config["singleton"]) {
    const singleton = require("./iaas/singleton")
    const instance = singleton.createInstance()
    exports.instanceName = instance.name
}

// Create a scaling group
if (config["scaleGroup"]) {
    const scaleGroup = require("./iaas/scalingGroup")
    const group = scaleGroup.createScaleGroup("mycluster")
    exports.bootImageId = group.bootImage.id
    exports.templateName = group.template.name
    exports.managerName = group.manager.name
    exports.balancerAddr = group.address.address
    exports.dnsName = group.dnsName
}

// Create a k8s cluster
if (config["k8s"]) {
    const k8scluster = require("./k8s/cluster/k8scluster")
    const { cluster, clusterProvider, kubeconfig } = k8scluster.createCluster()
    exports.clusterName = cluster.name
    exports.kubeConfig = kubeconfig

    if (config["k8s-nginx"]) {
        const simpleWorkload = require("./k8s/workloads/simpleworkload")
        simpleWorkload.createWorkload("simpleworkload", clusterProvider)
    }

    if (config["k8s-guestbook"]) {
        const guestbook = require("./k8s/workloads/guestbook")
        const gb = guestbook.createGuestBook("guestbook", clusterProvider)
        exports.guestbook = gb
        exports.guestbookPublicIP = gb.guestbookPublicIP
    }

    if (config["k8s-bor"]) {
        const simplebor = require("./k8s/workloads/simplebor")
        const bor = simplebor.createWorkload("bor", clusterProvider)
        exports.bor = bor
    }
}
