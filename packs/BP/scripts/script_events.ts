import * as bec from "bedrock-energistics-core-api";
import { getPlayerMainhandSlot } from "./utils/item";
import { STORAGE_DATA_DYNAMIC_PROPERTY_ID } from "./storage_drive";
import { system, Player } from "@minecraft/server";
import { logWarn } from "./log";
import { processAddonRuleCommand } from "./addon_rules/set_addon_rule";

system.afterEvents.scriptEventReceive.subscribe(
  (e) => {
    if (!(e.sourceEntity instanceof Player)) return;
    const player = e.sourceEntity;

    if (e.id === "fluffyalien_asn:debug.log_disk_data") {
      const item = getPlayerMainhandSlot(player).getItem();

      if (item?.typeId !== "fluffyalien_asn:used_storage_disk") {
        logWarn(
          "could not run script event fluffyalien_asn:debug.log_disk_data: not holding fluffyalien_asn:used_storage_disk",
        );
        return;
      }

      const s = (
        item.getDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID) as
          | string
          | undefined
      )?.toString();
      if (s) logWarn(`fluffyalien_asn:debug.log_disk_data result: ${s}`);
    } else if (e.id === "fluffyalien_asn:debug.set_wireless_interface_energy") {
      const playerInv = player.getComponent("inventory")!;
      const mainHandSlotIndex = player.selectedSlotIndex;

      const mainHandItem = playerInv.container!.getItem(mainHandSlotIndex);

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

      // @ts-expect-error incompatible type
      const itemMachine = new bec.ItemMachine(playerInv, mainHandSlotIndex);

      itemMachine.setStorage("energy", num);
    } else if (
      e.id === "fluffyalien_asn:rule" ||
      e.id === "fluffyalien_asn:addonrule"
    ) {
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
