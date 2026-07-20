/**
 * Fluid storage disk persistence.
 *
 * A fluid disk is an {@link ItemStack} whose stored fluids live directly on the
 * item via the Bedrock Energistics Core (BEC) item machine API: the disk item
 * type is registered with `registerItemMachine` (see `energistics.ts`), and each
 * fluid type's amount is read/written through {@link ItemMachine.getStorage} /
 * {@link ItemMachine.setStorage}. BEC persists those amounts on the item itself,
 * so a disk's fluids travel with it when it is moved between containers (the same
 * mechanism the wireless interface uses to store energy).
 *
 * Because fluids are numeric per-type amounts (unlike the item storage disks,
 * which hold whole {@link ItemStack}s), fluid disks need no backing structure,
 * hidden entity, or shared data-location: reading/writing is a direct BEC call
 * against the slot the disk sits in.
 *
 * A disk also carries a small `fluffyalien_asn:fluid_disk_id` dynamic property
 * used only as a swap-detection signature by the fluid drive (see
 * {@link getFluidDiskSignature}). Unlike the item disks' `fresh:` fallback, every
 * fluid disk is assigned an id: a disk's fluid contents can't be read
 * synchronously (BEC reads are async), so the drive can't cheaply tell two
 * same-type disks apart by contents; giving each disk a unique id lets the drive
 * detect any insert/remove/swap from the per-slot id alone.
 */

import {
  ContainerSlot,
  EntityInventoryComponent,
  ItemStack,
  RawMessage,
  world,
} from "@minecraft/server";
import {
  ItemMachine,
  RegisteredStorageType,
} from "bedrock-energistics-core-api";
import { DynamicPropertyAccessor } from "./utils/dynamic_property_v3";
import { abbreviateNumber } from "./utils/string";

/** The two caps a fluid disk enforces. */
export interface FluidDiskCapacity {
  /** Maximum total fluid volume the disk can hold, across all types. */
  maxTotal: number;
  /** Maximum number of distinct fluid types the disk can hold. */
  maxTypes: number;
}

/** Capacity of each fluid storage disk item type. */
const FLUID_DISK_CAPACITIES: Record<string, FluidDiskCapacity> = {
  "fluffyalien_asn:fluid_storage_disk": {
    maxTotal: 6400,
    maxTypes: 4,
  },
  "fluffyalien_asn:high_capacity_fluid_storage_disk": {
    maxTotal: 12800,
    maxTypes: 8,
  },
};

/**
 * Gets the capacity of a fluid disk by its type id, or `undefined` if the type
 * id is not a known fluid storage disk.
 */
export function getFluidDiskCapacity(
  typeId: string,
): FluidDiskCapacity | undefined {
  return FLUID_DISK_CAPACITIES[typeId];
}

/** The fluid disk item type ids, for registering them as BEC item machines. */
export const FLUID_DISK_ITEM_IDS: readonly string[] = Object.keys(
  FLUID_DISK_CAPACITIES,
);

/**
 * The disk's swap-detection id, stored as a dynamic property on the disk
 * ItemStack. See the module doc for why every fluid disk gets one.
 */
const fluidDiskIdProperty = new DynamicPropertyAccessor<string>(
  "fluffyalien_asn:fluid_disk_id",
);

/** World-backed monotonic counter used to mint unique fluid disk ids. */
const NEXT_FLUID_DISK_ID_PROP = "fluffyalien_asn:next_fluid_disk_id";

/** Mints a new, world-unique fluid disk id. */
function nextFluidDiskId(): string {
  const current =
    (world.getDynamicProperty(NEXT_FLUID_DISK_ID_PROP) as number | undefined) ??
    0;
  world.setDynamicProperty(NEXT_FLUID_DISK_ID_PROP, current + 1);
  return current.toString();
}

/** Gets a disk's swap-detection id, or `undefined` if it has none yet. */
export function getFluidDiskId(
  disk: ContainerSlot | ItemStack,
): string | undefined {
  return fluidDiskIdProperty.safeGet(disk);
}

/**
 * Returns a stable per-disk signature for swap detection, assigning the disk a
 * unique id if it does not have one yet. Two distinct disks always have distinct
 * signatures, so the fluid drive can detect any insert/remove/swap by comparing
 * a slot's signature across ticks.
 */
export function getFluidDiskSignature(disk: ContainerSlot): string {
  const existing = fluidDiskIdProperty.safeGet(disk);
  if (existing !== undefined) return existing;

  const id = nextFluidDiskId();
  fluidDiskIdProperty.set(disk, id);
  return id;
}

/**
 * Gets the ids of every registered storage type that a fluid disk may hold, i.e.
 * every registered type except `energy`.
 */
export async function getFluidStorageTypeIds(): Promise<string[]> {
  const ids = await RegisteredStorageType.getAllIds();
  return ids.filter((id) => id !== "energy");
}

/**
 * Reads the fluids currently stored on a disk, keyed by storage type id. Only
 * types with a positive amount are included. Returns an empty map if the disk's
 * item machine is missing or goes stale mid-read (e.g. the disk was pulled out).
 *
 * @param typeIds the storage type ids to query, from {@link getFluidStorageTypeIds}
 */
export async function readDiskFluids(
  inventory: EntityInventoryComponent,
  slot: number,
  typeIds: readonly string[],
): Promise<Map<string, number>> {
  const fluids = new Map<string, number>();

  let itemMachine: ItemMachine;
  try {
    itemMachine = new ItemMachine(inventory, slot);
  } catch {
    return fluids;
  }

  for (const type of typeIds) {
    if (!itemMachine.isValid()) break;
    try {
      const amount = await itemMachine.getStorage(type);
      if (amount > 0) fluids.set(type, amount);
    } catch {
      // storage type unavailable on this item; treat as empty.
    }
  }

  return fluids;
}

/**
 * Writes fluid amounts to a disk. Sets each type in `fluids` to its amount, and
 * zeroes any type that was in `previousFluids` but is no longer present, so
 * drained types don't linger. Best-effort: silently skips if the disk's item
 * machine is missing or goes stale mid-write.
 */
export function writeDiskFluids(
  inventory: EntityInventoryComponent,
  slot: number,
  fluids: ReadonlyMap<string, number>,
  previousFluids: ReadonlyMap<string, number>,
): void {
  let itemMachine: ItemMachine;
  try {
    itemMachine = new ItemMachine(inventory, slot);
  } catch {
    return;
  }

  for (const type of previousFluids.keys()) {
    if (fluids.has(type)) continue;
    if (!itemMachine.isValid()) return;
    try {
      itemMachine.setStorage(type, 0);
    } catch {
      /* stale slot; skip */
    }
  }

  for (const [type, amount] of fluids) {
    if (!itemMachine.isValid()) return;
    try {
      itemMachine.setStorage(type, amount);
    } catch {
      /* stale slot; skip */
    }
  }
}

/**
 * Updates a disk's lore tooltip to summarize its stored fluids: a header line
 * with used/total volume and type count, followed by one line per stored fluid.
 * Clears the lore if the disk is empty.
 */
export async function setFluidDiskLore(
  disk: ContainerSlot,
  fluids: ReadonlyMap<string, number>,
): Promise<void> {
  const capacity = getFluidDiskCapacity(disk.typeId);
  if (!capacity || !fluids.size) {
    disk.setLore();
    return;
  }

  let total = 0;
  for (const amount of fluids.values()) total += amount;

  const typeLines: RawMessage[] = [];
  for (const [type, amount] of fluids) {
    const registered = await RegisteredStorageType.get(type);
    typeLines.push(
      { text: `\n§r§7${abbreviateNumber(amount)} ` },
      registered ? { text: registered.name } : { text: type },
    );
  }

  disk.setLore([
    {
      rawtext: [
        {
          text: `§r§7${abbreviateNumber(total)}/${abbreviateNumber(capacity.maxTotal)} (${fluids.size.toString()}/${capacity.maxTypes.toString()} types)`,
        },
        ...typeLines,
      ],
    },
  ]);
}
