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
  RemoveItemStackFromStorageError,
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
  getDiskCapacity,
  loadDataArea,
  loadItemsFromDisk,
  saveItemsToDisk,
  unloadDataArea,
} from "./storage_disk_v3";
import { cloneItemStackWithAmount } from "./utils/item";
import { ContainerSlot } from "@minecraft/server";
import { err, ok, Result } from "neverthrow";

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
  ): Promise<Result<StorageNetwork, DiscoverCableNetworkConnectionsError>> {
    const result = await discoverCableNetworkConnections(origin);
    if (result.isErr()) {
      return err(result.error);
    }

    const connections = result.value;

    return ok(new StorageNetwork(connections));
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
      return ok(existingNetwork);
    }

    return StorageNetwork.establishNetwork(block);
  }

  private storedItems?: Map<string, ItemStack>;
  private nextItemIdNum = 0;
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

  private getNextItemId(): string {
    return (this.nextItemIdNum++).toString();
  }

  /**
   * Gets all disk slots across every storage drive in this network.
   */
  private getDisks(): ContainerSlot[] {
    const disks: ContainerSlot[] = [];

    for (const drive of this.connections.storageDrives) {
      const disksr = getDisksInDrive(drive);
      if (disksr.isErr()) {
        logWarn(`Failed to get disks in drive: ${disksr.error}`);
        continue;
      }
      disks.push(...disksr.value);
    }

    return disks;
  }

  async getStoredItemStacks(): Promise<Result<Map<string, ItemStack>, Error>> {
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

    const storedItems = new Map<string, ItemStack>();
    const disks = this.getDisks();

    for (const disk of disks) {
      const itemsr = loadItemsFromDisk(disk);
      if (itemsr.isErr()) {
        logWarn(`Failed to load items from disk: ${itemsr.error}`);
        continue;
      }
      const items = itemsr.value;
      for (const stack of items) {
        storedItems.set(this.getNextItemId(), stack);
      }
    }

    unloadDataArea();

    this.storedItems = storedItems;
    this.storedItemDisks = disks;
    return ok(storedItems);
  }

  /**
   * The total number of item stacks (slots) that this network can hold across
   * all of its disks.
   */
  private getStorageCapacity(): number {
    let total = 0;
    for (const disk of this.getDisks()) {
      total += getDiskCapacity(disk.typeId);
    }
    return total;
  }

  /**
   * Writes the in-memory item data ({@link StorageNetwork.storedItems}) back to
   * the network's disks. Items are distributed across the disks that they were
   * loaded from, up to the capacity of each disk.
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

    const storedItemsArray = [...this.storedItems.values()];
    const disks = this.storedItemDisks;

    let itemsStored = 0;
    for (const disk of disks) {
      const capacity = getDiskCapacity(disk.typeId);
      const diskItems = storedItemsArray.slice(
        itemsStored,
        itemsStored + capacity,
      );
      itemsStored += diskItems.length;

      const saveResult = saveItemsToDisk(disk, diskItems, capacity);
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
    Result<void, DiscoverCableNetworkConnectionsError>
  > {
    this.ensureValidity();

    const result = await discoverCableNetworkConnections(
      this.connections.storageCore,
    );
    if (result.isErr()) {
      this.destroy();
      return err(result.error);
    }

    this.connections = result.value;

    // we need to clear storage because a drive may have been removed
    // these will be updated the next time their get function is called
    this.storedItems = undefined;
    this.storedItemDisks = undefined;
    this.storedFluids = undefined;

    return ok();
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
  /**
   * Adds an item stack to storage. Distributes the incoming amount across
   * existing matching stacks before creating new slots. The add is
   * all-or-nothing: if the full amount does not fit, nothing is stored.
   * @param itemStack the item stack to add
   * @returns a result containing an error if the item could not be stored
   * @throws if this object is not valid
   */
  addItemStack = async (
    itemStack: ItemStack,
  ): Promise<Result<void, AddItemStackToStorageError>> => {
    this.ensureValidity();

    const storedItemsr = await this.getStoredItemStacks();
    if (storedItemsr.isErr()) {
      return err({
        type: "unknownError",
        message: `An unknown error occurred while getting stored item stacks: ${storedItemsr.error}`,
      });
    }
    const storedItems = storedItemsr.value;

    // the items are now stored as real ItemStacks, so each stored stack can
    // only hold up to its max stack size. before mutating anything, make sure
    // the whole incoming amount fits so the add is all-or-nothing (a partial
    // add followed by a failure would duplicate items in the import bus).
    const maxAmount = itemStack.maxAmount;

    let spaceInExisting = 0;
    for (const stored of storedItems.values()) {
      if (!stored.isStackableWith(itemStack)) continue;
      spaceInExisting += maxAmount - stored.amount;
    }

    const freeSlots = this.getStorageCapacity() - storedItems.size;
    const totalSpace = spaceInExisting + freeSlots * maxAmount;

    if (itemStack.amount > totalSpace) {
      return err({ type: "insufficientStorage" });
    }

    // distribute the incoming amount across existing matching stacks first,
    // then create new slots for any overflow.
    let amountRemaining = itemStack.amount;

    for (const stored of storedItems.values()) {
      if (amountRemaining <= 0) break;
      if (!stored.isStackableWith(itemStack)) continue;

      const space = maxAmount - stored.amount;
      if (space <= 0) continue;

      const amountToAdd = Math.min(space, amountRemaining);
      stored.amount += amountToAdd;
      amountRemaining -= amountToAdd;
    }

    while (amountRemaining > 0) {
      const amount = Math.min(maxAmount, amountRemaining);
      storedItems.set(
        this.getNextItemId(),
        cloneItemStackWithAmount(itemStack, amount),
      );
      amountRemaining -= amount;
    }

    await this.saveStoredItemData();

    return ok();
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
   * Removes an item stack from storage by its unique identifier. Clamps the
   * requested amount to the amount stored in the target slot.
   * @param id the unique identifier of the item stack to remove
   * @param amount the number of items to remove; clamped to the amount stored in the slot
   * @returns a result containing the removed {@link ItemStack}, or an error if
   *   the removal failed or the id was not found
   * @throws if this object is not valid
   */
  removeItemStack = async (
    id: string,
    amount: number,
  ): Promise<Result<ItemStack, RemoveItemStackFromStorageError>> => {
    this.ensureValidity();

    const storedItemsr = await this.getStoredItemStacks();
    if (storedItemsr.isErr()) {
      return err({
        type: "unknownError",
        message: `An unknown error occurred while getting stored item stacks: ${storedItemsr.error}`,
      });
    }
    const storedItems = storedItemsr.value;

    const itemStack = storedItems.get(id);
    if (!itemStack) {
      return err({ type: "notFound" });
    }

    const amountToRemove = Math.min(amount, itemStack.amount);
    const removed = cloneItemStackWithAmount(itemStack, amountToRemove);

    const newAmount = itemStack.amount - amountToRemove;
    if (newAmount <= 0) {
      storedItems.delete(id);
    } else {
      itemStack.amount = newAmount;
    }

    await this.saveStoredItemData();

    return ok(removed);
  };
}
