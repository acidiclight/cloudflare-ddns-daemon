require('dotenv').config();

const axios = require('axios');
const publicIP = require('public-ip');

let zoneID = '';
let record = {}

const headers = {}

function logErrors(errors) {
    for (const error of errors) {
        console.error(`CF error code ${error.code}: ${error.message}`)
        if (error.error_chain)
            logErrors(error.error_chain)
    }
}

function logResponse(body) {
    for (const message of body.messages) {
        console.log(`Cloudflare code ${message.code}: ${message.message}`)
    }

    if (!body.success) {
        console.error("Cloudflare request returned errors.");
        logErrors(body.errors)
    }
}

function handleData(body, cb) {
    logResponse(body)

    if (body.success) cb(body.result)
}

function makeRequest(path, cb, method, data) {
    const realMethod = method || 'get';
    if (realMethod === 'get') {
        if (data) {
            const params = new URLSearchParams(data).toString();
            data = null;
            path += `?${params}`
        }
    }

    axios({
        url: `https://api.cloudflare.com/client/v4${path}`,
        method: realMethod,
        data: data || null,
        headers,
    }).then((response) => {
        const data = response.data;
        handleData(data, (result) => {
            cb(result);
        });
    }).catch((error) => {
        throw error
    })
}

async function updateDNS() {
    console.log('Checking your public IP...');
    const ip = await publicIP.v4();
    console.log(`Public IP is ${ip}, Cloudflare is pointed at ${record.content}.`);
    if (record.content !== ip) {
        console.log('IP address do not match. Updating the DNS record...')
        makeRequest(`/zones/${zoneID}/dns_records/${record.id}`, (result) => {
            record.content = ip;
            console.log('DNS record has been updated.');
        }, 'put', {
            name: record.name,
            type: record.type,
            ttl: record.ttl,
            content: ip
        });
    }
}

function verifyToken() {
    const token = process.env.CLOUDFLARE_API_TOKEN
    const zone = process.env.CLOUDFLARE_ZONE

    if (!token) {
        console.error('CLOUDFLARE_API_TOKEN environment variable not set.');
        process.exit(-1)
    }

    if (!zone) {
        console.error('CLOUDFLARE_ZONE environment variable is not set.');
        process.exit(-2);
    }

    const domain = process.env.DNS_RECORD_NAME || zone;


    // curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
    //      -H "Authorization: Bearer uuSrSzPu1OgXuA9mtvzYrVPSM358jFSfdsjpLk8e" \
    //      -H "Content-Type:application/json"
    headers['Authorization'] = `Bearer ${token}`

    makeRequest('/user/tokens/verify', (result) => {
        makeRequest('/zones', (zones) => {
            if (!zones) {
                console.error(`Could not find the specified zone (domain name) "${zone}" on your Cloudflare account. Have you added this domain to your account yet?`);
                process.exit(-3)
            }
            else {
                zoneID = zones[0].id
                console.log(`Found the domain name ${zone} on your Cloudflare account. Zone ID is ${zone.id}.`)
                makeRequest(`/zones/${zoneID}/dns_records`, (records) => {
                   if (records) {
                       record = records[0]
                       console.log(`Found an A record for the domain name ${domain}. It's currentlyy pointing to ${record.content}.`);
                       setInterval(updateDNS, 30 * 1000);
                       (async() => {
                           await updateDNS();
                       })();
                   } else {
                       (async () => {
                           const ip = await publicIP.v4();
                           console.error(`Could not find a DNS record for the the domain ${domain} inside the zone ${zone}. Please create an A record for ${domain} and point it at your current IP address.`)
                           console.log(`Your current IP address is ${ip}.`)
                           process.exit(-3)
                       })();
                   }
                }, 'get', {
                    type: 'A',
                    name: domain
                });
            }
        }, 'get', {
            name: zone
        });
    });
}

verifyToken();