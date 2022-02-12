"use strict";
const pulumi = require("@pulumi/pulumi");
const gcp = require("@pulumi/gcp");

const createWeb = () => {
    // Create a GCP resource (Storage Bucket)
    const bucket = new gcp.storage.Bucket("my-bucket", {
        website: {
            mainPageSuffix: "index.html"
        },
        location: "US",
        uniformBucketLevelAccess: true,
    });

    const bucketIAMBinding = new gcp.storage.BucketIAMBinding("my-bucket-IAMBinding", {
        bucket: bucket.name,
        role: "roles/storage.objectViewer",
        members: ["allUsers"]
    })

    const bucketObject = new gcp.storage.BucketObject("index.html", {
        bucket: bucket.name,
        contentType: "text/html",
        source: new pulumi.asset.FileAsset("./paas/index.html"),
    });

    // Export the DNS name of the bucket
    return {
        bucketName: bucket.url,
        bucketEndpoint: pulumi.concat("http://storage.googleapis.com/", bucket.name, "/", bucketObject.name)
    }
}

exports.createWeb = createWeb