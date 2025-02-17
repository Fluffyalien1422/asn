import { Player, world } from "@minecraft/server";
import {
  driveEnergyConsumptionRule,
  fluidStorageExperimentRule,
  forceLoadNetworksRule,
  showRequestItemDialogRule,
  useEnergyRule,
  wirelessInterfaceEnergyConsumptionRule,
  wirelessInterfaceRangeRule,
} from "./addon_rules";
import { DynamicPropertyAccessor } from "./utils/dynamic_property";

interface BaseAddonRuleCommand {
  deprecated?: boolean;
  experimental?: boolean;
}

interface BoolAddonRuleCommand extends BaseAddonRuleCommand {
  type: "bool";
  property: DynamicPropertyAccessor<boolean, boolean>;
}

interface NumberAddonRuleCommand extends BaseAddonRuleCommand {
  type: "float" | "int";
  property: DynamicPropertyAccessor<number, number>;
}

type AddonRuleCommand = BoolAddonRuleCommand | NumberAddonRuleCommand;

const ADDON_RULE_COMMANDS: Record<string, AddonRuleCommand> = {
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
  },
  driveEnergyConsumption: {
    type: "int",
    property: driveEnergyConsumptionRule,
    experimental: true,
  },
  wirelessInterfaceEnergyConsumption: {
    type: "int",
    property: wirelessInterfaceEnergyConsumptionRule,
    experimental: true,
  },
  fluidStorageExperiment: {
    type: "bool",
    property: fluidStorageExperimentRule,
    experimental: true,
  },
};

function processBoolAddonRuleCommand(
  player: Player,
  rawValue: string,
  ruleCommand: BoolAddonRuleCommand,
): boolean {
  if (rawValue === "true") {
    ruleCommand.property.set(world, true);
    return true;
  }

  if (rawValue === "false") {
    ruleCommand.property.set(world, false);
    return true;
  }

  player.sendMessage({
    rawtext: [
      {
        text: "§c",
      },
      {
        translate:
          "fluffyalien_asn.message.scriptEvent.addonRule.expectedBoolean",
      },
    ],
  });

  return false;
}

function processNumberAddonRuleCommand(
  player: Player,
  rawValue: string,
  ruleCommand: NumberAddonRuleCommand,
): boolean {
  const numVal = Number(rawValue);

  if (isNaN(numVal)) {
    player.sendMessage({
      rawtext: [
        {
          text: "§c",
        },
        {
          translate:
            "fluffyalien_asn.message.scriptEvent.addonRule.expectedNumber",
        },
      ],
    });

    return false;
  }

  if (ruleCommand.type === "int" && !Number.isInteger(numVal)) {
    player.sendMessage({
      rawtext: [
        {
          text: "§c",
        },
        {
          translate:
            "fluffyalien_asn.message.scriptEvent.addonRule.expectedInt",
        },
      ],
    });

    return false;
  }

  ruleCommand.property.set(world, numVal);

  return true;
}

function sendCurrentRuleValue(
  player: Player,
  rule: string,
  ruleCommand: AddonRuleCommand,
): void {
  player.sendMessage(
    `§s${rule}§r = §p${ruleCommand.property.get(world).toString()}`,
  );
}

export function processAddonRuleCommand(player: Player, message: string): void {
  const args = message.split(" ");

  const rule = args[0];
  const value = args[1];

  if (rule === "help") {
    player.sendMessage({
      rawtext: [
        {
          text: "§a-- Add-On Rules -- §r\n",
        },
        ...Object.entries(ADDON_RULE_COMMANDS).flatMap(([key, options]) => [
          {
            text: `§s${key}§r: §u${options.type} §5(default: §p${options.property.defaultValue.toString()}§5)§r${options.deprecated ? " §c(deprecated)§r" : ""}${options.experimental ? " §c(experimental)§r" : ""} - `,
          },
          {
            translate: `fluffyalien_asn.message.scriptEvent.addonRule.help.${key}`,
          },
          {
            text: "\n§a-- --§r\n",
          },
        ]),
      ],
    });

    return;
  }

  if (!(rule in ADDON_RULE_COMMANDS)) {
    player.sendMessage({
      rawtext: [
        {
          text: "§c",
        },
        {
          translate:
            "fluffyalien_asn.message.scriptEvent.addonRule.invalidRule",
        },
      ],
    });
    return;
  }

  const ruleCommand = ADDON_RULE_COMMANDS[rule];

  if (!value) {
    sendCurrentRuleValue(player, rule, ruleCommand);
    return;
  }

  let success = false;

  switch (ruleCommand.type) {
    case "bool":
      success = processBoolAddonRuleCommand(player, value, ruleCommand);
      break;
    case "float":
    case "int":
      success = processNumberAddonRuleCommand(player, value, ruleCommand);
      break;
  }

  if (!success) {
    return;
  }

  sendCurrentRuleValue(player, rule, ruleCommand);

  if (ruleCommand.deprecated) {
    player.sendMessage({
      rawtext: [
        {
          text: "§c",
        },
        {
          translate:
            "fluffyalien_asn.message.scriptEvent.addonRule.deprecatedWarning",
        },
      ],
    });
  }

  if (ruleCommand.experimental) {
    player.sendMessage({
      rawtext: [
        {
          text: "§c",
        },
        {
          translate:
            "fluffyalien_asn.message.scriptEvent.addonRule.experimentalWarning",
        },
      ],
    });
  }
}
