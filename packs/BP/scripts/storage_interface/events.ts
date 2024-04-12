import { StorageNetwork } from "../storage_network";
import { StorageSystemItemStack } from "../storage_system_item_stack";
import { getPlayerMainhandSlot, makeErrorMessageUi, showForm } from "../utils";
import { showEstablishNetworkError, showItemsListUi } from "./ui";
import { world, system } from "@minecraft/server";

world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== "fluffyalien_asn:storage_interface") return;

  StorageNetwork.updateConnectableNetworks(e.block);
});

world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== "fluffyalien_asn:storage_interface")
    return;

  StorageNetwork.getNetwork(
    e.block,
    e.brokenBlockPermutation.type.id,
  )?.updateConnections();
});

let lastPlayerInteractWithBlockTriggerTick = 0;
world.afterEvents.playerInteractWithBlock.subscribe((e) => {
  if (
    e.block.typeId !== "fluffyalien_asn:storage_interface" ||
    e.player.isSneaking ||
    lastPlayerInteractWithBlockTriggerTick + 5 > system.currentTick
  )
    return;

  lastPlayerInteractWithBlockTriggerTick = system.currentTick;

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
      StorageSystemItemStack.fromItemStack(heldItem),
    );
    if (!res.success) {
      void showForm(
        makeErrorMessageUi({
          translate:
            "fluffyalien_asn.ui.storageInterface.error.insufficientStorage",
        }),
        e.player,
      );

      return;
    }

    mainhandSlot.setItem();
    return;
  }

  void (async (): Promise<void> => {
    const requestedItemStack = await showItemsListUi(
      e.player,
      network.getStoredItemStacks(),
    );

    if (!requestedItemStack) {
      return;
    }

    network.takeOutItemStack(e.player, requestedItemStack);
  })();
});
