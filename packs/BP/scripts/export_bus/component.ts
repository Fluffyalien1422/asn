import { BlockCustomComponent } from "@minecraft/server";
import {
  getExportBusEntity,
  setExportBusExportItemDamageRange,
  setExportBusExportItemEnchantments,
  setExportBusExportItemId,
} from ".";
import { StorageNetwork } from "../storage_network";
import { getPlayerMainhandSlot } from "../utils/item";
import { showExportBusUi } from "./ui";
import { Logger } from "../log";
import {
  busUpdateBlockConnectStatesTransformer,
  updateBlockConnectStates,
} from "../utils/block_connect";
import { STR_DIRECTIONS, StrCardinalDirection } from "../utils/direction";

const log = new Logger("export_bus/component.ts");

export const exportBusComponent: BlockCustomComponent = {
  onPlace(e) {
    e.block.dimension.spawnEntity("fluffyalien_asn:export_bus_entity", {
      x: e.block.x + 0.5,
      y: e.block.y,
      z: e.block.z + 0.5,
    });

    StorageNetwork.updateConnectableNetworks(e.block);
  },
  onPlayerDestroy(e) {
    getExportBusEntity(e.block)?.triggerEvent("fluffyalien_asn:despawn");

    void StorageNetwork.getNetwork(
      e.block,
      e.destroyedBlockPermutation.type.id,
    )?.updateConnections();
  },
  onPlayerInteract(e) {
    if (!e.player) return;

    const entity = getExportBusEntity(e.block);
    if (!entity) {
      log.warn(
        "playerInteractWithBlock event",
        "cannot get export bus dummy entity",
      );
      return;
    }

    const mainhandSlot = getPlayerMainhandSlot(e.player);
    const heldItem = mainhandSlot.getItem();
    if (heldItem) {
      setExportBusExportItemId(entity, heldItem.typeId);

      // reset optional values
      setExportBusExportItemEnchantments(entity, "ignore");
      setExportBusExportItemDamageRange(entity, { min: 0 });
    }

    void showExportBusUi(e.player, entity);
  },
  onTick(e) {
    updateBlockConnectStates(
      e.block,
      STR_DIRECTIONS,
      (other) => other.typeId === "fluffyalien_asn:storage_cable",
      busUpdateBlockConnectStatesTransformer(
        e.block.permutation.getState(
          "minecraft:cardinal_direction",
        ) as StrCardinalDirection,
      ),
    );
  },
};
