import { system, Block, Dimension, Player } from "@minecraft/server";
import {
  CableNetworkConnections,
  DiscoverCableNetworkConnectionsError,
  discoverCableNetworkConnections,
} from "./cable_network";
import { vector3AsDimensionLocation } from "./utils/location";
import { Result, failure, success } from "./utils/result";
import {
  MAX_STORAGE_DRIVE_DATA_LENGTH,
  getStorageDriveSerializedData,
  setStorageDriveSerializedData,
} from "./storage_drive";
import { StorageSystemItemStack } from "./storage_system_item_stack";
import { deserialize, serialize } from "./serialize";
import { STRING_DYNAMIC_PROPERTY_MAX_LENGTH } from "./constants";
import { DeepReadonly } from "ts-essentials";
import { updateImportBus } from "./import_bus";
import { Vector3Utils } from "@minecraft/math";
import { updateExportBus } from "./export_bus";
import { logWarn, makeErrorString } from "./log";
import { updateLevelEmitter } from "./level_emitter";

export type AddItemStackToStorageError =
  | {
      type: "insufficientStorage";
    }
  | {
      type: "bannedItem";
      itemId: string;
    };

export class StorageNetwork {
  private static readonly storageNetworks: StorageNetwork[] = [];
  private internalIsValid = true;

  /**
   * Establish a network from any starting position inside of the network
   * @param origin any block inside the network
   * @returns a result containing the new {@link StorageNetwork} or an error
   */
  static async establishNetwork(
    origin: Block,
  ): Promise<Result<StorageNetwork, DiscoverCableNetworkConnectionsError>> {
    const result = await discoverCableNetworkConnections(origin);
    if (!result.success) {
      return result;
    }

    const connections = result.value;

    return success(new StorageNetwork(origin.dimension, connections));
  }

  /**
   * Get the {@link StorageNetwork} that the {@link Block} belongs to
   * @param typeIdOverride forwarded to {@link StorageNetwork.isPartOfNetwork}
   * @returns the {@link StorageNetwork} if it was found or undefined
   */
  static getNetwork(
    block: Block,
    typeIdOverride?: string,
  ): StorageNetwork | undefined {
    return StorageNetwork.storageNetworks.find((network) =>
      network.isPartOfNetwork(block, typeIdOverride),
    );
  }

  /**
   * Get the {@link StorageNetwork}s that the {@link Block} can connect to
   * @returns the {@link StorageNetwork}s that were found
   */
  static getConnectableNetworks(block: Block): StorageNetwork[] {
    const networks: StorageNetwork[] = [];

    function checkBlock(other: Block): boolean {
      return other.hasTag("fluffyalien_asn:storage_network_connectable");
    }

    {
      const north = block.north();
      if (north && checkBlock(north)) {
        const network = StorageNetwork.getNetwork(north);
        if (network) networks.push(network);
      }
    }

    {
      const east = block.east();
      if (east && checkBlock(east)) {
        const network = StorageNetwork.getNetwork(east);
        if (network) networks.push(network);
      }
    }

    {
      const south = block.south();
      if (south && checkBlock(south)) {
        const network = StorageNetwork.getNetwork(south);
        if (network) networks.push(network);
      }
    }

    {
      const west = block.west();
      if (west && checkBlock(west)) {
        const network = StorageNetwork.getNetwork(west);
        if (network) networks.push(network);
      }
    }

    {
      const above = block.above();
      if (above && checkBlock(above)) {
        const network = StorageNetwork.getNetwork(above);
        if (network) networks.push(network);
      }
    }

    {
      const below = block.below();
      if (below && checkBlock(below)) {
        const network = StorageNetwork.getNetwork(below);
        if (network) networks.push(network);
      }
    }

    return networks;
  }

  /**
   * Call `updateConnections` on the {@link StorageNetwork}s that the {@link Block} can connect to
   * @see {@link StorageNetwork.getConnectableNetworks}, {@link StorageNetwork.updateConnections}
   */
  static updateConnectableNetworks(block: Block): void {
    for (const network of StorageNetwork.getConnectableNetworks(block)) {
      void network.updateConnections();
    }
  }

  /**
   * Gets the {@link StorageNetwork} that the {@link Block} belongs to or establishes a new one
   * @see {@link StorageNetwork.establishNetwork}, {@link StorageNetwork.getNetwork}
   * @returns the existing or new network
   */
  static async getOrEstablishNetwork(
    block: Block,
  ): Promise<Result<StorageNetwork, DiscoverCableNetworkConnectionsError>> {
    const existingNetwork = StorageNetwork.getNetwork(block);
    if (existingNetwork) {
      return success(existingNetwork);
    }

    return StorageNetwork.establishNetwork(block);
  }

  private storedItems?: StorageSystemItemStack[];
  private readonly updateIntervalRunId: number;
  private readonly levelEmitterUpdateIntervalRunId: number;

  private constructor(
    private readonly dimension: Dimension,
    private connections: CableNetworkConnections,
  ) {
    StorageNetwork.storageNetworks.push(this);

    this.updateIntervalRunId = system.runInterval(() => {
      for (const connection of this.connections.buses) {
        const block = this.dimension.getBlock(connection);
        if (!block) continue;

        switch (block.typeId) {
          case "fluffyalien_asn:import_bus":
            updateImportBus(block, this);
            break;
          case "fluffyalien_asn:export_bus":
            updateExportBus(block, this);
            break;
        }
      }
    }, 10);

    this.levelEmitterUpdateIntervalRunId = system.runInterval(() => {
      for (const connection of this.connections.levelEmitters) {
        const block = this.dimension.getBlock(connection);
        if (!block) continue;

        updateLevelEmitter(block, this);
      }
    });
  }

  /**
   * @throws if this object is not valid (if it has been destroyed)
   * @see {@link StorageNetwork.isValid}, {@link StorageNetwork.destroy}
   */
  private ensureValidity(): void {
    if (!this.internalIsValid) {
      throw new Error(makeErrorString(`StorageNetwork: object destroyed`));
    }
  }

  private getStoredItemStacksMutable(): StorageSystemItemStack[] {
    if (this.storedItems) {
      return this.storedItems;
    }

    const itemStacks: StorageSystemItemStack[] = [];

    for (const driveLocation of this.connections.storageDrives) {
      const serialized = getStorageDriveSerializedData(
        vector3AsDimensionLocation(driveLocation, this.dimension),
      );

      if (serialized === false) {
        logWarn(
          `could not read data from storage drive at (${driveLocation.x.toString()}, ${driveLocation.y.toString()}, ${driveLocation.z.toString()}) in ${
            this.dimension.id
          } to get stored item stacks in network. skipping. some items may be missing`,
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
          serializedData,
        )
      ) {
        logWarn(
          `could not set data in storage drive at (${driveLocation.x.toString()}, ${driveLocation.y.toString()}, ${driveLocation.z.toString()}) in ${
            this.dimension.id
          }. skipping. some items may be missing or duplicated`,
        );
      }
    }

    if (itemsStored < storedItems.length) {
      if (useRealMaxLength) {
        // if the fallback failed as well, throw an error
        throw new Error(
          makeErrorString("could not save data: reached max storage"),
        );
      }

      // fall back to STRING_DYNAMIC_PROPERTY_MAX_LENGTH if we could not save everything
      logWarn(
        "could not save data with default max data length (MAX_STORAGE_DRIVE_DATA_LENGTH). falling back to STRING_DYNAMIC_PROPERTY_MAX_LENGTH",
      );
      this.saveData(true);
    }
  }

  /**
   * @returns `true` if this object is valid (has not been destroyed), otherwise `false`
   */
  isValid(): boolean {
    return this.internalIsValid;
  }

  /**
   * Destroy this object
   * @see {@link StorageNetwork.isValid}
   */
  destroy(): void {
    this.internalIsValid = false;

    system.clearRun(this.updateIntervalRunId);
    system.clearRun(this.levelEmitterUpdateIntervalRunId);

    const i = StorageNetwork.storageNetworks.indexOf(this);
    if (i === -1) return;

    StorageNetwork.storageNetworks.splice(i, 1);
  }

  /**
   * Check if a {@link Block} is part of this network
   * @param typeIdOverride use this string instead of the block's actual type ID. Use this parameter to get the network of a block that has since been changed (eg. a broken block)
   * @throws if this object is not valid
   */
  isPartOfNetwork(block: Block, typeIdOverride?: string): boolean {
    this.ensureValidity();

    if (block.dimension.id !== this.dimension.id) {
      return false;
    }

    const typeId = typeIdOverride ?? block.typeId;

    switch (typeId) {
      case "fluffyalien_asn:storage_cable":
        return this.connections.cables.some((v) =>
          Vector3Utils.equals(v, block.location),
        );
      case "fluffyalien_asn:storage_core":
        return Vector3Utils.equals(
          block.location,
          this.connections.storageCore,
        );
      case "fluffyalien_asn:storage_drive":
        return this.connections.storageDrives.some((v) =>
          Vector3Utils.equals(v, block.location),
        );
      case "fluffyalien_asn:storage_interface":
        return this.connections.storageInterfaces.some((v) =>
          Vector3Utils.equals(v, block.location),
        );
      case "fluffyalien_asn:import_bus":
      case "fluffyalien_asn:export_bus":
        return this.connections.buses.some((v) =>
          Vector3Utils.equals(v, block.location),
        );
      case "fluffyalien_asn:level_emitter":
        return this.connections.levelEmitters.some((v) =>
          Vector3Utils.equals(v, block.location),
        );
      default:
        return false;
    }
  }

  /**
   * Update the connections to this network. If an error occurs, the object will be destroyed
   * @see {@link StorageNetwork.destroy}, {@link StorageNetwork.isValid}
   * @throws if the storage core position is unloaded
   * @throws if this object is not valid
   * @returns a result containing an error or null
   */
  async updateConnections(): Promise<
    Result<null, DiscoverCableNetworkConnectionsError>
  > {
    this.ensureValidity();

    const coreBlock = this.dimension.getBlock(this.connections.storageCore);
    if (!coreBlock) {
      throw new Error(
        makeErrorString(
          `cannot update connections: location (${this.connections.storageCore.x.toString()}, ${this.connections.storageCore.y.toString()}, ${this.connections.storageCore.z.toString()}) in ${
            this.dimension.id
          } is not loaded`,
        ),
      );
    }

    const result = await discoverCableNetworkConnections(coreBlock);
    if (!result.success) {
      this.destroy();
      return result;
    }

    this.connections = result.value;

    // we need to clear stored items because a drive may have been removed
    // the next time getStoredItemsMutable is called, storedItems will be updated
    this.storedItems = undefined;

    return success(null);
  }

  /**
   * Clear the stored items cache. The cache will be created again when {@link StorageNetwork.getStoredItemStacksMutable} or {@link StorageNetwork.getStoredItemStacks} is called.
   * @see {@link StorageNetwork.getStoredItemStacks} and {@link StorageNetwork.getStoredItemStacksMutable}
   * @throws if this object is invalid
   */
  clearStoredItemsCache(): void {
    this.ensureValidity();
    this.storedItems = undefined;
  }

  /**
   * @throws if this object is not valid
   */
  getStoredItemStacks(): readonly StorageSystemItemStack[] {
    this.ensureValidity();

    return this.getStoredItemStacksMutable();
  }

  /**
   * @throws if this object is not valid
   */
  getUsedDataLength(): number {
    this.ensureValidity();

    let length = 0;

    for (const driveLocation of this.connections.storageDrives) {
      const serialized = getStorageDriveSerializedData(
        vector3AsDimensionLocation(driveLocation, this.dimension),
      );

      if (serialized === false) {
        logWarn(
          `could not read data from storage drive at (${driveLocation.x.toString()}, ${driveLocation.y.toString()}, ${driveLocation.z.toString()}) in ${
            this.dimension.id
          } to get used data length. skipping. result may not be accurate`,
        );
      }
      if (!serialized) {
        continue;
      }

      length += serialized.length;
    }

    return length;
  }

  /**
   * @throws if this object is not valid
   */
  getMaxDataLength(): number {
    this.ensureValidity();

    return (
      MAX_STORAGE_DRIVE_DATA_LENGTH * this.connections.storageDrives.length
    );
  }

  /**
   * @throws if this object is not valid
   */
  getConnections(): DeepReadonly<CableNetworkConnections> {
    this.ensureValidity();

    return this.connections;
  }

  /**
   * @throws if this object is not valid
   */
  addItemStack(
    itemStack: StorageSystemItemStack,
  ): Result<null, AddItemStackToStorageError> {
    this.ensureValidity();

    if (
      itemStack.typeId.startsWith("minecraft:") &&
      itemStack.typeId.endsWith("_shulker_box")
    ) {
      return failure({
        type: "bannedItem",
        itemId: itemStack.typeId,
      });
    }

    const storedItems = this.getStoredItemStacksMutable();

    const existingItemStack = storedItems.find((other) =>
      itemStack.isStackableWith(other),
    );

    if (existingItemStack) {
      existingItemStack.amount += itemStack.amount;
    } else {
      const length = serialize(itemStack).length;

      if (this.getUsedDataLength() + length > this.getMaxDataLength()) {
        return failure({ type: "insufficientStorage" });
      }

      storedItems.push(itemStack);
    }

    this.saveData();

    return success(null);
  }

  /**
   * Removes items from storage. Clamps the amount from 1 to the amount available in storage
   * @throws if this object is not valid
   * @returns the amount that was removed
   * @see {@link StorageNetwork.takeOutItemStack}
   */
  removeItemStack(itemStack: StorageSystemItemStack): number {
    this.ensureValidity();

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
  }

  /**
   * Take items out of storage and gives it to the player. Clamps the amount from 1 to the amount available in storage
   * @throws if this object is not valid
   * @see {@link StorageNetwork.removeItemStack}
   */
  takeOutItemStack(player: Player, itemStack: StorageSystemItemStack): void {
    const requestAmount = this.removeItemStack(itemStack);

    const mcItemStack = itemStack.toItemStack();

    let amountRemaining = requestAmount;

    while (amountRemaining > 0) {
      const amount = Math.min(mcItemStack.maxAmount, amountRemaining);
      amountRemaining -= amount;

      const newItemStack = mcItemStack.clone();
      newItemStack.amount = amount;

      player.dimension.spawnItem(newItemStack, player.location);
    }
  }
}
