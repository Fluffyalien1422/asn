import { BlockCustomComponent } from "@minecraft/server";
import { updateBlockConnectStates } from "./utils/block_connect";
import { STR_DIRECTIONS } from "./utils/direction";

export const storageCableComponent: BlockCustomComponent = {
  onTick(e) {
    updateBlockConnectStates(e.block, STR_DIRECTIONS, (other) =>
      other.hasTag("fluffyalien_asn:storage_network_connectable"),
    );
  },
};
