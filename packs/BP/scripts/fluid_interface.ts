import {
  BlockCustomComponent,
  Entity,
  ItemStack,
  world,
} from "@minecraft/server";
import {
  getMachineStorage,
  MachineDefinition,
  RegisteredStorageType,
  removeMachineData,
  setMachineStorage,
} from "bedrock-energistics-core-api";
import { StorageNetwork } from "./storage_network";
import {
  getNetworkOrShowError,
  makeErrorMessageUi,
  showForm,
} from "./utils/ui";
import { useEnergyRule } from "./addon_rules/addon_rules";
import { forceCloseInventory } from "./storage_ui";
import {
  BACK_BUTTON_ITEM_ID,
  getPageNumberItemStacks,
  NEXT_BUTTON_ITEM_ID,
} from "./storage_ui/shared";
import { STR_DIRECTIONS, StrCardinalDirection } from "./utils/direction";
import {
  busUpdateBlockConnectStatesTransformer,
  updateBlockConnectStates,
} from "./utils/block_connect";

const STORAGE_BARS_PER_PAGE = 5;

/**
 * key = entity ID
 * value = page num
 */
const fluidInterfacePages = new Map<string, number>();

function updatePageNumbers(entity: Entity, page: number): void {
  const inv = entity.getComponent("inventory")!.container;
  const pageNumItems = getPageNumberItemStacks(page);
  inv.setItem(22, pageNumItems[0]);
  inv.setItem(23, pageNumItems[1]);
}

export const fluidInterfaceMachine: MachineDefinition = {
  description: {
    id: "fluffyalien_asn:fluid_interface",
    persistentEntity: true,
    ui: {
      elements: {
        backBtn: {
          type: "button",
          index: 0,
          defaults: {
            itemId: BACK_BUTTON_ITEM_ID,
          },
        },
        nextBtn: {
          type: "button",
          index: 1,
          defaults: {
            itemId: NEXT_BUTTON_ITEM_ID,
          },
        },
        bar1: {
          type: "storageBar",
          startIndex: 2,
        },
        bar2: {
          type: "storageBar",
          startIndex: 6,
        },
        bar3: {
          type: "storageBar",
          startIndex: 10,
        },
        bar4: {
          type: "storageBar",
          startIndex: 14,
        },
        bar5: {
          type: "storageBar",
          startIndex: 18,
        },
      },
    },
  },
  events: {
    onButtonPressed(e) {
      const page = fluidInterfacePages.get(e.entityId) ?? 0;

      if (e.elementId === "backBtn") {
        fluidInterfacePages.set(e.entityId, Math.max(0, page - 1));
      } else if (e.elementId === "nextBtn") {
        fluidInterfacePages.set(e.entityId, page + 1);
      }
    },
  },
  handlers: {
    async updateUi({ blockLocation, entityId }) {
      const block = blockLocation.dimension.getBlock(blockLocation);
      if (!block) return {};

      const network = StorageNetwork.getNetwork(block);
      if (!network) return {};

      const page = fluidInterfacePages.get(entityId) ?? 0;
      updatePageNumbers(world.getEntity(entityId)!, page);

      const types: string[] = [];

      let count = 0;
      for (const id of await RegisteredStorageType.getAllIds()) {
        if (!getMachineStorage(blockLocation, id)) continue;
        if (count++ < page * STORAGE_BARS_PER_PAGE) continue;

        types.push(id);
        if (types.length >= 5) break;
      }

      if (!types.length) return {};

      const max = network.getFluidStorageCapacity();

      return {
        storageBars: {
          bar1: {
            type: types[0],
            max,
          },
          bar2: {
            type: types[1],
            max,
          },
          bar3: {
            type: types[2],
            max,
          },
          bar4: {
            type: types[3],
            max,
          },
          bar5: {
            type: types[4],
            max,
          },
        },
      };
    },
  },
};

export const fluidInterfaceComponent: BlockCustomComponent = {
  onPlace(e) {
    if (e.previousBlock.type.id === e.block.typeId) return;
    StorageNetwork.updateConnectableNetworks(e.block);
  },
  onTick(e) {
    const cardinalDirection = e.block.permutation.getState(
      "minecraft:cardinal_direction",
    ) as StrCardinalDirection;

    updateBlockConnectStates(
      e.block,
      STR_DIRECTIONS,
      (other) => other.hasTag("fluffyalien_asn:storage_network_connectable"),
      busUpdateBlockConnectStatesTransformer(cardinalDirection),
    );
  },
};

world.afterEvents.entityHitEntity.subscribe((e) => {
  if (
    e.hitEntity.typeId !== "fluffyalien_asn:fluid_interface" ||
    e.damagingEntity.typeId !== "minecraft:player"
  ) {
    return;
  }

  const block = e.hitEntity.dimension.getBlock(e.hitEntity.location);
  if (!block) {
    return;
  }

  void removeMachineData(block).then(() => {
    block.setType("air");

    e.hitEntity.dimension.spawnItem(
      new ItemStack("fluffyalien_asn:fluid_interface"),
      e.hitEntity.location,
    );

    void StorageNetwork.getNetwork(
      block,
      "fluffyalien_asn:fluid_interface",
    )?.updateConnections();

    e.hitEntity.remove();
  });
});

world.afterEvents.playerInteractWithEntity.subscribe((e) => {
  if (e.target.typeId !== "fluffyalien_asn:fluid_interface") return;

  const block = e.target.dimension.getBlock(e.target.location);
  if (!block) {
    return;
  }

  void getNetworkOrShowError(block, e.target, e.player).then(
    async (network) => {
      if (!network) return;

      if (useEnergyRule.get(world) && network.getStoredEnergy() <= 0) {
        await forceCloseInventory(e.target);
        void showForm(
          makeErrorMessageUi({
            translate:
              "fluffyalien_asn.ui.storageInterface.error.insufficientEnergy",
          }),
          e.player,
        );
        return;
      }

      for (const [id, amount] of (await network.getStoredFluids()).types) {
        void setMachineStorage(block, id, amount);
      }

      fluidInterfacePages.set(e.target.id, 0);
    },
  );
});
