import { Vector3Utils } from "@minecraft/math";
import {
  STORAGE_NETWORK_DEVICE_UPDATE_INTERVAL,
  StorageNetwork,
} from "./storage_network";
import {
  BlockCustomComponent,
  DimensionLocation,
  Entity,
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
import { fluidStorageExperimentRule, useEnergyRule } from "./addon_rules";
import { showForm } from "./utils/ui";
import { RegisteredStorageType } from "bedrock-energistics-core-api";

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
            text: network.getUsedDataLength().toString(),
          },
          {
            text: network.getMaxDataLength().toString(),
          },
        ],
      },
    },
  ];

  if (useEnergyRule.get(world)) {
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
                  STORAGE_NETWORK_DEVICE_UPDATE_INTERVAL,
              ).toString(),
            },
          ],
        },
      },
    );
  }

  if (fluidStorageExperimentRule.get(world)) {
    rawtext.push(
      {
        text: "\n\n",
      },
      {
        translate: "fluffyalien_asn.ui.storageCore.body.storageUsedFluidTotal",
        with: {
          rawtext: [
            {
              text: network.storedFluids.total.toString(),
            },
            {
              text: network.getFluidStorageCapacity().toString(),
            },
          ],
        },
      },
    );

    for (const [fluid, amount] of network.storedFluids.types) {
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
                text: Math.floor(
                  (amount / network.storedFluids.total) * 100,
                ).toString(),
              },
            ],
          },
        },
      );
    }
  }

  form.body({ rawtext });
  form.button({
    translate: "fluffyalien_asn.ui.common.close",
  });

  return showForm(form, player);
}

/**
 * Gets the storage core dummy entity at a {@link DimensionLocation}
 * @param location the block location of the storage core
 * @returns the {@link Entity} or undefined if it could not be found
 */
function getStorageCoreEntity(location: DimensionLocation): Entity | undefined {
  return location.dimension
    .getEntitiesAtBlockLocation(location)
    .find((v) => v.typeId === "fluffyalien_asn:storage_core_entity");
}

export const storageCoreComponent: BlockCustomComponent = {
  onPlace(e) {
    if (e.previousBlock.type.id === "fluffyalien_asn:storage_core") return;

    e.block.dimension.spawnEntity("fluffyalien_asn:storage_core_entity", {
      x: e.block.x + 0.5,
      y: e.block.y,
      z: e.block.z + 0.5,
    });

    StorageNetwork.updateConnectableNetworks(e.block);
  },
  onPlayerDestroy(e) {
    getStorageCoreEntity(e.block)?.triggerEvent("fluffyalien_asn:despawn");
    StorageNetwork.getNetwork(
      e.block,
      e.destroyedBlockPermutation.type.id,
    )?.destroy();
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
      if (!networkResult.success) {
        void showEstablishNetworkError(player, networkResult.error);
        return;
      }

      const network = networkResult.value;

      void showStorageCoreUi(player, network);
    });
  },
};

world.afterEvents.entityLoad.subscribe((e) => {
  if (e.entity.typeId !== "fluffyalien_asn:storage_core_entity") return;

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
