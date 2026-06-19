import { BlockCustomComponent } from "@minecraft/server";
import { getPlayerMainhandSlot } from "../utils/item";
import { showExportBusUi } from "./ui";
import {
  busUpdateBlockConnectStatesTransformer,
  updateBlockConnectStates,
} from "../utils/block_connect";
import { STR_DIRECTIONS, StrCardinalDirection } from "../utils/direction";
import { removeAllDynamicPropertiesForBlock } from "../utils/dynamic_property";
import { exportItemProperty, resetExportItemFilters } from "./properties";

export const exportBusComponent: BlockCustomComponent = {
  onBreak(e) {
    removeAllDynamicPropertiesForBlock(e.block);
  },
  onPlayerInteract(e) {
    if (!e.player) return;

    const mainhandSlot = getPlayerMainhandSlot(e.player);
    const heldItem = mainhandSlot.getItem();
    if (heldItem) {
      exportItemProperty.set(e.block, heldItem.typeId);

      // reset optional values
      resetExportItemFilters(e.block);
    }

    void showExportBusUi(e.player, e.block);
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
