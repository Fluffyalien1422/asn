import { world } from "@minecraft/server";
import { fluidStorageRule } from "./addon_rules/addon_rules";

world.beforeEvents.playerPlaceBlock.subscribe(
  (e) => {
    if (!fluidStorageRule.get(world)) {
      e.cancel = true;
      e.player.sendMessage({
        rawtext: [
          {
            text: "§c",
          },
          {
            translate:
              "fluffyalien_asn.message.fluidStorage.fluidStorageDisabled",
          },
        ],
      });
      return;
    }
  },
  {
    blockTypes: [
      "fluffyalien_asn:fluid_interface",
      "fluffyalien_asn:fluid_drive",
      "fluffyalien_asn:fluid_import_bus",
      "fluffyalien_asn:fluid_export_bus",
    ],
  },
);
