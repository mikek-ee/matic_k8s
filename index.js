"use strict";
const config = JSON.parse(require("fs").readFileSync("./features.json"))

// Create a k8s cluster
if (config["k8s"]) {
    const k8scluster = require("./k8s/cluster/k8scluster")
    const { cluster, clusterProvider, kubeconfig } = k8scluster.createCluster()
    exports.clusterName = cluster.name
    exports.kubeConfig = kubeconfig

    if (config["k8s-bor"]) {
        const bor = require("./k8s/workloads/bor")
        const bornode = bor.createWorkload("bor", clusterProvider)
        exports.bor = bornode

        const bor2 = bor.createWorkload("bor_2", clusterProvider)
    }
}
