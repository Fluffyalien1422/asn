// Advanced Storage Network configuration.

// Edit the values below to configure the add-on.

// Every option is optional: remove any you don't want to change and its
// default is used. If an option is missing or set to the wrong type, the
// default is used and a warning is logged to the content log.

export default {
  // Give players the tutorial book the first time they spawn into a world.
  giveTutorialBookOnSpawn: true,

  // Namespace for this add-on's custom commands. For example, 'fluffyalien_asn'
  // makes the command '/fluffyalien_asn:asnrule'. This is intended to be used when
  // bundling in a modpack, as a single add-on cannot have multiple custom command
  // namespaces.
  customCommandNamespace: "fluffyalien_asn",

  // Add-on rules. Each rule is an object with two options:
  // default - the value used until the rule is changed in-game.
  // lock    - when true, the rule is fixed at its default and players can no
  //           longer change it with the '/asnrule' command.
  rules: {
    // The maximum distance (in blocks) a wireless transmitter may be from a
    // player for them to use a wireless interface. Set to -1 to disable range
    // and dimension checking.
    wirelessInterfaceRange: {
      default: 500,
      lock: false,
    },
    // Make storage networks require energy to operate.
    useEnergy: {
      default: true,
      lock: false,
    },
    // The amount of energy each device in the network consumes (every 10
    // ticks). Ignored when 'useEnergy' is false.
    deviceEnergyConsumption: {
      default: 10,
      lock: false,
    },
    // The amount of energy a wireless interface consumes each time it is used.
    // Ignored when 'useEnergy' is false.
    wirelessInterfaceEnergyConsumption: {
      default: 10,
      lock: false,
    },
    // The maximum number of relay namespaces that can exist across the whole
    // world. Note that there is a hard 32,000 char data cap that applies no
    // matter how the maximum limits are configured.
    relayMaxGlobalNamespaces: {
      default: 128,
      lock: false,
    },
    // The maximum number of relay namespaces a single player can own. Note
    // that there is a hard 32,000 char data cap that applies no matter how
    // the maximum limits are configured.
    relayMaxPlayerNamespaces: {
      default: 16,
      lock: false,
    },
    // The maximum number of characters in a relay namespace's display name.
    // Note that there is a hard 32,000 char data cap that applies no matter
    // how the maximum limits are configured.
    relayMaxNamespaceNameChars: {
      default: 32,
      lock: false,
    },
    // The maximum number of players in a relay namespace's allowlist or
    // denylist. Note that there is a hard 32,000 char data cap that applies
    // no matter how the maximum limits are configured.
    relayMaxNamespacePlayerListCount: {
      default: 8,
      lock: false,
    },
  },
};
