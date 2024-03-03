import { Block, Dimension, DimensionLocation } from "@minecraft/server";
import {
  CableNetworkConnections,
  DiscoverCableNetworkConnectionsError,
  discoverCableNetworkConnections,
} from "./cable";
import { vector3AsDimensionLocation, vector3Matches } from "./utils/vector";
import { Result, success } from "./result";
import { getStorageDriveSerializedData } from "./storage_drive";
import { StorageSystemItemStack } from "./storage_system_item_stack";
import { deserialize } from "./serialize";

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

      if (!serialized) {
        console.warn(
          `Could not read data from storage drive at (${driveLocation.x}, ${driveLocation.y}, ${driveLocation.z}) in ${this.dimension.id}. Skipping. Some items may be missing.`
        );
        continue;
      }

      itemStacks.push(...deserialize(serialized));
    }

    this.storedItems = itemStacks;
    return itemStacks;
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
        `Cannot update connections: storage core does not exist at (${this.connections.storageCore.x}, ${this.connections.storageCore.y}, ${this.connections.storageCore.z}).`
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

  addItemStack(
    itemStack: StorageSystemItemStack
  ): Result<null, AddItemStackToStorageError> {
    const storedItems = this.getStoredItemStacksMutable();
    //todo: finish this
  }
}
