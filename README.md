# Cloudflare Dynamic DNS Daemon

This is an extremely simple daemon written in Node.js that implements Dynamic DNS using the Cloudflare API.

### What is this for?

Some of us, including myself, have a home server that needs to be accessible through the Internet. This server may host a personal website, a game server, or any number of other things.

Unfortunately, a limitation with IPv4 is that IPv4 addresses are 32 bits long, and there are not enough addresses to give every household on the planet a static public IP address. Although IPv6 was designed to rectify this, some users still cannot use IPv6.

Because of this, most ISPs will give household customers a _dynamic IP address,_ which changes periodically or every time the modem/router is rebooted. It may be possible to get a static IP address, but some ISPs may charge an extra fee or limit it only to small businesses.

This causes a problem if you try to point a domain name to your home network. It will work fine for the first little while, but your IP address will change and the website/gameserver/whatnot will go down as a result. This is what Dynamic DNS is designed to solve.

### How does this program work?

This program works by running as a system service on your home server. It will periodically check the network configuration to figure out what your current dynamic public IP address is. It will also check what IP address your domain name is pointing at, and if they're different, it will use the Cloudflare API to update the relevant DNS record.

### Setting this up

You will need **Git** and the latest version of **Nodejs** installed on the system you want to run this daemon on.

#### Step 0: Get your domain name on Cloudflare.

Because this program uses the Cloudflare API, you will need to have a Cloudflare account and add your domain name to it. **You can use the free plan.**

Follow Cloudflare's instructions to add the domain name to your account, and wait for it to become active. Once it's active, and you've created an **A** record for your domain name, we're good to go.

You'll also need an API token with the ability to edit Zone DNS records. See the Getting Started section of the [Cloudflare API docs](https://api.cloudflare.com/) for information.

#### Step 1: Get the code.

Start by cloning the repository. These instructions assume a Linux system with `systemd` as the init system, feel free to adapt it to your needs.

Run the following commands to clone the repository, install npm dependencies, and move the application to /opt/cloudflare-ddns.

```bash
# clone the repository into somewhere you have access to
cd ~
git clone https://github.com/alkalinethunder/cloudflare-ddns-daemon

# Install node dependencies
cd cloudflare-ddns-daemon/src
npm install

## Copy the source code over to /opt/cloudflare-ddns
cd ..
sudp cp -R src /opt/cloudflare-ddns
```

#### Step 2: Create a systemd daemon.

From here, you can create a launcher script that sets the necessary environment variables before running the daemon.

`/bin/cloudflare-ddns`:

```bash
#!/bin/bash
export CLOUDFLARE_API_TOKEN=<Replace this with your API token>
export CLOUDFLARE_ZONE=aklnthndr.dev # Replace this with your root domain name.
# If you are updating a subdomain, uncomment this and put the DNS record name here.
#export DNS_RECORD_NAME=sparky
node /opt/cloudflare-ddns/index.js
```

Make sure it's executable.

```bash
sudo chmod +x /bin/cloudflare-ddns
```

Now we can create a unit file, in `/etc/systemd/system/cloudflare-ddns.service`:

```ini
[Unit]
Description=Cloudflare Dynamic DNS Daemon
After=network.target auditd.service

[Service]
ExecStart=/bin/cloudflare-ddns
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Congrats! You now know how to suffer pain. But don't worry. The pain's over.

#### Step 3: Enable and start the service.

```bash
sudo systemctl enable cloudflare-ddns
sudo systemctl start cloudflare-ddns
```

All done.
