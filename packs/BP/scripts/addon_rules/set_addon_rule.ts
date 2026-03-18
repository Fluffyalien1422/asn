import { Player, world } from "@minecraft/server";
import { ADDON_RULE_COMMANDS } from "./addon_rules";
import { DynamicPropertyAccessor } from "../utils/dynamic_property";
import { sendCurrentRuleValueMessage } from "./addon_rules_common";

interface BaseAddonRuleCommand<T> {
  deprecated?: boolean;
  experimental?: boolean;
  beforeSet?: (player: Player | undefined, value: T) => T | undefined;
}

interface BoolAddonRuleCommand extends BaseAddonRuleCommand<boolean> {
  type: "bool";
  property: DynamicPropertyAccessor<boolean, boolean>;
}

interface NumberAddonRuleCommand extends BaseAddonRuleCommand<number> {
  type: "float" | "int";
  property: DynamicPropertyAccessor<number, number>;
}

export type AddonRuleCommand = BoolAddonRuleCommand | NumberAddonRuleCommand;

function processBoolAddonRuleCommand(
  player: Player | undefined,
  rawValue: string,
  ruleCommand: BoolAddonRuleCommand,
): boolean {
  if (rawValue === "true") {
    ruleCommand.property.set(
      world,
      ruleCommand.beforeSet?.(player, true) ?? true,
    );
    return true;
  }

  if (rawValue === "false") {
    ruleCommand.property.set(
      world,
      ruleCommand.beforeSet?.(player, false) ?? false,
    );
    return true;
  }

  player?.sendMessage({
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
  player: Player | undefined,
  rawValue: string,
  ruleCommand: NumberAddonRuleCommand,
): boolean {
  const numVal = Number(rawValue);

  if (isNaN(numVal)) {
    player?.sendMessage({
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
    player?.sendMessage({
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

  ruleCommand.property.set(
    world,
    ruleCommand.beforeSet?.(player, numVal) ?? numVal,
  );

  return true;
}

export function processAddonRuleCommand(
  player: Player | undefined,
  rule: string,
  value?: string | null,
): boolean {
  if (rule === "help") {
    player?.sendMessage({
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
    return true;
  }

  if (!(rule in ADDON_RULE_COMMANDS)) {
    player?.sendMessage({
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
    return false;
  }

  const ruleCommand = ADDON_RULE_COMMANDS[rule];

  if (!value) {
    if (value === null) ruleCommand.property.set(world);
    if (player) sendCurrentRuleValueMessage(player, rule, ruleCommand);
    return true;
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
    return false;
  }

  if (player) sendCurrentRuleValueMessage(player, rule, ruleCommand);

  if (ruleCommand.deprecated) {
    player?.sendMessage({
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
    player?.sendMessage({
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

  return true;
}

export function resetAllAddonRules(): void {
  for (const ruleCommand of Object.values(ADDON_RULE_COMMANDS)) {
    ruleCommand.property.set(world);
  }
}
