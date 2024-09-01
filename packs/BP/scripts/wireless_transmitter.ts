import { BlockCustomComponent } from "@minecraft/server";
import { updateBlockConnectStates } from "./utils/block_connect";

export const wirelessTransmitterComponent: BlockCustomComponent = {
  onTick(e) {
    updateBlockConnectStates(
      e.block,
      ["north", "east", "south", "west", "down"],
      (other) => other.hasTag("fluffyalien_asn:storage_network_connectable"),
    );
  },
};
