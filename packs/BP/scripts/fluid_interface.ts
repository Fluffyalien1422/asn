import { Block, ItemStack, world } from "@minecraft/server";
import {
  getMachineStorage,
  MachineDefinition,
  RegisteredStorageType,
  setMachineStorage,
} from "bedrock-energistics-core-api";
import { StorageNetwork } from "./storage_network";
import {
  getNetworkOrShowError,
  makeErrorMessageUi,
  showForm,
} from "./utils/ui";
import { useEnergyRule } from "./addon_rules";
import { forceCloseInventory } from "./storage_ui";

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
            itemId: "fluffyalien_asn:storage_viewer_ui_back",
          },
        },
        nextBtn: {
          type: "button",
          index: 1,
          defaults: {
            itemId: "fluffyalien_asn:storage_viewer_ui_next",
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
      console.warn(e.elementId);
    },
  },
  handlers: {
    async updateUi({ blockLocation }) {
      const block = blockLocation.dimension.getBlock(blockLocation) as
        | Block
        | undefined;
      if (!block) return {};

      const network = StorageNetwork.getNetwork(block);
      if (!network) return {};

      const types: string[] = [];

      for (const id of await RegisteredStorageType.getAllIds()) {
        if (!getMachineStorage(blockLocation, id)) continue;
        types.push(id);
        if (types.length >= 5) break;
      }

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

world.afterEvents.entityHitEntity.subscribe((e) => {
  if (
    e.hitEntity.typeId !== "fluffyalien_asn:fluid_interface" ||
    e.damagingEntity.typeId !== "minecraft:player"
  ) {
    return;
  }

  const block = e.hitEntity.dimension.getBlock(e.hitEntity.location);

  if (block) {
    block.setType("air");

    e.hitEntity.dimension.spawnItem(
      new ItemStack("fluffyalien_asn:fluid_interface"),
      e.hitEntity.location,
    );

    void StorageNetwork.getNetwork(
      block,
      "fluffyalien_asn:fluid_interface",
    )?.updateConnections();
  }

  e.hitEntity.remove();
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

      const fluids = await network.getStoredFluids();

      for (const [id, amount] of Object.entries(fluids.types)) {
        // @ts-expect-error incompatible DimensionLocation
        setMachineStorage(block, id, amount);
      }
    },
  );
});
