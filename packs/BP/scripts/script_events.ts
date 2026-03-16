import * as bec from "bedrock-energistics-core-api";
import { getPlayerMainhandSlot } from "./utils/item";
import { STORAGE_DATA_DYNAMIC_PROPERTY_ID } from "./storage_drive";
import {
  system,
  Player,
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
} from "@minecraft/server";
import { logWarn } from "./log";
import { processAddonRuleCommand } from "./addon_rules/set_addon_rule";
import { ADDON_RULE_COMMANDS } from "./addon_rules/addon_rules";

system.afterEvents.scriptEventReceive.subscribe(
  (e) => {
    if (!(e.sourceEntity instanceof Player)) return;
    const player = e.sourceEntity;

    if (e.id === "fluffyalien_asn:debug.log_disk_data") {
      const item = getPlayerMainhandSlot(player).getItem();

      if (item?.typeId === "fluffyalien_asn:used_storage_disk") {
        const s = (
          item.getDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID) as
            | string
            | undefined
        )?.toString();
        if (s) logWarn(`fluffyalien_asn:debug.log_disk_data result: ${s}`);
      } else if (item?.typeId === "fluffyalien_asn:used_fluid_storage_disk") {
        const s = item
          .getDynamicPropertyIds()
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          .map((id) => `${id}=${item.getDynamicProperty(id)!.toString()}`)
          .join(" ");
        if (s) logWarn(`fluffyalien_asn:debug.log_disk_data result: ${s}`);
      } else {
        logWarn(
          "could not run script event fluffyalien_asn:debug.log_disk_data: not holding a supported item",
        );
        return;
      }
    } else if (e.id === "fluffyalien_asn:debug.set_wireless_interface_energy") {
      const playerInv = player.getComponent("inventory")!;
      const mainHandSlotIndex = player.selectedSlotIndex;

      const mainHandItem = playerInv.container.getItem(mainHandSlotIndex);

      if (mainHandItem?.typeId !== "fluffyalien_asn:wireless_interface") {
        logWarn(
          "could not run script event fluffyalien_asn:debug.set_wireless_interface_energy: not holding fluffyalien_asn:wireless_interface",
        );
        return;
      }

      const num = Number(e.message);

      if (isNaN(num)) {
        logWarn(
          "could not run script event fluffyalien_asn:debug.set_wireless_interface_energy: invalid value",
        );
        return;
      }

      const itemMachine = new bec.ItemMachine(playerInv, mainHandSlotIndex);

      itemMachine.setStorage("energy", num);
    } else if (
      e.id === "fluffyalien_asn:rule" ||
      e.id === "fluffyalien_asn:addonrule"
    ) {
      e.sourceEntity.sendMessage({
        rawtext: [
          {
            text: "§c",
          },
          {
            translate:
              "fluffyalien_asn.message.scriptEvent.addonRule.scriptEventUsageWarning",
          },
        ],
      });

      processAddonRuleCommand(player, e.message);
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

system.beforeEvents.startup.subscribe((e) => {
  e.customCommandRegistry.registerEnum("fluffyalien_asn:AsnRuleId", [
    "help",
    ...Object.keys(ADDON_RULE_COMMANDS),
  ]);

  e.customCommandRegistry.registerCommand(
    {
      name: "fluffyalien_asn:asnrule",
      description: "Read or set an ASN add-on rule.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [
        {
          name: "fluffyalien_asn:AsnRuleId",
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
      let argsStr = ruleId;
      if (value !== undefined) argsStr += " " + value;

      const success = processAddonRuleCommand(
        origin.sourceEntity?.typeId === "minecraft:player"
          ? (origin.sourceEntity as Player)
          : undefined,
        argsStr,
      );

      return {
        status: success
          ? CustomCommandStatus.Success
          : CustomCommandStatus.Failure,
      };
    },
  );
});
