import { Vector3Utils } from "@minecraft/math";
import {
  STORAGE_NETWORK_STANDARD_TICK_INTERVAL,
  StorageNetwork,
} from "./storage_network";
import {
  Block,
  BlockCustomComponent,
  Player,
  RawMessage,
  system,
  world,
} from "@minecraft/server";
import { logWarn } from "./log";
import { showEstablishNetworkError } from "./cable_network";
import {
  wirelessInterfaceLinkDimensionProperty,
  wirelessInterfaceLinkLocationProperty,
} from "./wireless_interface";
import { ActionFormData, ActionFormResponse } from "@minecraft/server-ui";
import { getPlayerMainhandSlot } from "./utils/item";
import { useEnergyRule } from "./addon_rules/addon_rules";
import { RegisteredStorageType } from "bedrock-energistics-core-api";
import { getEntitiesAtBlockLocation } from "./utils/location";

const ENTITY_ID = "fluffyalien_asn:storage_core_entity";

async function showStorageCoreUi(
  player: Player,
  network: StorageNetwork,
): Promise<ActionFormResponse> {
  const form = new ActionFormData();

  form.title({
    translate: "fluffyalien_asn.ui.storageCore.title",
  });

  const rawtext: RawMessage[] = [
    {
      translate: "fluffyalien_asn.ui.storageCore.body.storageUsed",
      with: {
        rawtext: [
          {
            text: (await network.getStoredItemStacksCount()).toString(),
          },
          {
            text: network.getItemSlotsCapacity().toString(),
          },
        ],
      },
    },
  ];

  if (useEnergyRule.safeGet(world)) {
    rawtext.push(
      {
        text: "\n\n",
      },
      {
        translate: "fluffyalien_asn.ui.storageCore.body.storedEnergy",
        with: {
          rawtext: [
            {
              text: network.getStoredEnergy().toString(),
            },
            {
              text: network.getMaxStoredEnergy().toString(),
            },
          ],
        },
      },
      {
        text: "\n\n",
      },
      {
        translate: "fluffyalien_asn.ui.storageCore.body.energyConsumption",
        with: {
          rawtext: [
            {
              text: Math.floor(
                network.getEnergyConsumption() /
                  STORAGE_NETWORK_STANDARD_TICK_INTERVAL,
              ).toString(),
            },
          ],
        },
      },
    );
  }

  const storedFluids = await network.getStoredFluids();

  rawtext.push(
    {
      text: "\n\n",
    },
    {
      translate: "fluffyalien_asn.ui.storageCore.body.storageUsedFluidTotal",
      with: {
        rawtext: [
          {
            text: storedFluids.total.toString(),
          },
          {
            text: network.getFluidStorageCapacity().toString(),
          },
        ],
      },
    },
  );

  for (const [fluid, amount] of storedFluids.types) {
    rawtext.push(
      {
        text: "\n\n",
      },
      {
        translate: "fluffyalien_asn.ui.storageCore.body.storageUsedFluid",
        with: {
          rawtext: [
            {
              text: (await RegisteredStorageType.get(fluid))!.name,
            },
            {
              text: amount.toString(),
            },
            {
              text: Math.floor((amount / storedFluids.total) * 100).toString(),
            },
          ],
        },
      },
    );
  }

  form.body({ rawtext });
  form.button({
    translate: "fluffyalien_asn.ui.common.close",
  });

  return form.show(player);
}

/**
 * Removes every storage core entity at the given block's location. A storage core should only
 * ever have one, but removing all of them defends against duplicates/orphans
 * (eg. a prior entity whose removal failed).
 */
function removeStorageCoreEntities(block: Block): void {
  for (const entity of getEntitiesAtBlockLocation(block, ENTITY_ID)) {
    entity.remove();
  }
}

export const storageCoreComponent: BlockCustomComponent = {
  onPlace(e) {
    if (e.previousBlock.type.id === e.block.typeId) return;

    // clear any stray entities first so the new storage core starts with exactly one
    removeStorageCoreEntities(e.block);

    e.block.dimension.spawnEntity(ENTITY_ID, e.block.bottomCenter());
    StorageNetwork.updateConnectableNetworks(e.block);
  },
  onBreak(e) {
    removeStorageCoreEntities(e.block);
    StorageNetwork.getNetwork(e.block)?.destroy();
  },
  onPlayerInteract(e) {
    if (!e.player) return;
    const player = e.player;

    const mainhandSlot = getPlayerMainhandSlot(e.player);

    if (
      mainhandSlot.hasItem() &&
      mainhandSlot.typeId === "fluffyalien_asn:wireless_interface"
    ) {
      wirelessInterfaceLinkLocationProperty.set(mainhandSlot, e.block.location);
      wirelessInterfaceLinkDimensionProperty.set(
        mainhandSlot,
        e.block.dimension.id,
      );

      player.sendMessage({
        rawtext: [
          {
            text: "§a",
          },
          {
            translate: "fluffyalien_asn.message.wirelessInterface.linked",
          },
        ],
      });
      return;
    }

    void StorageNetwork.getOrEstablishNetwork(e.block).then((networkResult) => {
      if (networkResult.isErr()) {
        void showEstablishNetworkError(player, networkResult.error);
        return;
      }

      const network = networkResult.value;

      void showStorageCoreUi(player, network);
    });
  },
};

world.afterEvents.entityLoad.subscribe((e) => {
  if (e.entity.typeId !== ENTITY_ID) return;

  const entity = e.entity;

  system.runTimeout(() => {
    const block = entity.dimension.getBlock(entity.location);
    if (!block) {
      logWarn(
        `couldn't establish network (storage core loaded): couldn't get storage core block at (${Vector3Utils.toString(
          entity.location,
        )}) in ${entity.dimension.id}`,
      );
      return;
    }

    // establish a network when the storage core entity is loaded so that the processes
    // will start running without having to open an interface
    void StorageNetwork.getOrEstablishNetwork(block);
  }, 100);
});
