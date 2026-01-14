import { BlockCustomComponent } from "@minecraft/server";
import {
  getExportBusEntity,
  setExportBusExportItemDamageRange,
  setExportBusExportItemEnchantments,
  setExportBusExportItemId,
} from ".";
import { getPlayerMainhandSlot } from "../utils/item";
import { showExportBusUi } from "./ui";
import {
  busUpdateBlockConnectStatesTransformer,
  updateBlockConnectStates,
} from "../utils/block_connect";
import { STR_DIRECTIONS, StrCardinalDirection } from "../utils/direction";
import { removeAllDynamicPropertiesForBlock } from "../utils/dynamic_property";

export const exportBusComponent: BlockCustomComponent = {
  onPlayerBreak(e) {
    removeAllDynamicPropertiesForBlock(e.block);

    // legacy support - remove the entity if it exists
    getExportBusEntity(e.block)?.triggerEvent("fluffyalien_asn:despawn");
  },
  onPlayerInteract(e) {
    if (!e.player) return;

    const dynamicPropertyTarget = getExportBusEntity(e.block) ?? e.block;

    const mainhandSlot = getPlayerMainhandSlot(e.player);
    const heldItem = mainhandSlot.getItem();
    if (heldItem) {
      setExportBusExportItemId(dynamicPropertyTarget, heldItem.typeId);

      // reset optional values
      setExportBusExportItemEnchantments(dynamicPropertyTarget, "ignore");
      setExportBusExportItemDamageRange(dynamicPropertyTarget, { min: 0 });
    }

    void showExportBusUi(e.player, dynamicPropertyTarget);
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
