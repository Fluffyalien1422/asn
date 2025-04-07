import { Player, world } from "@minecraft/server";
import { AddonRuleCommand } from "./set_addon_rule";
import { DynamicPropertyAccessor } from "../utils/dynamic_property";
import { isBedrockEnergisticsCoreInWorld } from "bedrock-energistics-core-api";

export const forceLoadNetworksRule =
  DynamicPropertyAccessor.withDefault<boolean>(
    "fluffyalien_asn:rule_force_load_networks",
    true,
  );

export const useEnergyRule = DynamicPropertyAccessor.withDefault<boolean>(
  "fluffyalien_asn:rule_use_energy",
  false,
);

export const showRequestItemDialogRule =
  DynamicPropertyAccessor.withDefault<boolean>(
    "fluffyalien_asn:rule_show_request_item_dialog",
    false,
  );

export const wirelessInterfaceRangeRule =
  DynamicPropertyAccessor.withDefault<number>(
    "fluffyalien_asn:rule_wireless_interface_range",
    500,
  );

export const driveEnergyConsumptionRule =
  DynamicPropertyAccessor.withDefault<number>("driveEnergyConsumptionRule", 10);

export const wirelessInterfaceEnergyConsumptionRule =
  DynamicPropertyAccessor.withDefault<number>(
    "wirelessInterfaceEnergyConsumptionRule",
    10,
  );

export const fluidStorageRule = DynamicPropertyAccessor.withDefault<boolean>(
  "fluidStorageRule",
  false,
);

export const ADDON_RULE_COMMANDS: Record<string, AddonRuleCommand> = {
  forceLoadNetworks: {
    type: "bool",
    property: forceLoadNetworksRule,
  },
  showRequestItemDialog: {
    type: "bool",
    property: showRequestItemDialogRule,
  },
  wirelessInterfaceRange: {
    type: "int",
    property: wirelessInterfaceRangeRule,
  },
  useEnergy: {
    type: "bool",
    property: useEnergyRule,
    experimental: true,
    beforeSet: (player, value) =>
      requireBec(useEnergyRule.defaultValue, player, value),
  },
  driveEnergyConsumption: {
    type: "int",
    property: driveEnergyConsumptionRule,
    experimental: true,
    beforeSet: (player, value) =>
      requireUseEnergy(driveEnergyConsumptionRule.defaultValue, player, value),
  },
  wirelessInterfaceEnergyConsumption: {
    type: "int",
    property: wirelessInterfaceEnergyConsumptionRule,
    experimental: true,
    beforeSet: (player, value) =>
      requireUseEnergy(
        wirelessInterfaceEnergyConsumptionRule.defaultValue,
        player,
        value,
      ),
  },
  fluidStorage: {
    type: "bool",
    property: fluidStorageRule,
    experimental: true,
    beforeSet: (player, value) =>
      requireBec(fluidStorageRule.defaultValue, player, value),
  },
};

function requireBec<T>(defaultValue: T, player: Player, value: T): T {
  if (value === defaultValue || isBedrockEnergisticsCoreInWorld()) return value;

  player.sendMessage({
    rawtext: [
      {
        text: "§c",
      },
      {
        translate: "fluffyalien_asn.message.scriptEvent.addonRule.requiresBec",
      },
    ],
  });

  return defaultValue;
}

function requireUseEnergy<T>(defaultValue: T, player: Player, value: T): T {
  if (value === defaultValue || useEnergyRule.get(world)) return value;

  player.sendMessage({
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
