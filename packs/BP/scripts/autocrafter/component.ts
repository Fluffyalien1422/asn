import { BlockCustomComponent } from "@minecraft/server";
import { getPlayerMainhandSlot } from "../utils/item";
import { removeAllDynamicPropertiesForBlock } from "../utils/block_dynamic_property";
import { showAutocrafterUi } from "./ui";

export const autocrafterComponent: BlockCustomComponent = {
  onBreak(e) {
    removeAllDynamicPropertiesForBlock(e.block);
  },
  onPlayerInteract(e) {
    if (!e.player) return;

    const heldItem = getPlayerMainhandSlot(e.player).getItem();
    void showAutocrafterUi(e.player, e.block, heldItem?.typeId);
  },
};
