import { Block, Dimension, DimensionLocation, Player } from "@minecraft/server";
import {
  CableNetworkConnections,
  DiscoverCableNetworkConnectionsError,
  discoverCableNetworkConnections,
} from "./cable";
import { vector3AsDimensionLocation, vector3Matches } from "./utils/vector";
import { Result, failure, success } from "./result";
import {
  MAX_STORAGE_DRIVE_DATA_LENGTH,
  getStorageDriveSerializedData,
  setStorageDriveSerializedData,
} from "./storage_drive";
import { StorageSystemItemStack } from "./storage_system_item_stack";
import { deserialize, serialize } from "./serialize";
import { STRING_DYNAMIC_PROPERTY_MAX_LENGTH } from "./constants";

export type AddItemStackToStorageError = "insufficientStorage";

export class StorageNetwork {
  private static storageNetworks: StorageNetwork[] = [];

  /**
   * Establish a network from any starting position inside of the network
   * @param origin any block inside the network
   * @returns a result containing the new {@link StorageNetwork} or an error
   */
  static establishNetwork(
    origin: Block
  ): Result<StorageNetwork, DiscoverCableNetworkConnectionsError> {
    const result = discoverCableNetworkConnections(origin);
    if (!result.success) {
      return result;
    }

    const connections = result.value;

    return success(new StorageNetwork(origin.dimension, connections));
  }

  /**
   * Get the {@link StorageNetwork} that the {@link DimensionLocation} belongs to
   * @returns the {@link StorageNetwork} if it was found or undefined
   */
  static getNetwork(location: DimensionLocation): StorageNetwork | undefined {
    return StorageNetwork.storageNetworks.find((network) =>
      network.isPartOfNetwork(location)
    );
  }

  /**
   * Gets the {@link StorageNetwork} that the {@link Block} belongs to or establishes a new one
   * @see {@link StorageNetwork.establishNetwork}, {@link StorageNetwork.getNetwork}
   * @returns the existing or new network
   */
  static getOrEstablishNetwork(
    block: Block
  ): Result<StorageNetwork, DiscoverCableNetworkConnectionsError> {
    const existingNetwork = StorageNetwork.getNetwork(block);
    if (existingNetwork) {
      return success(existingNetwork);
    }

    return StorageNetwork.establishNetwork(block);
  }

  private storedItems?: StorageSystemItemStack[];

  private constructor(
    private readonly dimension: Dimension,
    private connections: CableNetworkConnections
  ) {
    StorageNetwork.storageNetworks.push(this);
  }

  private getStoredItemStacksMutable(): StorageSystemItemStack[] {
    if (this.storedItems) {
      return this.storedItems;
    }

    const itemStacks: StorageSystemItemStack[] = [];

    for (const driveLocation of this.connections.storageDrives) {
      const serialized = getStorageDriveSerializedData(
        vector3AsDimensionLocation(driveLocation, this.dimension)
      );

      if (serialized === false) {
        console.warn(
          `(StorageNetwork#getStoredItemStacksMutable) Could not read data from storage drive at (${driveLocation.x}, ${driveLocation.y}, ${driveLocation.z}) in ${this.dimension.id}. Skipping. Some items may be missing.`
        );
      }
      if (!serialized) {
        continue;
      }

      itemStacks.push(...deserialize(serialized));
    }

    this.storedItems = itemStacks;
    return itemStacks;
  }

  /**
   * Writes in-memory data to dynamic properties on drives
   * @param useRealMaxLength internal argument, do not use
   */
  private saveData(useRealMaxLength = false): void {
    const storedItems = this.getStoredItemStacks();
    const maxStorageDriveDataLength = useRealMaxLength
      ? STRING_DYNAMIC_PROPERTY_MAX_LENGTH
      : MAX_STORAGE_DRIVE_DATA_LENGTH;

    let itemsStored = 0;

    for (const driveLocation of this.connections.storageDrives) {
      let serializedData = "";

      while (itemsStored < storedItems.length) {
        const newData = serialize(storedItems[itemsStored]);

        if (
          serializedData.length + newData.length >
          maxStorageDriveDataLength
        ) {
          break;
        }

        serializedData += newData;
        itemsStored++;
      }

      if (
        !setStorageDriveSerializedData(
          vector3AsDimensionLocation(driveLocation, this.dimension),
          serializedData
        )
      ) {
        console.warn(
          `(StorageNetwork#saveData) Could not set data in storage drive at (${driveLocation.x}, ${driveLocation.y}, ${driveLocation.z}) in ${this.dimension.id}. Skipping. Some items may be missing or duplicated.`
        );
      }
    }

    if (itemsStored < storedItems.length) {
      if (useRealMaxLength) {
        // if the fallback failed as well, throw an error
        throw new Error(
          "(StorageNetwork#saveData) Could not save data: reached max storage."
        );
      }

      // fall back to STRING_DYNAMIC_PROPERTY_MAX_LENGTH if we could not save everything
      console.warn(
        "(StorageNetwork#saveData) Could not save data with default max data length (MAX_STORAGE_DRIVE_DATA_LENGTH). Falling back to STRING_DYNAMIC_PROPERTY_MAX_LENGTH."
      );
      this.saveData(true);
    }
  }

  /**
   * Check if a {@link DimensionLocation} is part of this network
   */
  isPartOfNetwork(location: DimensionLocation): boolean {
    return (
      location.dimension.id === this.dimension.id &&
      (vector3Matches(location, this.connections.storageCore) ||
        this.connections.storageDrives.some((v) =>
          vector3Matches(v, location)
        ) ||
        this.connections.storageInterfaces.some((v) =>
          vector3Matches(v, location)
        ) ||
        this.connections.cables.some((v) => vector3Matches(v, location)))
    );
  }

  /**
   * Update the connections to this network
   * @throws if the storage core has been moved
   * @returns a result containing an error or null
   */
  updateConnections(): Result<null, DiscoverCableNetworkConnectionsError> {
    const coreBlock = this.dimension.getBlock(this.connections.storageCore);
    if (!coreBlock) {
      throw new Error(
        `(StorageNetwork#updateConnections) Cannot update connections: storage core does not exist at (${this.connections.storageCore.x}, ${this.connections.storageCore.y}, ${this.connections.storageCore.z}).`
      );
    }

    const result = discoverCableNetworkConnections(coreBlock);
    if (!result.success) {
      return result;
    }

    this.connections = result.value;

    return success(null);
  }

  getStoredItemStacks(): readonly StorageSystemItemStack[] {
    return this.getStoredItemStacksMutable();
  }

  getUsedDataLength(): number {
    let length = 0;

    for (const driveLocation of this.connections.storageDrives) {
      const serialized = getStorageDriveSerializedData(
        vector3AsDimensionLocation(driveLocation, this.dimension)
      );

      if (serialized === false) {
        console.warn(
          `(StorageNetwork#getUsedDataLength) Could not read data from storage drive at (${driveLocation.x}, ${driveLocation.y}, ${driveLocation.z}) in ${this.dimension.id}. Skipping. Some items may be missing.`
        );
      }
      if (!serialized) {
        continue;
      }

      length += serialized.length;
    }

    return length;
  }

  getMaxDataLength(): number {
    return (
      MAX_STORAGE_DRIVE_DATA_LENGTH * this.connections.storageDrives.length
    );
  }

  addItemStack(
    itemStack: StorageSystemItemStack
  ): Result<null, AddItemStackToStorageError> {
    const storedItems = this.getStoredItemStacksMutable();

    const existingItemStack = storedItems.find((other) =>
      itemStack.isStackableWith(other)
    );

    if (existingItemStack) {
      existingItemStack.amount += itemStack.amount;
    } else {
      const length = serialize(itemStack).length;

      if (this.getUsedDataLength() + length > this.getMaxDataLength()) {
        return failure("insufficientStorage");
      }

      storedItems.push(itemStack);
    }

    this.saveData();

    return success(null);
  }

  /**
   * Take items out of storage and gives it to the player. Clamps the amount from 1 to the amount available in storage
   * @throws if a matching item does not exist in the storage
   */
  takeOutItemStack(player: Player, itemStack: StorageSystemItemStack): void {
    const storedItems = this.getStoredItemStacksMutable();

    const storedIndex = storedItems.findIndex((other) =>
      itemStack.isStackableWith(other)
    );

    if (storedIndex === -1) {
      throw new Error(
        "(StorageNetwork#takeOutItemStack) No matching StorageSystemItemStack was found."
      );
    }

    const stored = storedItems[storedIndex];

    const requestAmount = Math.max(
      Math.min(itemStack.amount, stored.amount),
      1
    );

    stored.amount -= requestAmount;
    if (stored.amount <= 0) {
      storedItems.splice(storedIndex, 1);
    }

    // spawn the items

    const mcItemStack = itemStack.toItemStack();

    let amountRemaining = requestAmount;

    while (amountRemaining > 0) {
      const amount = Math.min(mcItemStack.maxAmount, amountRemaining);
      amountRemaining -= amount;

      const newItemStack = mcItemStack.clone();
      newItemStack.amount = amount;

      player.dimension.spawnItem(newItemStack, player.location);
    }

    // save
    this.saveData();
  }
}
