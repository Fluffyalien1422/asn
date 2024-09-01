import { BlockCustomComponent } from "@minecraft/server";
import { StorageNetwork } from "./storage_network";

export const networkDeviceComponent: BlockCustomComponent = {
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
};
