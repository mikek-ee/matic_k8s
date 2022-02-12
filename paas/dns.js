"use strict";
const gcp = require("@pulumi/gcp");

// Creates a DNS A record in the specified zone
const createARecord = (zoneName, dnsName, address) => {
    const zone = gcp.dns.getManagedZone({ name: zoneName })
    const rec = new gcp.dns.RecordSet(`dns-rec-${zoneName}-${dnsName}`, {
        name: zone.then(z => `${dnsName}.${z.dnsName}`),
        type: "A",
        ttl: 5,
        managedZone: zone.then(z => z.name),
        rrdatas: [address]
    })

    return rec
}

exports.createARecord = createARecord