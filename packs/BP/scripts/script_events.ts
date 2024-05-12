import { getPlayerMainhandSlot } from "./utils/item";
import { STORAGE_DATA_DYNAMIC_PROPERTY_ID } from "./storage_drive";
import { system, Player } from "@minecraft/server";
import { Logger } from "./log";
import { forceLoadNetworksRule } from "./addon_rules";
import { DynamicPropertyLocked } from "./dynamic_property";

const log = new Logger("script_events.ts");

type AddonRuleCommand =
  | {
      type: "bool";
      property: DynamicPropertyLocked<true>;
      default: false;
    }
  | {
      type: "bool";
      property: DynamicPropertyLocked<false>;
      default: true;
    };

const ADDON_RULE_COMMANDS: Record<string, AddonRuleCommand> = {
  forceLoadNetworks: {
    type: "bool",
    property: forceLoadNetworksRule,
    default: false,
  },
};

system.afterEvents.scriptEventReceive.subscribe(
  (e) => {
    if (!(e.sourceEntity instanceof Player)) return;
    const player = e.sourceEntity;

    if (e.id === "fluffyalien_asn:debug_log_disk_data") {
      const item = getPlayerMainhandSlot(player).getItem();

      if (item?.typeId !== "fluffyalien_asn:used_storage_disk") {
        log.warn(
          "scriptEventRecieve event",
          "could not run script event fluffyalien_asn:debug_log_disk_data: not holding fluffyalien_asn:used_storage_disk",
        );
        return;
      }

      const s = item
        .getDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID)
        ?.toString();
      if (s)
        log.msg(
          "scriptEventRecieve event",
          `fluffyalien_asn:debug_log_disk_data result: ${s}`,
        );
    } else if (e.id === "fluffyalien_asn:addonrule") {
      const args = e.message.split(" ");

      const rule = args[0];
      const value = args[1];

      if (rule === "help") {
        player.sendMessage({
          rawtext: [
            {
              text: "§a-- fluffyalien_asn:addonrule help -- §r\n",
            },
            ...Object.keys(ADDON_RULE_COMMANDS).flatMap((key) => [
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
        player.sendMessage(
          `${rule} = ${(ruleCommand.property.get() ?? ruleCommand.default).toString()}`,
        );
      } else if (value === "true") {
        if (ruleCommand.default) {
          ruleCommand.property.set();
        } else {
          ruleCommand.property.set(true);
        }
      } else if (value === "false") {
        if (ruleCommand.default) {
          ruleCommand.property.set(false);
        } else {
          ruleCommand.property.set();
        }
      } else {
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
      }
    } else {
      player.sendMessage({
        rawtext: [
          {
            text: "§c",
          },
          {
            translate:
              "fluffyalien_asn.message.scriptEvent.common.invalidScriptEvent",
          },
        ],
      });
    }
  },
  { namespaces: ["fluffyalien_asn"] },
);
