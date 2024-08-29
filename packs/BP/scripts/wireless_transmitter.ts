import { StorageNetwork } from "./storage_network";
import { BlockCustomComponent } from "@minecraft/server";
import { updateBlockConnectStates } from "./utils/block_connect";

export const wirelessTransmitterComponent: BlockCustomComponent = {
  onPlace(e) {
    if (e.previousBlock.type.id === e.block.typeId) return;

    StorageNetwork.updateConnectableNetworks(e.block);
  },
  onPlayerDestroy(e) {
    void StorageNetwork.getNetwork(
      e.block,
      e.destroyedBlockPermutation.type.id,
    )?.updateConnections();
  },
  onTick(e) {
    updateBlockConnectStates(
      e.block,
      ["north", "east", "south", "west", "down"],
      (other) => other.hasTag("fluffyalien_asn:storage_network_connectable"),
    );
  },
};
