import { STORAGE_INTERFACE_BLOCK_TYPE_ID } from "./constants";

$.server.world.afterEvents.playerInteractWithBlock.subscribe((e) => {
  if (e.block.typeId !== STORAGE_INTERFACE_BLOCK_TYPE_ID) return;

  console.warn("interact with interface");
});
