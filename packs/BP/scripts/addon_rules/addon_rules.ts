import { Player, world } from "@minecraft/server";
import { AddonRuleCommand } from "./set_addon_rule";
import { DynamicPropertyAccessor } from "../utils/dynamic_property_v3";

export const wirelessInterfaceRangeRule = new DynamicPropertyAccessor<
  number,
  number
>("fluffyalien_asn:rule_wireless_intf_range", 500);

export const useEnergyRule = new DynamicPropertyAccessor<boolean, boolean>(
  "fluffyalien_asn:rule_use_energy",
  true,
);

export const deviceEnergyConsumptionRule = new DynamicPropertyAccessor<
  number,
  number
>("fluffyalien_asn:rule_device_energy", 10);

export const wirelessInterfaceEnergyConsumptionRule =
  new DynamicPropertyAccessor<number, number>(
    "fluffyalien_asn:rule_wireless_intf_energy",
    10,
  );

export const relayMaxGlobalNamespacesRule = new DynamicPropertyAccessor<
  number,
  number
>("fluffyalien_asn:rule_relay_max_global_ns", 128);

export const relayMaxPlayerNamespacesRule = new DynamicPropertyAccessor<
  number,
  number
>("fluffyalien_asn:rule_relay_max_player_ns", 16);

export const relayMaxNamespaceNameCharsRule = new DynamicPropertyAccessor<
  number,
  number
>("fluffyalien_asn:rule_relay_max_ns_name_chars", 32);

export const relayMaxNamespacePlayerListCountRule = new DynamicPropertyAccessor<
  number,
  number
>("fluffyalien_asn:rule_relay_max_ns_player_list_count", 8);

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
  if (value === defaultValue || useEnergyRule.safeGet(world)) return value;

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
