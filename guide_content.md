# The Complete Home Network Starter Stack

### A Woodley Brothers Networks Field Guide

*Build a real, private, self-monitored home network — the same core stack we install for clients across Broward & Miami-Dade.*

---

## Welcome Aboard

Somewhere in your house or your RV right now, a router is quietly making decisions on your behalf. It's deciding which servers your smart TV talks to, which ad networks track your kids' tablet, and whether that "urgent security update" your smart doorbell just downloaded is legitimate — or not. Most people never think about it until something goes wrong: a bank alert for a purchase they didn't make, a laptop that starts running hot for no reason, a camera feed that turns up somewhere it shouldn't.

We're Woodley Brothers Networks — WBN, a DBA of Woodley Web Services LLC, known around South Florida as **the Good Fellas**. We build and monitor home and RV networks for a living, starting with full-time travelers who need a network that's as mobile and self-sufficient as they are, and now for homeowners, renters, and small businesses across Broward and Miami-Dade who want the same thing: a network that actually protects them instead of just connecting them.

This guide is the real deal, not a teaser. It walks you through building the exact foundational stack we use on every install — Pi-hole, Unbound, Tailscale, Portainer, Uptime Kuma, chrony, and Vaultwarden, all running on a single Raspberry Pi. If you're handy, patient, and willing to follow instructions carefully, you can build this yourself, today, for the cost of the hardware. If you'd rather have someone who does this for a living handle it, configure it correctly the first time, and keep an eye on it going forward — that's what we're here for.

Either way, you'll walk away from this document with a genuinely more secure, more private, more observable home network. That's the whole point.

---

## Part 1: Why DNS-Level Filtering Is the Foundation, Not an Add-On

Every device on your network — your phone, your smart plugs, your kid's game console, your router's own firmware — starts nearly everything it does with a DNS lookup: "where do I find this server?" That single moment, before any connection is even made, is the cheapest and most effective place to intervene.

**Pi-hole** sits between your devices and the internet and answers those lookups itself. When a smart TV tries to phone home to an ad-tracking domain, or a compromised IoT device tries to reach a known malware command-and-control server, Pi-hole simply refuses to resolve the address. No app to install on every device, no per-device configuration — one change at the router level protects everything that connects, including devices that have no security settings of their own (looking at you, smart plugs and cheap cameras).

But Pi-hole is only as trustworthy as the DNS server it forwards to. If you point it at a public resolver, you've just handed your entire household's browsing history to that company. That's where **Unbound** comes in: it turns your Pi into its own recursive, validating DNS resolver, talking directly to the authoritative root servers instead of a third party. Combined, Pi-hole plus Unbound means:

- Ad and tracker domains get blocked network-wide, automatically.
- Known malicious and phishing domains never resolve — which matters, because phishing is still the single most-reported cybercrime type in America, and it usually starts with a network that didn't stop it. [FBI IC3 2025]
- Nobody outside your house — not your ISP, not a public DNS provider — sees a running log of every domain your household visits.
- You get a live dashboard showing exactly what's trying to talk to the outside world and how often. This alone is often the moment people realize how "flat" and unmonitored their old setup really was.

DNS filtering is not a silver bullet, and we'll be straight with you about that in Part 3. But it is the highest-leverage single thing you can do to a home network, and it's the right place to start.

---

## Part 2: The Build — One Raspberry Pi, Six Services, A Real Foundation

This is the exact stack we deploy. It's built to run 24/7 on minimal power, survive reboots and power outages cleanly, and give you both protection and visibility — without needing a server closet.

### What You'll Need

- **Raspberry Pi 4 (4GB or 8GB RAM) or Raspberry Pi 5** — the 5 is faster and worth it if you're buying new.
- **A USB SSD, not a microSD card**, 128GB or larger. This is not optional. MicroSD cards wear out fast under the constant small writes that logging and databases produce; an SSD will run for years. Boot the Pi entirely from the SSD — no SD card involved at all.
- A reliable 5V/3A (Pi 4) or official Pi 5 power supply.
- A wired Ethernet connection from the Pi to your router. Don't run this stack over Wi-Fi.
- A laptop or desktop on the same network for setup.
- (Optional but recommended) A small UPS or battery pack so a brief power blip doesn't take your DNS offline.

*Note: WBN doesn't sell hardware. We maintain an Amazon storefront with the exact parts we use and trust, and we may earn a small affiliate commission on those links — the price to you doesn't change either way. Buy what you're comfortable with; the instructions below work on any Pi 4/8GB or Pi 5 with a USB SSD.*

### Step 1 — Flash the OS to the SSD, Not the SD Card

Download the Raspberry Pi Imager from the official Raspberry Pi website. Connect your USB SSD directly to your computer (not through the Pi yet). In the Imager, choose **Raspberry Pi OS Lite (64-bit)** — you don't need a desktop environment for a server. Under storage, select your USB SSD, **not** an SD card slot. Before writing, use the gear/settings icon to pre-configure a hostname, enable SSH, and set a username and password. Write the image.

If your Pi 4 hasn't been updated recently, you may need to first boot once from an SD card to update its bootloader/EEPROM to support USB boot, then switch permanently to the SSD. Pi 5 boots from USB out of the box with current firmware. Once the SSD is flashed, connect it to the Pi, connect Ethernet, apply power, and give it a couple of minutes to boot.

### Step 2 — Find It and Get In

From your laptop, find the Pi's IP address (check your router's connected-devices list, or use the hostname you set, e.g., `ssh yourhostname.local`). Connect over SSH using the username and password you set during imaging. Run:

```
sudo apt update && sudo apt full-upgrade -y
sudo reboot
```

Give it a minute to come back up, then reconnect.

### Step 3 — Install Docker and Portainer

Docker lets each of these services run in its own isolated, easy-to-update container instead of being installed loose on the OS — this is the difference between a stack you can maintain confidently and a fragile pile of manual installs. Install it with the official convenience script:

```
curl -sSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in for the group change to apply. Then launch **Portainer**, a web dashboard for managing every container visually instead of memorizing Docker commands:

```
docker volume create portainer_data
docker run -d -p 9443:9443 --name=portainer --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data portainer/portainer-ce:latest
```

Visit `https://<your-pi-ip>:9443` in a browser, create your admin account, and you now have a control panel for everything that follows. From here on, you can deploy each service either by continuing on the command line or by pasting Docker Compose files directly into Portainer's Stacks section — Portainer will happily do the rest.

### Step 4 — Deploy Pi-hole + Unbound

Deploy Pi-hole as a container (the official `pihole/pihole` image), giving it a static local IP and mapping ports 53 (DNS) and 80/443 (web admin). Set Unbound up as a second lightweight container acting purely as a recursive resolver on port 5335, then point Pi-hole's upstream DNS at `127.0.0.1#5335` (or the Unbound container's address) instead of a public DNS provider. Once it's running, log into the Pi-hole admin page, note your admin password, and finally go into your **router's DHCP settings** and set the Pi's IP as the DNS server every device on your network receives. This last step is what makes the filtering apply network-wide instead of just to the Pi itself.

### Step 5 — Add Tailscale for Secure Remote Access

**Tailscale** creates a private, encrypted mesh network between your devices — so you can reach your Pi-hole dashboard, your files, or your other services from anywhere, without opening a single port on your router to the public internet (which is one of the most common ways home networks get compromised in the first place). Install it directly on the Pi OS (not in a container, for simplicity):

```
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Follow the printed link to authenticate, and install the Tailscale app on your phone and laptop too. Now your whole stack is reachable securely from your phone at the gas station, your laptop at a coffee shop, or the RV three states away — nothing exposed to the open internet.

### Step 6 — Add Uptime Kuma for Monitoring

**Uptime Kuma** is a self-hosted status dashboard that watches your services and tells you the moment one goes down — Pi-hole stops responding, your internet drops, a container crashes. Deploy it as a container, map it to a port like 3001, and add monitors for your Pi-hole, your router, and your internet gateway. Set up a notification method (email, Telegram, Discord — Kuma supports dozens) so you find out about a problem before your whole household does.

### Step 7 — Add chrony for Accurate Time

Sounds boring, matters enormously: DNS validation (via Unbound/DNSSEC), Tailscale, and Vaultwarden all depend on your Pi's clock being accurate. Install **chrony**, a lightweight, more reliable alternative to the default NTP setup:

```
sudo apt install chrony -y
sudo systemctl enable chrony --now
```

### Step 8 — Add Vaultwarden for Your Own Password Manager

Given that 66% of people reuse passwords across accounts [Enzoic/Security.org], a password manager isn't optional gear anymore — it's baseline hygiene. **Vaultwarden** is a lightweight, self-hosted server compatible with the Bitwarden apps, so you get a real password manager with browser extensions and mobile apps, but the vault lives on your Pi, under your control, not a third-party's cloud. Deploy it as a container, give it persistent storage for its database, and access it securely over your new Tailscale network — no need to expose it publicly at all.

### Step 9 — Reboot and Verify

Reboot the whole Pi one more time and confirm every piece survives a cold start: Pi-hole resolving queries, Unbound feeding it, Tailscale reconnecting automatically, Uptime Kuma showing everything green, Vaultwarden reachable over Tailscale. If it all comes back cleanly, you're done — you now have a self-hosted, self-monitoring, privacy-respecting foundation running 24/7 for a few watts of power.

---

## Part 3: What This Guide Doesn't Cover — On Purpose

We built this guide to be genuinely complete for what it promises: a working, protective DNS and monitoring foundation. But a foundation is not a finished house, and we'd be lying to you if we implied otherwise. Here's what a single Pi running these six services will *not* do, and why it's the next tier of work:

- **VLAN segmentation.** Right now, if a single smart plug or camera on your network gets compromised, it likely sits on the same flat network as your laptop and banking apps — nothing in between them. Most home networks are built this way. [general fact] Properly segmenting IoT devices, guests, and trusted devices onto separate VLANs is what actually contains a breach instead of just detecting it after the fact.
- **Suricata IDS/IPS.** Pi-hole blocks known-bad DNS destinations, but it can't see or stop malicious traffic that isn't a DNS lookup — a network intrusion detection/prevention system inspects actual traffic patterns in real time.
- **Frigate NVR.** Camera systems deserve local, private AI-assisted recording and object detection instead of shipping your footage to a random cloud vendor.
- **Managed monitoring.** Uptime Kuma tells you *that* something broke. Having a team who's already watching, and who responds when it does, is a different service entirely.
- **A local LLM security assistant.** Making sense of logs and alerts in plain English, on hardware you control, is a newer capability we're actively rolling into premium builds.

None of that is a scare tactic — it's simply the honest next step for people who want more than a strong foundation. If that's you, we build all of it, correctly, on-site.

---

## Your Next Move

You've now got the real instructions for the exact core stack we install professionally. If you follow it carefully, you'll end up with a network that filters what it should, monitors itself, and gives you secure remote access and your own password vault — a genuinely better setup than the vast majority of homes and RVs on the road today.

From here, you've got two good paths:

**Book a build.** If you'd rather have this configured correctly the first time — hardware matched to your setup, DNS tuned for your household, monitoring alerts actually going to a phone that gets checked — the Good Fellas handle installs across Broward and Miami-Dade, and remotely for RV owners on the move. Get a quote at woodleybrothersnetworks.com.

**Go premium.** If you want to keep building it yourself but go further — VLAN segmentation, IDS/IPS, camera NVR, and the deeper configuration details we couldn't fit into a free guide — our expanded premium guide is available for a small one-time price. Get the premium guide at woodleybrothersnetworks.com.

Either way, don't leave the network running the way it was when you started reading this. The tools exist, they're not expensive, and now you know exactly how they fit together.

---

## Appendix: The Numbers Behind Why This Matters

- Reported cybercrime losses hit a record **$21 billion in 2025**, up 26% year-over-year, across the highest number of complaints the FBI has ever logged — over 1 million. [FBI IC3 2025]
- **Phishing and spoofing remain the most-reported crime type**, at 19% of all complaints — and it usually starts through an unprotected home network. [FBI IC3 2025]
- Someone becomes a victim of identity theft in the U.S. **every 4.9 seconds**. [Security.org]
- About **6 million Americans** have their identity stolen every year; **22%** will experience it at some point in their lifetime. [Security.org]
- The average U.S. home now runs **17–21 connected smart devices** — more than double 2020 levels. [BroadbandSearch]
- The typical smart home faces **29 cyberattack attempts a day**. [StationX/Bitdefender-Netgear]
- **35% of consumer IoT devices** ship with default passwords enabled; **17%** have hardcoded credentials that can't even be changed. [StationX]
- Home routers are now the **#1 riskiest device** on any network, averaging **32 known vulnerabilities each**. [Modemguides/Forescout]
- An unprotected device exposed online gets probed roughly **70 times a minute** — over **100,000 times a day**. [Comparitech]
- **66% of Americans reuse passwords** across accounts, and **94% of breached passwords** are duplicates seen before. [Enzoic/Security.org]

---

*Woodley Brothers Networks (WBN) is a DBA of Woodley Web Services LLC, serving RV owners, homeowners, renters, and small businesses across Broward and Miami-Dade, Florida.*
