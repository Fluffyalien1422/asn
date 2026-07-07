import { Player } from "@minecraft/server";
import { AddonRuleCommand } from "./set_addon_rule";
import { CONFIG } from "../config_manager";
import { RuleAccessor } from "./accessor";

export const wirelessInterfaceRangeRule = new RuleAccessor<number>(
  "fluffyalien_asn:rule_wireless_intf_range",
  CONFIG.rules.wirelessInterfaceRange.default,
  CONFIG.rules.wirelessInterfaceRange.lock,
);

export const useEnergyRule = new RuleAccessor<boolean>(
  "fluffyalien_asn:rule_use_energy",
  CONFIG.rules.useEnergy.default,
  CONFIG.rules.useEnergy.lock,
);

export const deviceEnergyConsumptionRule = new RuleAccessor<number>(
  "fluffyalien_asn:rule_device_energy",
  CONFIG.rules.deviceEnergyConsumption.default,
  CONFIG.rules.deviceEnergyConsumption.lock,
);

export const wirelessInterfaceEnergyConsumptionRule = new RuleAccessor<number>(
  "fluffyalien_asn:rule_wireless_intf_energy",
  CONFIG.rules.wirelessInterfaceEnergyConsumption.default,
  CONFIG.rules.wirelessInterfaceEnergyConsumption.lock,
);

export const relayMaxGlobalNamespacesRule = new RuleAccessor<number>(
  "fluffyalien_asn:rule_relay_max_global_ns",
  CONFIG.rules.relayMaxGlobalNamespaces.default,
  CONFIG.rules.relayMaxGlobalNamespaces.lock,
);

export const relayMaxPlayerNamespacesRule = new RuleAccessor<number>(
  "fluffyalien_asn:rule_relay_max_player_ns",
  CONFIG.rules.relayMaxPlayerNamespaces.default,
  CONFIG.rules.relayMaxPlayerNamespaces.lock,
);

export const relayMaxNamespaceNameCharsRule = new RuleAccessor<number>(
  "fluffyalien_asn:rule_relay_max_ns_name_chars",
  CONFIG.rules.relayMaxNamespaceNameChars.default,
  CONFIG.rules.relayMaxNamespaceNameChars.lock,
);

export const relayMaxNamespacePlayerListCountRule = new RuleAccessor<number>(
  "fluffyalien_asn:rule_relay_max_ns_player_list_count",
  CONFIG.rules.relayMaxNamespacePlayerListCount.default,
  CONFIG.rules.relayMaxNamespacePlayerListCount.lock,
);

export const ADDON_RULE_COMMANDS: Record<string, AddonRuleCommand> = {
  wirelessInterfaceRange: {
    type: "int",
    property: wirelessInterfaceRangeRule,
  },
  useEnergy: {
    type: "bool",
    property: useEnergyRule,
  },
  deviceEnergyConsumption: {
    type: "int",
    property: deviceEnergyConsumptionRule,
    beforeSet: (player, value) =>
      requireUseEnergy(deviceEnergyConsumptionRule.defaultValue, player, value),
  },
  wirelessInterfaceEnergyConsumption: {
    type: "int",
    property: wirelessInterfaceEnergyConsumptionRule,
    beforeSet: (player, value) =>
      requireUseEnergy(
        wirelessInterfaceEnergyConsumptionRule.defaultValue,
        player,
        value,
      ),
  },
  relayMaxGlobalNamespaces: {
    type: "int",
    property: relayMaxGlobalNamespacesRule,
  },
  relayMaxPlayerNamespaces: {
    type: "int",
    property: relayMaxPlayerNamespacesRule,
  },
  relayMaxNamespaceNameChars: {
    type: "int",
    property: relayMaxNamespaceNameCharsRule,
  },
  relayMaxNamespacePlayerListCount: {
    type: "int",
    property: relayMaxNamespacePlayerListCountRule,
  },
};

function requireUseEnergy<T>(
  defaultValue: T,
  player: Player | undefined,
  value: T,
): T {
  if (value === defaultValue || useEnergyRule.safeGet()) return value;

  player?.sendMessage({
    rawtext: [
      {
        text: "§c",
      },
      {
        translate:
          "fluffyalien_asn.message.scriptEvent.addonRule.requiresPrerequisiteRule",
        with: {
          rawtext: [
            {
              text: "useEnergy",
            },
            {
              text: "true",
            },
            {
              text: "false",
            },
          ],
        },
      },
    ],
  });

  return defaultValue;
}
