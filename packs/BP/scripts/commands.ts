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

system.beforeEvents.startup.subscribe((e) => {
  e.customCommandRegistry.registerEnum("fluffyalien_asn:AsnRuleIdOrHelp", [
    "help",
    ...Object.keys(ADDON_RULE_COMMANDS),
  ]);
  e.customCommandRegistry.registerEnum("fluffyalien_asn:AsnRuleIdOrAll", [
    "all",
    ...Object.keys(ADDON_RULE_COMMANDS),
  ]);

  e.customCommandRegistry.registerCommand(
    {
      name: "fluffyalien_asn:asnrule",
      description: "Read or set an ASN add-on rule.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [
        {
          name: "fluffyalien_asn:AsnRuleIdOrHelp",
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
      name: "fluffyalien_asn:asnrulereset",
      description: "Reset an ASN add-on rule.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [
        {
          name: "fluffyalien_asn:AsnRuleIdOrAll",
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
