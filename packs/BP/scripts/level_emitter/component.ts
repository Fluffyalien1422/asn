import { BlockCustomComponent } from "@minecraft/server";
import { getPlayerMainhandSlot } from "../utils/item";
import { showLevelEmitterUi } from "./ui";
import {
  busUpdateBlockConnectStatesTransformer,
  updateBlockConnectStates,
} from "../utils/block_connect";
import { STR_DIRECTIONS, StrCardinalDirection } from "../utils/direction";
import { removeAllDynamicPropertiesForBlock } from "../utils/block_dynamic_property";
import { itemProperty, resetLevelEmitterFilters } from "./properties";

export const levelEmitterComponent: BlockCustomComponent = {
  onBreak(e) {
    removeAllDynamicPropertiesForBlock(e.block);
  },
  onPlayerInteract(e) {
    if (!e.player) return;

    const mainhandSlot = getPlayerMainhandSlot(e.player);
    const heldItem = mainhandSlot.getItem();
    if (heldItem) {
      itemProperty.set(e.block, heldItem.typeId);

      // reset optional values
      resetLevelEmitterFilters(e.block);
    }

    void showLevelEmitterUi(e.player, e.block);
  },
  onTick(e) {
    updateBlockConnectStates(
      e.block,
      STR_DIRECTIONS,
      (other) => other.hasTag("fluffyalien_asn:storage_network_connectable"),
      busUpdateBlockConnectStatesTransformer(
        e.block.permutation.getState(
          "minecraft:cardinal_direction",
        ) as StrCardinalDirection,
      ),
    );
  },
};
