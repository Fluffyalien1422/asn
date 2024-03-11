import { STORAGE_INTERFACE_BLOCK_TYPE_ID } from ".";
import { StorageNetwork } from "../storage_network";
import { StorageSystemItemStack } from "../storage_system_item_stack";
import { getPlayerMainhandSlot, makeErrorMessageUi, showForm } from "../utils";
import { showEstablishNetworkError, showItemsListUi } from "./ui";

$.server.world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== STORAGE_INTERFACE_BLOCK_TYPE_ID) return;

  StorageNetwork.updateConnectableNetworks(e.block);
});

$.server.world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== STORAGE_INTERFACE_BLOCK_TYPE_ID)
    return;

  StorageNetwork.getNetwork(
    e.block,
    e.brokenBlockPermutation.type.id
  )?.updateConnections();
});

let lastPlayerInteractWithBlockTriggerTick = 0;
$.server.world.afterEvents.playerInteractWithBlock.subscribe((e) => {
  if (
    e.block.typeId !== STORAGE_INTERFACE_BLOCK_TYPE_ID ||
    e.player.isSneaking ||
    lastPlayerInteractWithBlockTriggerTick + 5 > $.server.system.currentTick
  )
    return;

  lastPlayerInteractWithBlockTriggerTick = $.server.system.currentTick;

  const networkResult = StorageNetwork.getOrEstablishNetwork(e.block);
  if (!networkResult.success) {
    void showEstablishNetworkError(e.player, networkResult.error);
    return;
  }

  const network = networkResult.value;

  const mainhandSlot = getPlayerMainhandSlot(e.player);
  const heldItem = mainhandSlot?.getItem();
  if (mainhandSlot && heldItem) {
    const res = network.addItemStack(
      StorageSystemItemStack.fromItemStack(heldItem)
    );
    if (!res.success) {
      void showForm(
        makeErrorMessageUi({
          translate:
            "fluffyalien_asn.ui.storageInterface.error.insufficientStorage",
        }),
        e.player
      );

      return;
    }

    mainhandSlot.setItem();
    return;
  }

  void (async (): Promise<void> => {
    const requestedItemStack = await showItemsListUi(
      e.player,
      network.getStoredItemStacks()
    );

    if (!requestedItemStack) {
      return;
    }

    network.takeOutItemStack(e.player, requestedItemStack);
  })();
});
