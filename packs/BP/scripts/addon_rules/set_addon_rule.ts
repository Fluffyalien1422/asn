import { Player } from "@minecraft/server";
import { ADDON_RULE_COMMANDS } from "./addon_rules";
import { sendCurrentRuleValueMessage } from "./addon_rules_common";
import { logWarn } from "../log";
import { RuleAccessor } from "./accessor";

interface BaseAddonRuleCommand<T> {
  deprecated?: boolean;
  experimental?: boolean;
  beforeSet?: (player: Player | undefined, value: T) => T | undefined;
}

interface BoolAddonRuleCommand extends BaseAddonRuleCommand<boolean> {
  type: "bool";
  property: RuleAccessor<boolean>;
}

interface NumberAddonRuleCommand extends BaseAddonRuleCommand<number> {
  type: "float" | "int";
  property: RuleAccessor<number>;
}

export type AddonRuleCommand = BoolAddonRuleCommand | NumberAddonRuleCommand;

function processBoolAddonRuleCommand(
  player: Player | undefined,
  rawValue: string,
  ruleCommand: BoolAddonRuleCommand,
): boolean {
  if (rawValue === "true") {
    ruleCommand.property
      .setRule(ruleCommand.beforeSet?.(player, true) ?? true)
      .mapErr((e) => {
        logWarn(`Failed to set add-on rule: ${e}`);
      });
    return true;
  }

  if (rawValue === "false") {
    ruleCommand.property
      .setRule(ruleCommand.beforeSet?.(player, false) ?? false)
      .mapErr((e) => {
        logWarn(`Failed to set add-on rule: ${e}`);
      });
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

  ruleCommand.property
    .setRule(ruleCommand.beforeSet?.(player, numVal) ?? numVal)
    .mapErr((e) => {
      logWarn(`Failed to set add-on rule: ${e}`);
    });

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

  // Reading a rule's value is always allowed, but changing it (setting a new
  // value, or resetting it with null) is rejected when the rule is locked.
  const isChangingRule = value === null || !!value;
  if (isChangingRule && ruleCommand.property.isLocked) {
    player?.sendMessage({
      rawtext: [
        {
          text: "§c",
        },
        {
          translate: "fluffyalien_asn.message.scriptEvent.addonRule.locked",
        },
      ],
    });
    return false;
  }

  if (!value) {
    if (value === null)
      ruleCommand.property.setRule().mapErr((e) => {
        logWarn(`Failed to set add-on rule: ${e}`);
      });
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
    if (ruleCommand.property.isLocked) continue;
    ruleCommand.property.setRule().mapErr((e) => {
      logWarn(`Failed to set add-on rule: ${e}`);
    });
  }
}
