import { BlockCustomComponent, world } from "@minecraft/server";
import { fluidStorageRule } from "./addon_rules/addon_rules";

export const fluidStorageBlockComponent: BlockCustomComponent = {
  beforeOnPlayerPlace(e) {
    if (fluidStorageRule.get(world)) return;

    e.cancel = true;
    e.player!.sendMessage({
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
  },
};
