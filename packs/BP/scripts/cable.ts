import { StorageNetwork } from "./storage_network";
import { BlockCustomComponent } from "@minecraft/server";
import { updateBlockConnectStates } from "./utils/block_connect";
import { STR_DIRECTIONS } from "./utils/direction";

export const storageCableComponent: BlockCustomComponent = {
  onPlace(e) {
    if (e.previousBlock.type.id === "fluffyalien_asn:storage_cable") return;

    StorageNetwork.updateConnectableNetworks(e.block);
  },
  onPlayerDestroy(e) {
    void StorageNetwork.getNetwork(
      e.block,
      e.destroyedBlockPermutation.type.id,
    )?.updateConnections();
  },
  onTick(e) {
    updateBlockConnectStates(e.block, STR_DIRECTIONS, (other) =>
      other.hasTag("fluffyalien_asn:storage_network_connectable"),
    );
  },
};
