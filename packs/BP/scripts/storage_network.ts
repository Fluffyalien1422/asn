import { system, Block, world, ItemStack } from "@minecraft/server";
import {
  CableNetworkConnections,
  DiscoverCableNetworkConnectionsError,
  discoverCableNetworkConnections,
} from "./cable_network";
import { DeepReadonly } from "ts-essentials";
import { updateImportBus } from "./import_bus";
import { updateExportBus } from "./export_bus";
import { updateAutocrafter } from "./autocrafter";
import { logWarn, panic } from "./log";
import { updateLevelEmitter } from "./level_emitter";
import {
  getMachineStorage,
  RegisteredStorageType,
  setMachineStorage,
} from "bedrock-energistics-core-api";
import {
  deviceEnergyConsumptionRule,
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
} from "./utils/block_dynamic_property";
import { updateFluidExportBus } from "./fluid_export_bus";
import { getDisksInDrive } from "./storage_drive_v3";
import {
  getDiskCapacity,
  loadItemsFromDisk,
  saveItemsToDisk,
} from "./storage_disk_v3";
import { cloneItemStackWithAmount } from "./utils/item";
import { getBlockUid } from "./utils/block";
import { ContainerSlot } from "@minecraft/server";
import { err, ok, Result } from "neverthrow";

/**
 * How often (in ticks) {@link StorageNetwork.standardTick} runs. Energy
 * accounting and bus/autocrafter updates happen at this cadence. The "fast"
 * tick (level emitters) runs every tick instead.
 */
export const STORAGE_NETWORK_STANDARD_TICK_INTERVAL = 10;

/** The fluids stored across a network, aggregated over all of its fluid drives. */
export interface NetworkStoredFluids {
  /** The combined amount of every fluid type. */
  total: number;
  /** The amount stored per fluid type id. Types with zero are omitted. */
  types: Map<string, number>;
}

/**
 * A snapshot of a single disk slot: the stored {@link ItemStack} object that
 * was last written there, plus its amount at that time.
 */
interface DiskSlotSnapshot {
  stack: ItemStack;
  amount: number;
}

/**
 * Whether the item stacks a disk would be written with still match the snapshot
 * of what was last persisted to it.
 *
 * This compares by object identity (plus amount), NOT by value. The scripting
 * API can't expose every byte the structure save persists, so a value
 * comparison ({@link itemStacksMatch}) could call two distinct items equal and
 * wrongly skip a write. Identity sidesteps that: stored items are only ever
 * mutated in place by `.amount`, and any other change (a new item, a removal, a
 * slot shift) puts a different object reference in the slot. So matching
 * reference + amount means the persisted bytes are unchanged. A `saved`
 * snapshot of `undefined` means the previous contents are unknown (eg. the disk
 * failed to load), so the disk is always treated as changed.
 *
 * IMPORTANT: this relies on stored items never being mutated except by amount.
 * If that ever changes, this check must be revisited.
 */
function diskContentsMatch(
  saved: readonly DiskSlotSnapshot[] | undefined,
  current: readonly ItemStack[],
): boolean {
  if (!saved) return false;
  if (saved.length !== current.length) return false;
  for (let i = 0; i < saved.length; i++) {
    if (saved[i].stack !== current[i]) return false;
    if (saved[i].amount !== current[i].amount) return false;
  }
  return true;
}

/** Captures a snapshot of the given disk slice for {@link diskContentsMatch}. */
function snapshotDiskContents(items: readonly ItemStack[]): DiskSlotSnapshot[] {
  return items.map((stack) => ({ stack, amount: stack.amount }));
}

/**
 * A {@link StorageSystem} that is comprised of many devices.
 */
export class StorageNetwork extends StorageSystem {
  /**
   * Index from block uid (see {@link getBlockUid}) to the network containing
   * that block, so {@link StorageNetwork.getNetwork} is O(1). Kept in sync by
   * {@link StorageNetwork.indexConnections} / {@link StorageNetwork.unindexConnections}.
   */
  private static readonly networkByBlockUid = new Map<string, StorageNetwork>();

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
   * Get the {@link StorageNetwork} that the {@link Block} belongs to. Resolved
   * by the block's position, so this also works for a block that has since been
   * broken (the location stays indexed until the network's connections update).
   * @returns the {@link StorageNetwork} if it was found or undefined
   */
  static getNetwork(block: Block): StorageNetwork | undefined {
    return StorageNetwork.networkByBlockUid.get(getBlockUid(block));
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

  /**
   * Backing flag for {@link StorageNetwork.isValid}. Set to `false` by
   * {@link StorageNetwork.destroy}, after which most methods throw.
   */
  private internalIsValid = true;
  /**
   * The block uids this network currently has registered in
   * {@link StorageNetwork.networkByBlockUid}.
   */
  private indexedUids: string[] = [];
  /**
   * In-memory cache of every item stack on the network, keyed by a unique id
   * (see {@link StorageNetwork.getNextItemId}). Lazily loaded from the disks by
   * {@link StorageNetwork.getStoredItemStacks} and `undefined` until then.
   * Mutated in place by the add/remove methods and flushed to disk by
   * {@link StorageNetwork.saveStoredItemData}.
   */
  private storedItems?: Map<string, ItemStack>;
  /** Monotonic counter backing {@link StorageNetwork.getNextItemId}. */
  private nextItemIdNum = 0;
  /**
   * The disk slots that {@link StorageNetwork.storedItems} were loaded from,
   * in the same order they were discovered. Used to write items back to disks
   * in {@link StorageNetwork.saveStoredItemData}.
   */
  private storedItemDisks?: ContainerSlot[];
  /**
   * Snapshot of the item stacks last persisted to each disk in
   * {@link StorageNetwork.storedItemDisks}, parallel by index. Used by
   * {@link StorageNetwork.saveStoredItemData} to skip rewriting disks whose
   * contents have not changed. An entry is `undefined` if that disk's contents
   * are unknown (eg. it failed to load), forcing it to be rewritten.
   */
  private savedDiskContents?: (DiskSlotSnapshot[] | undefined)[];
  /** Run id for the {@link STORAGE_NETWORK_STANDARD_TICK_INTERVAL} interval, cleared on {@link StorageNetwork.destroy}. */
  private readonly standardTickRunId: number;
  /** Run id for the per-tick {@link StorageNetwork.fastTick} interval, cleared on {@link StorageNetwork.destroy}. */
  private readonly fastTickRunId: number;
  /**
   * In-memory cache of the network's stored fluids. Lazily populated from the
   * fluid drives by {@link StorageNetwork.getStoredFluids} and `undefined`
   * until then.
   */
  private storedFluids?: NetworkStoredFluids;
  /**
   * The total amount of energy stored across the network's power banks.
   * Recalcualated every `standardTick` if `useEnergy` is enabled.
   * Resets to `0` if `useEnergy` is disabled.
   */
  private storedEnergy = 0;
  /**
   * The energy demand that is currently being unmet by the network.
   * Recalcualated every `standardTick` if `useEnergy` is enabled.
   * Resets to `0` if `useEnergy` is disabled.
   */
  private unmetEnergyDemand = 0;

  /**
   * Use {@link StorageNetwork.establishNetwork} or
   * {@link StorageNetwork.getOrEstablishNetwork} to create a network. Indexes
   * the connections and starts the standard and fast tick intervals.
   * @param connections the discovered connections that make up this network
   */
  private constructor(private connections: CableNetworkConnections) {
    super();

    this.indexConnections();

    this.standardTickRunId = system.runInterval(
      this.standardTick,
      STORAGE_NETWORK_STANDARD_TICK_INTERVAL,
    );
    this.fastTickRunId = system.runInterval(this.fastTick);
  }

  /**
   * Runs every {@link STORAGE_NETWORK_STANDARD_TICK_INTERVAL} ticks. Settles
   * energy accounting (draining power banks to cover the network's consumption
   * and recording stored/unmet energy) then updates every bus and autocrafter.
   * If energy is enabled and demand cannot be met, the tick is cancelled before
   * any devices update.
   */
  private readonly standardTick = (): void => {
    if (useEnergyRule.safeGet(world)) {
      // drain the power banks one at a time to cover this tick's consumption,
      // tallying what remains in each so storedEnergy reflects the post-drain
      // total and unmetEnergyDemand reflects any shortfall.
      let totalStoredEnergy = 0;
      let energyConsumptionRemaining = this.getEnergyConsumption();
      for (const block of this.connections.powerBanks) {
        const storedEnergy = getMachineStorage(block, "energy");

        const consumption = Math.max(
          Math.min(storedEnergy, energyConsumptionRemaining),
          0,
        );
        const newStoredEnergy = storedEnergy - consumption;
        if (storedEnergy !== newStoredEnergy) {
          void setMachineStorage(block, "energy", newStoredEnergy);
        }

        totalStoredEnergy += newStoredEnergy;
        energyConsumptionRemaining -= consumption;
      }
      this.storedEnergy = totalStoredEnergy;
      this.unmetEnergyDemand = energyConsumptionRemaining;

      if (energyConsumptionRemaining > 0) {
        // There is insufficient energy. Cancel this tick.
        return;
      }
    } else {
      // Reset energy values to 0 if useEnergy is disabled.
      this.storedEnergy = 0;
      this.unmetEnergyDemand = 0;
    }

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
        case "fluffyalien_asn:autocrafter":
          void updateAutocrafter(block, this);
          break;
      }
    }
  };

  /**
   * Runs every tick. Updates the network's level emitters. Skipped while there
   * is unmet energy demand (as last computed by {@link StorageNetwork.standardTick}).
   */
  private readonly fastTick = (): void => {
    if (this.unmetEnergyDemand > 0) {
      // There is insufficient energy. Cancel this tick.
      return;
    }

    for (const block of this.connections.levelEmitters) {
      if (!block.isValid) continue;

      void updateLevelEmitter(block, this);
    }
  };

  /**
   * @throws if this object is not valid (if it has been destroyed)
   * @see {@link StorageNetwork.isValid}, {@link StorageNetwork.destroy}
   */
  private ensureValidity(): void {
    if (!this.internalIsValid) {
      panic("The StorageNetwork object has been destroyed.");
    }
  }

  /**
   * Allocates a fresh unique id for a stored item stack. Ids are only unique
   * within this network's lifetime; they are not persisted.
   */
  private getNextItemId(): string {
    return (this.nextItemIdNum++).toString();
  }

  /**
   * (Re)indexes this network's blocks in {@link StorageNetwork.networkByBlockUid}
   * so {@link StorageNetwork.getNetwork} can resolve a block to its network in
   * O(1). Any stale entries this network previously owned are removed first.
   */
  private indexConnections(): void {
    this.unindexConnections();

    const index = (block: Block): void => {
      const uid = getBlockUid(block);
      StorageNetwork.networkByBlockUid.set(uid, this);
      this.indexedUids.push(uid);
    };

    const c = this.connections;
    index(c.storageCore);
    for (const block of c.cables) index(block);
    for (const block of c.storageDrives) index(block);
    for (const block of c.interfaces) index(block);
    for (const block of c.buses) index(block);
    for (const block of c.levelEmitters) index(block);
    for (const block of c.powerBanks) index(block);
    for (const block of c.wirelessTransmitters) index(block);
    for (const block of c.fluidDrives) index(block);
  }

  /**
   * Removes this network's entries from {@link StorageNetwork.networkByBlockUid}.
   * Only removes entries that still point to this network, so a block since
   * claimed by another network is left untouched.
   */
  private unindexConnections(): void {
    for (const uid of this.indexedUids) {
      if (StorageNetwork.networkByBlockUid.get(uid) === this) {
        StorageNetwork.networkByBlockUid.delete(uid);
      }
    }
    this.indexedUids = [];
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

  /**
   * Gets all item stacks stored on the network, keyed by unique id. On the
   * first call the items are loaded from every disk and cached, along with the
   * disks they came from ({@link StorageNetwork.storedItemDisks}) and a snapshot
   * of each disk's contents ({@link StorageNetwork.savedDiskContents}) for
   * change detection. Subsequent calls return the cache until it is cleared.
   * @returns a result containing the stored items map, or an error
   */
  async getStoredItemStacks(): Promise<Result<Map<string, ItemStack>, Error>> {
    if (this.storedItems) {
      return ok(this.storedItems);
    }

    const storedItems = new Map<string, ItemStack>();
    const disks = this.getDisks();
    // snapshot of what is currently on each disk, parallel to `disks`
    const savedDiskContents: (DiskSlotSnapshot[] | undefined)[] = [];

    for (const disk of disks) {
      const itemsr = await loadItemsFromDisk(disk);
      if (itemsr.isErr()) {
        logWarn(`Failed to load items from disk: ${itemsr.error}`);
        // contents unknown, force this disk to be rewritten on the next save
        savedDiskContents.push(undefined);
        continue;
      }
      const items = itemsr.value;
      for (const stack of items) {
        storedItems.set(this.getNextItemId(), stack);
      }
      savedDiskContents.push(snapshotDiskContents(items));
    }

    this.storedItems = storedItems;
    this.storedItemDisks = disks;
    this.savedDiskContents = savedDiskContents;
    return ok(storedItems);
  }

  /**
   * Gets the number of distinct item stacks (slots) currently stored. Returns
   * `0` if the stored items could not be loaded.
   */
  async getStoredItemStacksCount(): Promise<number> {
    return (await this.getStoredItemStacks()).unwrapOr({ size: 0 }).size;
  }

  /**
   * The total number of item stacks (slots) that this network can hold across
   * all of its disks.
   */
  getItemSlotsCapacity(): number {
    return this.computeItemSlotsCapacity(this.getDisks());
  }

  /**
   * Sums the slot capacity of the given disks. Use this with the cached
   * {@link StorageNetwork.storedItemDisks} to avoid re-scanning the drives.
   */
  private computeItemSlotsCapacity(disks: readonly ContainerSlot[]): number {
    let total = 0;
    for (const disk of disks) {
      total += getDiskCapacity(disk.typeId);
    }
    return total;
  }

  /**
   * Writes the in-memory item data ({@link StorageNetwork.storedItems}) back to
   * the network's disks. Items are distributed across the disks that they were
   * loaded from, up to the capacity of each disk.
   * @returns a result containing an error if the data area could not be loaded
   */
  private async saveStoredItemData(): Promise<Result<void, Error>> {
    // nothing to save if items were never loaded
    if (!this.storedItems || !this.storedItemDisks || !this.savedDiskContents) {
      return ok();
    }

    const storedItemsArray = [...this.storedItems.values()];
    const disks = this.storedItemDisks;
    const savedDiskContents = this.savedDiskContents;

    // compute the new contents of each disk and find which ones actually
    // changed since the last save. disk writes are expensive, so unchanged
    // disks are skipped entirely.
    const newDiskContents: ItemStack[][] = [];
    const dirtyDiskIndexes: number[] = [];
    let itemsStored = 0;
    for (let i = 0; i < disks.length; i++) {
      const capacity = getDiskCapacity(disks[i].typeId);
      const diskItems = storedItemsArray.slice(
        itemsStored,
        itemsStored + capacity,
      );
      itemsStored += diskItems.length;
      newDiskContents.push(diskItems);

      if (!diskContentsMatch(savedDiskContents[i], diskItems)) {
        dirtyDiskIndexes.push(i);
      }
    }

    // nothing changed, so there's no need to touch the data area at all
    if (!dirtyDiskIndexes.length) {
      return ok();
    }

    for (const i of dirtyDiskIndexes) {
      const disk = disks[i];
      const diskItems = newDiskContents[i];
      const capacity = getDiskCapacity(disk.typeId);

      const saveResult = await saveItemsToDisk(disk, diskItems, capacity);
      if (saveResult.isErr()) {
        // leave this disk's snapshot unchanged so it is retried next save
        logWarn(`Failed to save item data: ${saveResult.error.message}`);
        continue;
      }

      // record what we just persisted so future saves can skip this disk
      savedDiskContents[i] = snapshotDiskContents(diskItems);
    }

    return ok();
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
        ((getBlockDynamicProperty(drive, dynamicPropId) as
          | number
          | undefined) ?? 0) + amount,
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

    system.clearRun(this.standardTickRunId);
    system.clearRun(this.fastTickRunId);

    this.unindexConnections();
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
    this.indexConnections();

    // we need to clear storage because a drive may have been removed
    // these will be updated the next time their get function is called
    this.storedItems = undefined;
    this.storedItemDisks = undefined;
    this.savedDiskContents = undefined;
    this.storedFluids = undefined;

    // the connected drives (and therefore the stored items) may have changed
    this.markStoredItemsChanged();

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
    this.savedDiskContents = undefined;
    this.markStoredItemsChanged();
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
   * Gets the fluids stored across the network, aggregated over every fluid
   * drive. The result is cached until {@link StorageNetwork.clearStoredFluidsCache}
   * (or a connections update) clears it.
   * @returns the network's stored fluids
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
   * @returns the total fluid capacity across all of the network's fluid drives
   */
  getFluidStorageCapacity(): number {
    return FLUID_DRIVE_CAPACITY * this.connections.fluidDrives.length;
  }

  /**
   * @returns the energy currently stored across the network's power banks, as
   *   of the last {@link StorageNetwork.standardTick}
   */
  getStoredEnergy(): number {
    return this.storedEnergy;
  }

  /**
   * @returns the energy demand the network could not meet on the last
   *   {@link StorageNetwork.standardTick}; `0` when fully powered or when energy
   *   use is disabled
   */
  getUnmetEnergyDemand(): number {
    return this.unmetEnergyDemand;
  }

  /**
   * @returns the maximum energy the network can store across all of its power banks
   */
  getMaxStoredEnergy(): number {
    return 6400 * this.connections.powerBanks.length;
  }

  /**
   * @returns energy consumption per {@link STORAGE_NETWORK_STANDARD_TICK_INTERVAL}
   */
  getEnergyConsumption(): number {
    return (
      deviceEnergyConsumptionRule.safeGet(world) *
      (this.connections.buses.length +
        this.connections.fluidDrives.length +
        this.connections.levelEmitters.length +
        this.connections.storageDrives.length)
    );
  }

  /**
   * @returns a read-only view of this network's discovered connections (cables,
   *   drives, buses, etc.)
   */
  getConnections(): DeepReadonly<CableNetworkConnections> {
    return this.connections;
  }

  /**
   * Adds an item stack to the in-memory {@link StorageNetwork.storedItems} map
   * without persisting to disk. Distributes the incoming amount across existing
   * matching stacks before creating new slots. All-or-nothing: if the full
   * amount does not fit, nothing is added.
   *
   * Callers must have populated the cache via
   * {@link StorageNetwork.getStoredItemStacks} and are responsible for
   * persisting afterwards via {@link StorageNetwork.saveStoredItemData}.
   * @param storedItems the cached stored items map to mutate
   * @param capacity the network's total item slot capacity
   * @param itemStack the item stack to add
   */
  private addItemStackToMemory(
    storedItems: Map<string, ItemStack>,
    capacity: number,
    itemStack: ItemStack,
  ): Result<void, AddItemStackToStorageError> {
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

    const freeSlots = capacity - storedItems.size;
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

    return ok();
  }

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

    // storedItemDisks is guaranteed to be set after a successful
    // getStoredItemStacks; use it to avoid re-scanning the drives for capacity.
    const capacity = this.computeItemSlotsCapacity(this.storedItemDisks!);

    const result = this.addItemStackToMemory(storedItems, capacity, itemStack);
    if (result.isErr()) {
      return result;
    }

    const saveResult = await this.saveStoredItemData();
    if (saveResult.isErr()) {
      return err({
        type: "unknownError",
        message: `An unknown error occurred while saving stored item data: ${saveResult.error.message}`,
      });
    }

    this.markStoredItemsChanged();

    return ok();
  };

  /**
   * Adds multiple item stacks to storage, persisting to disk only once after
   * all of them have been added. Each stack is added all-or-nothing (see
   * {@link StorageNetwork.addItemStack}); adding stops at the first stack that
   * does not fit.
   * @param itemStacks the item stacks to add, in order
   * @returns a result containing the number of stacks that were fully added
   *   (always a prefix of `itemStacks`), or an error if saving failed
   * @throws if this object is not valid
   */
  async addItemStacks(
    itemStacks: readonly ItemStack[],
  ): Promise<Result<number, AddItemStackToStorageError>> {
    this.ensureValidity();

    const storedItemsr = await this.getStoredItemStacks();
    if (storedItemsr.isErr()) {
      return err({
        type: "unknownError",
        message: `An unknown error occurred while getting stored item stacks: ${storedItemsr.error}`,
      });
    }
    const storedItems = storedItemsr.value;

    // storedItemDisks is guaranteed to be set after a successful
    // getStoredItemStacks; use it to avoid re-scanning the drives for capacity.
    const capacity = this.computeItemSlotsCapacity(this.storedItemDisks!);

    let addedCount = 0;
    for (const itemStack of itemStacks) {
      const result = this.addItemStackToMemory(
        storedItems,
        capacity,
        itemStack,
      );
      if (result.isErr()) break;
      addedCount++;
    }

    if (!addedCount) {
      return ok(0);
    }

    const saveResult = await this.saveStoredItemData();
    if (saveResult.isErr()) {
      return err({
        type: "unknownError",
        message: `An unknown error occurred while saving stored item data: ${saveResult.error.message}`,
      });
    }

    this.markStoredItemsChanged();

    return ok(addedCount);
  }

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

    const saveResult = await this.saveStoredItemData();
    if (saveResult.isErr()) {
      return err({
        type: "unknownError",
        message: `An unknown error occurred while saving stored item data: ${saveResult.error.message}`,
      });
    }

    this.markStoredItemsChanged();

    return ok(removed);
  };
}
