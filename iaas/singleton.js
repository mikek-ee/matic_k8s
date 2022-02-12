"use strict";
const pulumi = require("@pulumi/pulumi");
const gcp = require("@pulumi/gcp");
const fs = require("fs");

const randstr = (len = 5) => {
    return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, len);
}

const createInstance = (name = 'inst-' + randstr(5), img = "debian-cloud/debian-10") => {
    const instance = new gcp.compute.Instance("defaultInstance", {
        name: name,
        machineType: "e2-micro",
        zone: "europe-west1-b",
        tags: ["foo", "bar"],
        bootDisk: {
            initializeParams: {
                image: img,
            }
        },
        networkInterfaces: [{
            network: "default",
            accessConfigs: [{}],
        }],
        metadata: {
            foo: "bar"
        },
        metadataStartupScript: fs.readFileSync("./iaas/scalegroupdo.sh").toString(),
        serviceAccount: {
            email: "847681964306-compute@developer.gserviceaccount.com",
            scopes: ["cloud-platform"]
        }
    })

    return instance
}

exports.createInstance = createInstance