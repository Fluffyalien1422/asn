import { Player, world } from "@minecraft/server";
import { AddonRuleCommand } from "./set_addon_rule";
import { DynamicPropertyAccessor } from "./utils/dynamic_property";
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
  DynamicPropertyAccessor.withDefault<number>("driveEnergyConsumptionRule", 50);

export const wirelessInterfaceEnergyConsumptionRule =
  DynamicPropertyAccessor.withDefault<number>(
    "wirelessInterfaceEnergyConsumptionRule",
    10,
  );

export const fluidStorageExperimentRule =
  DynamicPropertyAccessor.withDefault<boolean>(
    "fluidStorageExperimentRule",
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
    onSet: setRequiresBecWarning,
  },
  driveEnergyConsumption: {
    type: "int",
    property: driveEnergyConsumptionRule,
    experimental: true,
    onSet: setRequiresUseEnergyWarning,
  },
  wirelessInterfaceEnergyConsumption: {
    type: "int",
    property: wirelessInterfaceEnergyConsumptionRule,
    experimental: true,
    onSet: setRequiresUseEnergyWarning,
  },
  fluidStorageExperiment: {
    type: "bool",
    property: fluidStorageExperimentRule,
    experimental: true,
    onSet: setRequiresBecWarning,
  },
};

function setRequiresBecWarning(player: Player): void {
  if (isBedrockEnergisticsCoreInWorld()) return;
  player.sendMessage({
    rawtext: [
      {
        text: "§c",
      },
      {
        translate:
          "fluffyalien_asn.message.scriptEvent.addonRule.requiresBecWarning",
      },
    ],
  });
}

function setRequiresUseEnergyWarning(player: Player): void {
  if (useEnergyRule.get(world)) return;
  player.sendMessage({
    rawtext: [
      {
        text: "§c",
      },
      {
        translate:
          "fluffyalien_asn.message.scriptEvent.addonRule.requiresRuleWarning",
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
}
