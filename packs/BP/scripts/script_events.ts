import { getPlayerMainhandSlot } from "./utils/item";
import { STORAGE_DATA_DYNAMIC_PROPERTY_ID } from "./storage_drive";
import { system, Player, world } from "@minecraft/server";
import { logWarn } from "./log";
import {
  forceLoadNetworksRule,
  showRequestItemDialogRule,
  useEnergyRule,
  wirelessInterfaceRangeRule,
} from "./addon_rules";
import { DynamicPropertyAccessor } from "./utils/dynamic_property";

type AddonRuleCommand =
  | {
      type: "bool";
      property: DynamicPropertyAccessor<boolean, boolean>;
    }
  | {
      type: "number";
      int?: boolean;
      property: DynamicPropertyAccessor<number, number>;
    };

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
    type: "number",
    int: true,
    property: wirelessInterfaceRangeRule,
  },
  useEnergy: {
    type: "bool",
    property: useEnergyRule,
  },
};

system.afterEvents.scriptEventReceive.subscribe(
  (e) => {
    if (!(e.sourceEntity instanceof Player)) return;
    const player = e.sourceEntity;

    if (e.id === "fluffyalien_asn:debug_log_disk_data") {
      const item = getPlayerMainhandSlot(player).getItem();

      if (item?.typeId !== "fluffyalien_asn:used_storage_disk") {
        logWarn(
          "could not run script event fluffyalien_asn:debug_log_disk_data: not holding fluffyalien_asn:used_storage_disk",
        );
        return;
      }

      const s = item
        .getDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID)
        ?.toString();
      if (s) logWarn(`fluffyalien_asn:debug_log_disk_data result: ${s}`);
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
          `${rule} = ${ruleCommand.property.get(world).toString()}`,
        );
        return;
      }

      if (ruleCommand.type === "bool") {
        if (value === "true") {
          ruleCommand.property.set(world, true);
          return;
        }

        if (value === "false") {
          ruleCommand.property.set(world, false);
          return;
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

        return;
      }

      const numVal = Number(value);

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

        return;
      }

      if (ruleCommand.int && !Number.isInteger(numVal)) {
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

        return;
      }

      ruleCommand.property.set(world, numVal);
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
