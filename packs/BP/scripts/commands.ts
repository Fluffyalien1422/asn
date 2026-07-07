import {
  system,
  Player,
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
} from "@minecraft/server";
import {
  processAddonRuleCommand,
  resetAllAddonRules,
} from "./addon_rules/set_addon_rule";
import { ADDON_RULE_COMMANDS } from "./addon_rules/addon_rules";
import { CONFIG } from "./config_manager";

system.beforeEvents.startup.subscribe((e) => {
  const ns = CONFIG.customCommandNamespace;

  e.customCommandRegistry.registerEnum(`${ns}:AsnRuleIdOrHelp`, [
    "help",
    ...Object.keys(ADDON_RULE_COMMANDS),
  ]);
  e.customCommandRegistry.registerEnum(`${ns}:AsnRuleIdOrAll`, [
    "all",
    ...Object.keys(ADDON_RULE_COMMANDS),
  ]);

  e.customCommandRegistry.registerCommand(
    {
      name: `${ns}:asnrule`,
      description: "Read or set an ASN add-on rule.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [
        {
          name: `${ns}:AsnRuleIdOrHelp`,
          type: CustomCommandParamType.Enum,
        },
      ],
      optionalParameters: [
        {
          name: "value",
          type: CustomCommandParamType.String,
        },
      ],
    },
    (origin, ruleId: string, value?: string) => {
      const success = processAddonRuleCommand(
        origin.sourceEntity?.typeId === "minecraft:player"
          ? (origin.sourceEntity as Player)
          : undefined,
        ruleId,
        value,
      );

      return {
        status: success
          ? CustomCommandStatus.Success
          : CustomCommandStatus.Failure,
      };
    },
  );

  e.customCommandRegistry.registerCommand(
    {
      name: `${ns}:asnrulereset`,
      description: "Reset an ASN add-on rule.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [
        {
          name: `${ns}:AsnRuleIdOrAll`,
          type: CustomCommandParamType.Enum,
        },
      ],
    },
    (origin, ruleId: string) => {
      if (ruleId === "all") {
        resetAllAddonRules();
        return {
          status: CustomCommandStatus.Success,
          message: "Reset all add-on rules.",
        };
      }

      const success = processAddonRuleCommand(
        origin.sourceEntity?.typeId === "minecraft:player"
          ? (origin.sourceEntity as Player)
          : undefined,
        ruleId,
        null,
      );

      return {
        status: success
          ? CustomCommandStatus.Success
          : CustomCommandStatus.Failure,
      };
    },
  );
});
