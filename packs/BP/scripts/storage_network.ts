import { system, Block, world, ItemStack } from "@minecraft/server";
import {
  CableNetworkConnections,
  DiscoverCableNetworkConnectionsError,
  discoverCableNetworkConnections,
} from "./cable_network";
import {
  MAX_STORAGE_DRIVE_DATA_LENGTH,
  getStorageDriveSerializedData,
} from "./storage_drive";
import * as resultlegacy from "./utils/result";
import { DeepReadonly } from "ts-essentials";
import { updateImportBus } from "./import_bus";
import { Vector3Utils } from "@minecraft/math";
import { updateExportBus } from "./export_bus";
import { logWarn, makeErrorString } from "./log";
import { updateLevelEmitter } from "./level_emitter";
import {
  getMachineStorage,
  RegisteredStorageType,
  setMachineStorage,
} from "bedrock-energistics-core-api";
import {
  driveEnergyConsumptionRule,
  useEnergyRule,
} from "./addon_rules/addon_rules";
import {
  AddItemStackToStorageError,
  isBannedItem,
  StorageSystem,
} from "./storage_system";
import { FLUID_DRIVE_CAPACITY } from "./fluid_drive";
import {
  getBlockDynamicProperty,
  setBlockDynamicProperty,
} from "./utils/dynamic_property";
import { updateFluidExportBus } from "./fluid_export_bus";
import { getDisksInDrive } from "./storage_drive_v3";
import {
  loadDataArea,
  loadItemsFromDisk,
  saveItemsToDisk,
  unloadDataArea,
} from "./storage_disk_v3";
import { cloneItemStackWithAmount, itemStacksMatch } from "./utils/item";
import { ContainerSlot } from "@minecraft/server";
import { err, ok, Result } from "neverthrow";

/**
 * The maximum number of item stacks (slots) that a single storage disk can hold.
 */
export const STORAGE_DISK_CAPACITY = 64;

export const STORAGE_NETWORK_DEVICE_UPDATE_INTERVAL = 10;

export interface NetworkStoredFluids {
  total: number;
  types: Map<string, number>;
}

/**
 * A {@link StorageSystem} that is comprised of many devices.
 */
export class StorageNetwork extends StorageSystem {
  private static readonly storageNetworks: StorageNetwork[] = [];
  private internalIsValid = true;

  /**
   * Establish a network from any starting position inside of the network
   * @param origin any block inside the network
   * @returns a result containing the new {@link StorageNetwork} or an error
   */
  static async establishNetwork(
    origin: Block,
  ): Promise<
    resultlegacy.Result<StorageNetwork, DiscoverCableNetworkConnectionsError>
  > {
    const result = await discoverCableNetworkConnections(origin);
    if (!result.success) {
      return result;
    }

    const connections = result.value;

    return resultlegacy.success(new StorageNetwork(connections));
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
  ): Promise<
    resultlegacy.Result<StorageNetwork, DiscoverCableNetworkConnectionsError>
  > {
    const existingNetwork = StorageNetwork.getNetwork(block);
    if (existingNetwork) {
      return resultlegacy.success(existingNetwork);
    }

    return StorageNetwork.establishNetwork(block);
  }

  private storedItems?: ItemStack[];
  /**
   * The disk slots that {@link StorageNetwork.storedItems} were loaded from,
   * in the same order they were discovered. Used to write items back to disks
   * in {@link StorageNetwork.saveStoredItemData}.
   */
  private storedItemDisks?: ContainerSlot[];
  private readonly updateIntervalRunId: number;
  private readonly levelEmitterUpdateIntervalRunId: number;

  private storedFluids?: NetworkStoredFluids;

  private constructor(private connections: CableNetworkConnections) {
    super();

    StorageNetwork.storageNetworks.push(this);

    this.updateIntervalRunId = system.runInterval(() => {
      for (const block of this.connections.buses) {
        if (!block.isValid) continue;

        switch (block.typeId) {
          case "fluffyalien_asn:import_bus":
            void updateImportBus(block, this);
            break;
          case "fluffyalien_asn:export_bus":
            void updateExportBus(block, this);
            break;
          case "fluffyalien_asn:fluid_export_bus":
            void updateFluidExportBus(block, this);
            break;
        }
      }

      if (useEnergyRule.get(world)) {
        let energyConsumptionRemaining = this.getEnergyConsumption();
        for (const block of this.connections.powerBanks) {
          const storedEnergy = getMachineStorage(block, "energy");

          const consumption = Math.min(
            storedEnergy,
            energyConsumptionRemaining,
          );
          energyConsumptionRemaining -= consumption;
          void setMachineStorage(block, "energy", storedEnergy - consumption);

          if (energyConsumptionRemaining <= 0) {
            break;
          }
        }
      }
    }, 10);

    this.levelEmitterUpdateIntervalRunId = system.runInterval(() => {
      for (const block of this.connections.levelEmitters) {
        if (!block.isValid) continue;

        void updateLevelEmitter(block, this);
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

  /**
   * Gets all disk slots across every storage drive in this network.
   */
  private getDisks(): ContainerSlot[] {
    const disks: ContainerSlot[] = [];

    for (const drive of this.connections.storageDrives) {
      const disksr = getDisksInDrive(drive);
      if (disksr.isErr()) {
        console.warn(`Error while getting disks: ${disksr.error}`);
        continue;
      }
      disks.push(...disksr.value);
    }

    return disks;
  }

  async getStoredItemStacks(): Promise<Result<ItemStack[], Error>> {
    if (this.storedItems) {
      return ok(this.storedItems);
    }

    const loadDataAreaResult = await loadDataArea();
    if (loadDataAreaResult.isErr()) {
      return err(
        new Error(
          `Failed to get stored item stacks: ${loadDataAreaResult.error}`,
        ),
      );
    }

    const itemStacks: ItemStack[] = [];
    const disks = this.getDisks();

    for (const disk of disks) {
      const itemsr = loadItemsFromDisk(disk);
      if (itemsr.isErr()) {
        console.warn(`Error while getting stored item stacks: ${itemsr.error}`);
        continue;
      }
      itemStacks.push(...itemsr.value);
    }

    unloadDataArea();

    const groups: ItemStack[] = [];
    const indexed = itemStacks.map((stack) => {
      let groupIdx = groups.findIndex((g) => itemStacksMatch(g, stack));
      if (groupIdx === -1) {
        groupIdx = groups.length;
        groups.push(stack);
      }
      return { stack, groupIdx };
    });
    indexed.sort((a, b) =>
      a.groupIdx !== b.groupIdx
        ? a.groupIdx - b.groupIdx
        : a.stack.amount - b.stack.amount,
    );
    const sorted = indexed.map(({ stack }) => stack);

    this.storedItems = sorted;
    this.storedItemDisks = disks;
    return ok(sorted);
  }

  /**
   * The total number of item stacks (slots) that this network can hold across
   * all of its disks.
   */
  private getStorageCapacity(): number {
    return this.getDisks().length * STORAGE_DISK_CAPACITY;
  }

  /**
   * Writes the in-memory item data ({@link StorageNetwork.storedItems}) back to
   * the network's disks. Items are distributed across the disks that they were
   * loaded from, up to {@link STORAGE_DISK_CAPACITY} stacks per disk.
   * @throws if the data area could not be loaded
   */
  private async saveStoredItemData(): Promise<void> {
    // nothing to save if items were never loaded
    if (!this.storedItems || !this.storedItemDisks) {
      return;
    }

    const loadDataAreaResult = await loadDataArea();
    if (loadDataAreaResult.isErr()) {
      throw new Error(
        makeErrorString(
          `could not save item data: ${loadDataAreaResult.error.message}`,
        ),
      );
    }

    const storedItems = this.storedItems;
    const disks = this.storedItemDisks;

    let itemsStored = 0;
    for (const disk of disks) {
      const diskItems = storedItems.slice(
        itemsStored,
        itemsStored + STORAGE_DISK_CAPACITY,
      );
      itemsStored += diskItems.length;

      const saveResult = saveItemsToDisk(disk, diskItems);
      if (saveResult.isErr()) {
        logWarn(`could not save item data: ${saveResult.error.message}`);
      }
    }

    unloadDataArea();
  }

  /**
   * Writes in-memory fluid data to dynamic properties on drives.
   * use saveData instead to save all data.
   */
  private async saveStoredFluidData(): Promise<void> {
    if (!this.connections.fluidDrives.length) return;

    const fluidBudget = new Map((await this.getStoredFluids()).types);

    for (const drive of this.connections.fluidDrives) {
      let remainingCapacity = FLUID_DRIVE_CAPACITY;
      for (const [type, amount] of fluidBudget) {
        const amountToSave = Math.min(amount, remainingCapacity);
        remainingCapacity -= amountToSave;

        setBlockDynamicProperty(drive, `fluid${type}`, amountToSave);

        const newBudget = amount - amountToSave;
        if (newBudget <= 0) {
          fluidBudget.delete(type);
        } else {
          fluidBudget.set(type, newBudget);
        }

        if (remainingCapacity <= 0) {
          break;
        }
      }
    }

    // if we have extra, then just add it all to the first drive
    if (!fluidBudget.size) {
      return;
    }

    const drive = this.connections.fluidDrives[0];
    for (const [type, amount] of fluidBudget) {
      const dynamicPropId = `fluid${type}`;
      setBlockDynamicProperty(
        drive,
        dynamicPropId,
        (getBlockDynamicProperty(drive, dynamicPropId) as number) + amount,
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

    const typeId = typeIdOverride ?? block.typeId;

    const condition = (v: Block): boolean =>
      v.dimension.id === block.dimension.id &&
      Vector3Utils.equals(v, block.location);

    switch (typeId) {
      case "fluffyalien_asn:storage_relay":
      case "fluffyalien_asn:storage_cable":
        return this.connections.cables.some(condition);
      case "fluffyalien_asn:storage_core":
        return condition(this.connections.storageCore);
      case "fluffyalien_asn:storage_drive_v3":
        return this.connections.storageDrives.some(condition);
      case "fluffyalien_asn:storage_interface":
      case "fluffyalien_asn:fluid_interface":
        return this.connections.interfaces.some(condition);
      case "fluffyalien_asn:import_bus":
      case "fluffyalien_asn:export_bus":
      case "fluffyalien_asn:fluid_import_bus":
      case "fluffyalien_asn:fluid_export_bus":
        return this.connections.buses.some(condition);
      case "fluffyalien_asn:level_emitter":
        return this.connections.levelEmitters.some(condition);
      case "fluffyalien_asn:storage_power_bank":
        return this.connections.powerBanks.some(condition);
      case "fluffyalien_asn:wireless_transmitter":
        return this.connections.wirelessTransmitters.some(condition);
      case "fluffyalien_asn:fluid_drive":
        return this.connections.fluidDrives.some(condition);
      default:
        return false;
    }
  }

  /**
   * Update the connections to this network. If an error occurs, the object will be destroyed
   * @see {@link StorageNetwork.destroy}, {@link StorageNetwork.isValid}
   * @throws if the storage core position is unloaded
   * @throws if this object is not valid
   * @returns a result containing an error or undefined
   */
  async updateConnections(): Promise<
    resultlegacy.ErrorResult<DiscoverCableNetworkConnectionsError>
  > {
    this.ensureValidity();

    const result = await discoverCableNetworkConnections(
      this.connections.storageCore,
    );
    if (!result.success) {
      this.destroy();
      return result;
    }

    this.connections = result.value;

    // we need to clear storage because a drive may have been removed
    // these will be updated the next time their get function is called
    this.storedItems = undefined;
    this.storedItemDisks = undefined;
    this.storedFluids = undefined;

    return resultlegacy.success();
  }

  /**
   * Clear the stored items cache. The cache will be created again when {@link StorageNetwork.getStoredItemStacks} is called.
   * @see {@link StorageNetwork.getStoredItemStacks}
   * @throws if this object is invalid
   */
  clearStoredItemsCache(): void {
    this.ensureValidity();
    this.storedItems = undefined;
    this.storedItemDisks = undefined;
  }

  /**
   * Clear the stored fluids cache. The cache will be created again when {@link StorageNetwork.getStoredFluids} is called.
   * @throws if this object is invalid
   */
  clearStoredFluidsCache(): void {
    this.ensureValidity();
    this.storedFluids = undefined;
  }

  /**
   * @throws if this object is not valid
   */
  async getStoredFluids(): Promise<NetworkStoredFluids> {
    this.ensureValidity();

    if (this.storedFluids) {
      return this.storedFluids;
    }

    const storedFluids: NetworkStoredFluids = {
      total: 0,
      types: new Map(),
    };

    const storageTypes = await RegisteredStorageType.getAllIds();

    for (const drive of this.connections.fluidDrives) {
      for (const type of storageTypes) {
        const amount = (getBlockDynamicProperty(drive, `fluid${type}`) ??
          0) as number;
        if (amount <= 0) continue;

        storedFluids.types.set(
          type,
          (storedFluids.types.get(type) ?? 0) + amount,
        );
        storedFluids.total += amount;
      }
    }

    this.storedFluids = storedFluids;
    return this.storedFluids;
  }

  /**
   * @throws if this object is not valid
   */
  getUsedDataLength(): number {
    this.ensureValidity();

    let length = 0;

    for (const drive of this.connections.storageDrives) {
      const serialized = getStorageDriveSerializedData(drive);
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
  getFluidStorageCapacity(): number {
    this.ensureValidity();

    return FLUID_DRIVE_CAPACITY * this.connections.fluidDrives.length;
  }

  getStoredEnergy(): number {
    let energy = 0;

    for (const powerBank of this.connections.powerBanks) {
      energy += getMachineStorage(powerBank, "energy");
    }

    return energy;
  }

  /**
   * @throws if this object is not valid
   */
  getMaxStoredEnergy(): number {
    this.ensureValidity();

    return 6400 * this.connections.powerBanks.length;
  }

  /**
   * @throws if this object is not valid
   * @returns energy consumption per {@link STORAGE_NETWORK_DEVICE_UPDATE_INTERVAL}
   */
  getEnergyConsumption(): number {
    this.ensureValidity();

    return (
      driveEnergyConsumptionRule.get(world) *
      (this.connections.storageDrives.length +
        this.connections.fluidDrives.length)
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
  addItemStack = async (
    itemStack: ItemStack,
  ): Promise<resultlegacy.ErrorResult<AddItemStackToStorageError>> => {
    this.ensureValidity();

    if (isBannedItem(itemStack)) {
      return resultlegacy.failure({
        type: "bannedItem",
        itemId: itemStack.typeId,
      });
    }

    const storedItems = (await this.getStoredItemStacks())._unsafeUnwrap();

    // the items are now stored as real ItemStacks, so each stored stack can
    // only hold up to its max stack size. before mutating anything, make sure
    // the whole incoming amount fits so the add is all-or-nothing (a partial
    // add followed by a failure would duplicate items in the import bus).
    const maxAmount = itemStack.maxAmount;

    let spaceInExisting = 0;
    for (const stored of storedItems) {
      if (!itemStacksMatch(stored, itemStack)) continue;
      spaceInExisting += maxAmount - stored.amount;
    }

    const freeSlots = this.getStorageCapacity() - storedItems.length;
    const totalSpace = spaceInExisting + freeSlots * maxAmount;

    if (itemStack.amount > totalSpace) {
      return resultlegacy.failure({ type: "insufficientStorage" });
    }

    // distribute the incoming amount across the existing matching stacks
    // first, then create new stacks for any overflow.
    let amountRemaining = itemStack.amount;
    let lastMatchIndex = -1;

    for (let i = 0; i < storedItems.length; i++) {
      if (amountRemaining <= 0) break;
      const stored = storedItems[i];
      if (!itemStacksMatch(stored, itemStack)) continue;

      lastMatchIndex = i;
      const space = maxAmount - stored.amount;
      if (space <= 0) continue;

      const amountToAdd = Math.min(space, amountRemaining);
      stored.amount += amountToAdd;
      amountRemaining -= amountToAdd;
    }

    // create new stacks for any overflow, inserted after the last matching stack
    const insertIndex =
      lastMatchIndex === -1 ? storedItems.length : lastMatchIndex + 1;
    let offset = 0;
    while (amountRemaining > 0) {
      const amount = Math.min(maxAmount, amountRemaining);
      storedItems.splice(
        insertIndex + offset,
        0,
        cloneItemStackWithAmount(itemStack, amount),
      );
      amountRemaining -= amount;
      offset++;
    }

    await this.saveStoredItemData();

    return resultlegacy.success();
  };

  /**
   * adds a fluid to the storage network. clamps the amount from 0 to the max that can be stored
   * @returns the amount that was added
   * @throws throws if this object is not valid
   */
  async addFluid(id: string, amount: number): Promise<number> {
    this.ensureValidity();

    const storedFluids = await this.getStoredFluids();

    const capacity = this.getFluidStorageCapacity();
    const remainingStorage = capacity - storedFluids.total;
    const amountToAdd = Math.min(amount, remainingStorage);
    if (amountToAdd <= 0) return 0;

    const currentAmount = storedFluids.types.get(id) ?? 0;
    storedFluids.types.set(id, currentAmount + amountToAdd);
    storedFluids.total += amountToAdd;

    void this.saveStoredFluidData();

    return amountToAdd;
  }

  /**
   * Removes fluids from storage. Clamps the amount from 0 to the amount available in storage
   * @throws if this object is not valid
   * @returns the amount that was removed
   */
  async removeFluid(id: string, amount: number): Promise<number> {
    this.ensureValidity();

    const storedFluids = await this.getStoredFluids();
    const stored = storedFluids.types.get(id) ?? 0;
    const amountToRemove = Math.min(amount, stored);

    if (amountToRemove <= 0) {
      return 0;
    }

    storedFluids.types.set(id, stored - amountToRemove);
    storedFluids.total -= amountToRemove;

    void this.saveStoredFluidData();

    return amountToRemove;
  }

  /**
   * Removes items from storage. Clamps the amount from 1 to the amount available in storage
   * @throws if this object is not valid
   * @returns the amount that was removed
   */
  removeItemStack = async (itemStack: ItemStack): Promise<number> => {
    this.ensureValidity();

    const storedItems = (await this.getStoredItemStacks())._unsafeUnwrap();

    // items may be spread across multiple stacks (each capped at the max stack
    // size), so the requested amount has to be taken from several stacks.
    const totalAvailable = storedItems.reduce(
      (total, other) =>
        itemStacksMatch(other, itemStack) ? total + other.amount : total,
      0,
    );

    if (totalAvailable <= 0) {
      logWarn(
        `couldn't remove item stack (${itemStack.typeId}): no matching item stack was found`,
      );
      return 0;
    }

    const requestAmount = Math.max(
      Math.min(itemStack.amount, totalAvailable),
      1,
    );

    let amountRemaining = requestAmount;
    for (let i = storedItems.length - 1; i >= 0; i--) {
      if (amountRemaining <= 0) break;

      const stored = storedItems[i];
      if (!itemStacksMatch(stored, itemStack)) continue;

      const amountToRemove = Math.min(stored.amount, amountRemaining);
      const newAmount = stored.amount - amountToRemove;
      amountRemaining -= amountToRemove;

      if (newAmount <= 0) {
        storedItems.splice(i, 1);
      } else {
        stored.amount = newAmount;
      }
    }

    // save
    await this.saveStoredItemData();

    return requestAmount;
  };
}
