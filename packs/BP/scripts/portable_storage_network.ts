import {
  Block,
  BlockCustomComponent,
  Entity,
  ItemCustomComponent,
  ItemStack,
  Player,
  world,
} from "@minecraft/server";
import { logWarn, makeErrorString } from "./log";
import {
  AddItemStackToStorageError,
  isBannedItem,
  StorageSystem,
} from "./storage_system";
import { StorageSystemItemStack } from "./storage_system_item_stack";
import { ErrorResult, failure, success } from "./utils/result";
import { deserialize, serialize, serializeMultiple } from "./serialize";
import {
  MAX_STORAGE_DRIVE_DATA_LENGTH,
  STORAGE_DATA_DYNAMIC_PROPERTY_ID,
} from "./storage_drive";
import { forceCloseInventory, refreshStorageViewer } from "./storage_ui";
import { getPlayerMainhandSlot } from "./utils/item";
import { makeErrorMessageUi, makeMessageUi, showForm } from "./utils/ui";
import { useEnergyRule } from "./addon_rules";
import {
  getMachineStorage,
  removeMachine,
  setMachineStorage,
} from "bedrock-energistics-core-api";

const ENERGY_CONSUMPTION = 20;

/**
 * key = entity ID
 */
const portableStorageNetworks = new Map<string, PortableStorageNetwork>();

class PortableStorageNetwork extends StorageSystem {
  private items: StorageSystemItemStack[] | undefined;
  private internalIsValid = true;

  constructor(
    private readonly entity: Entity,
    private readonly block: Block,
  ) {
    super();

    if (portableStorageNetworks.has(entity.id)) {
      throw new Error(
        makeErrorString(
          `trying to construct a PortableStorageNetwork with entity ID '${entity.id}' but a PortableStorageNetwork for this entity already exists`,
        ),
      );
    }

    portableStorageNetworks.set(entity.id, this);
  }

  destroy(): void {
    this.internalIsValid = false;
    portableStorageNetworks.delete(this.entity.id);
  }

  private getStoredItemStacksMutable(): StorageSystemItemStack[] {
    if (!this.items) {
      this.items = deserialize(this.getSerializedData() ?? "");
    }

    return this.items;
  }

  private saveData(): void {
    this.setSerializedData(
      serializeMultiple(this.getStoredItemStacksMutable()),
    );
  }

  /**
   * @throws if this object is not valid (if it has been destroyed)
   */
  private ensureValidity(): void {
    if (!this.internalIsValid) {
      throw new Error(
        makeErrorString(`PortableStorageNetwork: object destroyed`),
      );
    }
  }

  /**
   * @returns `true` if this object is valid (has not been destroyed), otherwise `false`
   */
  isValid(): boolean {
    return this.internalIsValid;
  }

  /**
   * @throws if this object is not valid
   */
  getStoredItemStacks(): readonly StorageSystemItemStack[] {
    this.ensureValidity();

    return this.getStoredItemStacksMutable();
  }

  getSerializedData(): string | undefined {
    return this.entity.getDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID) as
      | string
      | undefined;
  }

  setSerializedData(data: string): void {
    this.entity.setDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID, data);
  }

  clearItemsCache(): void {
    this.items = undefined;
  }

  /**
   * tries to consume energy
   * if use energy rule is disabled, this function does nothing and returns true
   * @returns whether energy was successfully consumed or not, returns true if use energy is disabled
   */
  consumeEnergy(): boolean {
    if (!useEnergyRule.get(world)) {
      return true;
    }

    const storedEnergy = getMachineStorage(this.block, "energy");

    if (storedEnergy >= ENERGY_CONSUMPTION) {
      setMachineStorage(
        this.block,
        "energy",
        storedEnergy - ENERGY_CONSUMPTION,
      );
      return true;
    }

    return false;
  }

  /**
   * tries to consume energy, if energy cannot be consumed then shows an error.
   * if use energy rule is disabled, this function does nothing and returns true
   * @returns whether energy was successfully consumed or not, returns true if use energy is disabled
   */
  consumeEnergyOrShowError(player: Player): boolean {
    if (this.consumeEnergy()) return true;

    void forceCloseInventory(this.entity).then(() => {
      void showForm(
        makeErrorMessageUi({
          translate:
            "fluffyalien_asn.ui.storageInterface.error.insufficientEnergy",
        }),
        player,
      );
    });

    return false;
  }

  /**
   * @throws if this object is not valid
   */
  addItemStack = (
    itemStack: StorageSystemItemStack,
    player?: Player,
  ): ErrorResult<AddItemStackToStorageError> => {
    this.ensureValidity();

    if (isBannedItem(itemStack)) {
      return failure({
        type: "bannedItem",
        itemId: itemStack.typeId,
      });
    }

    if (player) {
      if (!this.consumeEnergyOrShowError(player)) {
        return failure({
          type: "insufficientEnergy",
        });
      }
    } else {
      if (!this.consumeEnergy()) {
        return failure({
          type: "insufficientEnergy",
        });
      }
    }

    const storedItems = this.getStoredItemStacksMutable();

    const existingItemStack = storedItems.find((other) =>
      itemStack.isStackableWith(other),
    );

    if (existingItemStack) {
      existingItemStack.amount += itemStack.amount;
    } else {
      const length = serialize(itemStack).length;

      if (
        (this.getSerializedData()?.length ?? 0) + length >
        MAX_STORAGE_DRIVE_DATA_LENGTH
      ) {
        return failure({ type: "insufficientStorage" });
      }

      storedItems.push(itemStack);
    }

    this.saveData();

    return success();
  };

  /**
   * Removes items from storage. Clamps the amount from 1 to the amount available in storage
   * @throws if this object is not valid
   * @returns the amount that was removed
   */
  removeItemStack = (
    itemStack: StorageSystemItemStack,
    player?: Player,
  ): number => {
    this.ensureValidity();

    if (player) {
      if (!this.consumeEnergyOrShowError(player)) {
        return 0;
      }
    } else {
      if (!this.consumeEnergy()) {
        return 0;
      }
    }

    const storedItems = this.getStoredItemStacksMutable();

    const storedIndex = storedItems.findIndex((other) =>
      itemStack.isStackableWith(other),
    );

    if (storedIndex === -1) {
      logWarn(
        `couldn't remove item stack (${itemStack.typeId}): no matching StorageSystemItemStack was found`,
      );
      return 0;
    }

    const stored = storedItems[storedIndex];

    const requestAmount = Math.max(
      Math.min(itemStack.amount, stored.amount),
      1,
    );

    stored.amount -= requestAmount;
    if (stored.amount <= 0) {
      storedItems.splice(storedIndex, 1);
    }

    // save
    this.saveData();

    return requestAmount;
  };

  static get(entityId: string): PortableStorageNetwork | undefined {
    return portableStorageNetworks.get(entityId);
  }

  static getOrCreate(entity: Entity, block: Block): PortableStorageNetwork {
    return (
      PortableStorageNetwork.get(entity.id) ??
      new PortableStorageNetwork(entity, block)
    );
  }
}

export const portableStorageNetworkComponent: BlockCustomComponent = {
  onPlace(e) {
    if (e.previousBlock.type.id === e.block.typeId) return;

    e.block.dimension.spawnEntity(
      "fluffyalien_asn:portable_storage_network_entity",
      {
        x: e.block.x + 0.5,
        y: e.block.y,
        z: e.block.z + 0.5,
      },
    ).nameTag = "fluffyalien_asn:storage_interface";
  },
};

export const portableStorageNetworkPlacerComponent: ItemCustomComponent = {
  onUseOn(e) {
    if (useEnergyRule.get(world)) {
      setMachineStorage(
        e.block.above()!,
        "energy",
        (e.itemStack.getDynamicProperty("fluffyalien_asn:energy") as
          | number
          | undefined) ?? 0,
      );
    }
  },
};

world.afterEvents.entityHitEntity.subscribe((e) => {
  if (
    e.hitEntity.typeId !== "fluffyalien_asn:portable_storage_network_entity" ||
    !(e.damagingEntity instanceof Player)
  ) {
    return;
  }

  const block = e.hitEntity.dimension.getBlock(e.hitEntity.location);

  if (block) {
    block.setType("air");

    const placerItem = new ItemStack(
      "fluffyalien_asn:portable_storage_network_placer",
    );

    if (useEnergyRule.get(world)) {
      const energy = getMachineStorage(block, "energy");

      placerItem.setDynamicProperty("fluffyalien_asn:energy", energy);
      placerItem.setLore([`§e${energy.toString()}/6400 energy`]);
    }

    e.hitEntity.dimension.spawnItem(placerItem, e.hitEntity.location);

    removeMachine(block);
  } else {
    logWarn(
      `expected a portable storage network block at (${e.hitEntity.location.x.toString()},${e.hitEntity.location.y.toString()},${e.hitEntity.location.z.toString()}) in ${e.hitEntity.dimension.id}`,
    );
  }

  const network = PortableStorageNetwork.get(e.hitEntity.id);
  if (network) {
    const rawData = network.getSerializedData();

    if (rawData) {
      const itemStack = new ItemStack("fluffyalien_asn:used_storage_disk");
      itemStack.setDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID, rawData);
      e.hitEntity.dimension.spawnItem(itemStack, e.hitEntity.location);
    }

    network.destroy();
  }

  e.hitEntity.remove();
});

world.afterEvents.playerInteractWithEntity.subscribe((e) => {
  if (e.target.typeId !== "fluffyalien_asn:portable_storage_network_entity") {
    return;
  }

  const block = e.target.dimension.getBlock(e.target.location);
  if (!block) {
    logWarn(
      `expected a portable storage network block at (${e.target.location.x.toString()},${e.target.location.y.toString()},${e.target.location.z.toString()}) in ${e.target.dimension.id}`,
    );
    return;
  }

  const network = PortableStorageNetwork.getOrCreate(e.target, block);

  if (e.player.isSneaking) {
    if (!e.itemStack) {
      void forceCloseInventory(e.target).then(() => {
        void showForm(
          makeMessageUi(
            {
              translate: "tile.fluffyalien_asn:portable_storage_network.name",
            },
            {
              rawtext: [
                {
                  translate:
                    "fluffyalien_asn.ui.portableStorageNetwork.body.storageUsed",
                  with: {
                    rawtext: [
                      {
                        text: (
                          network.getSerializedData()?.length ?? 0
                        ).toString(),
                      },
                    ],
                  },
                },
                ...(useEnergyRule.get(world)
                  ? [
                      {
                        text: "\n\n",
                      },
                      {
                        translate:
                          "fluffyalien_asn.ui.portableStorageNetwork.body.storedEnergy",
                        with: {
                          rawtext: [
                            {
                              text: getMachineStorage(
                                block,
                                "energy",
                              ).toString(),
                            },
                          ],
                        },
                      },
                    ]
                  : []),
              ],
            },
          ),
          e.player,
        );
      });

      return;
    }

    if (
      e.itemStack.typeId === "fluffyalien_asn:used_storage_disk" &&
      network.getSerializedData() === undefined
    ) {
      const mainHandSlot = getPlayerMainhandSlot(e.player);

      const diskData = mainHandSlot.getDynamicProperty(
        STORAGE_DATA_DYNAMIC_PROPERTY_ID,
      ) as string | undefined;

      if (diskData) {
        network.setSerializedData(diskData);
        network.clearItemsCache();
      }

      mainHandSlot.setItem();
    }
  }

  refreshStorageViewer(e.target, e.player, network);
});
