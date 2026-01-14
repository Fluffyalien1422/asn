import { BlockCustomComponent } from "@minecraft/server";
import { StorageNetwork } from "./storage_network";

export const networkDeviceComponent: BlockCustomComponent = {
  onPlace(e) {
    if (e.previousBlock.type.id === e.block.typeId) return;

    StorageNetwork.updateConnectableNetworks(e.block);
  },
  onPlayerBreak(e) {
    void StorageNetwork.getNetwork(
      e.block,
      e.brokenBlockPermutation.type.id,
    )?.updateConnections();
  },
};
