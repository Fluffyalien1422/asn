## ⚠️ Before You Update

**v3 is not compatible with v2.** Installing v3 in a world that previously ran v2 **will break that world**. Start v3 in a brand-new world.

**Bedrock Energistics Core is now required.** The standalone build has been removed. Bedrock Energistics Core must be installed alongside ASN, even if you disable energy usage.

## New

**Store anything**

- Your network can now store _any_ item.

**Reworked storage disks and drives**

- The old storage disk has been replaced by two tiers: the **Standard Storage Disk** (32 stacks) and the **High Capacity Storage Disk** (64 stacks).
- Items are now stored on the disks themselves instead of on the Storage Drive.
- The **Storage Drive** is now a container that holds up to eight disks.

**Craft from your network**

- Craft items directly from the ingredients in your network through the **Storage Interface** or **Wireless Storage Interface**.

**New devices**

- **Autocrafter** — automatically crafts items using ingredients in the storage network.
- **Disk Upgrader** — upgrades a Standard Storage Disk into a High Capacity Storage Disk.

**Rebuilt Storage Relay**

- The Storage Relay has been completely rebuilt around namespaces. Assign a relay to a namespace and it connects to every other relay in that namespace — with infinite range, across dimensions.
- You own and configure your namespaces, including a display name and an allowlist/denylist that controls who else can connect.

**Revamped UI**

- The **Storage Interface** and **Wireless Storage Interface** UIs have been redesigned.
- Various improvements to other UIs.

**Brand New Look**

- Remade all textures.

**Configuration file**

- Added a config file at `BP/scripts/__config.js` that you can edit to configure the add-on without commands. It sets the default value of every add-on rule and can lock rules so they can't be changed in-game, plus options like whether to give the Tutorial Book on spawn and the custom command namespace. See the [README](https://github.com/Fluffyalien1422/asn/blob/main/README.md) for details.

## Changes and Improvements

**Miscellaneous**

- Removed the Portable Storage Network.
- Energy usage is now enabled by default. You can still turn it off with the `useEnergy` rule.
- When `useEnergy` is enabled, every device on a network now stops working if the network runs out of energy.
- Energy consumption is now calculated from all devices, rather than only drives.
- Rewrote most of the Tutorial Book entries.
- Lots of performance improvements.

**Add-on rule changes**

- Renamed the `driveEnergyConsumption` rule to `deviceEnergyConsumption`.
- `useEnergy`, `deviceEnergyConsumption`, and `wirelessInterfaceEnergyConsumption` are no longer experimental.
- Removed the `forceLoadNetworks`, `fluidStorage`, and `showRequestItemDialog` rules.
  - `forceLoadNetworks` and `fluidStorage` are now built into the add-on and always on; they can no longer be turned off.
- New add-on rules for controlling the Storage Relay:
  - `relayMaxGlobalNamespaces` — maximum number of relay namespaces across the whole world.
  - `relayMaxPlayerNamespaces` — maximum number of namespaces a single player can own.
  - `relayMaxNamespaceNameChars` — maximum number of characters in a namespace's display name.
  - `relayMaxNamespacePlayerListCount` — maximum number of players in a namespace's allowlist or denylist.

## Fixes

- Numerous bug fixes throughout.
