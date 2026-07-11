/**
 * Disk Upgrader: a Bedrock Energistics Core machine that upgrades a storage disk
 * to a larger-capacity disk without resetting its contents.
 *
 * The UI is a crafting-table-like layout: a 3x3 input grid, a progress arrow,
 * and a single output slot. A configured {@link DiskUpgradeRecipe} is matched
 * against the grid like a shaped recipe; once enough energy has been spent, the
 * disk in the recipe's "disk cell" is consumed and a result disk that shares its
 * stored data (via {@link upgradeDisk}) is produced in the output.
 *
 * The grid and output are real slots in the machine entity's inventory, accessed
 * directly rather than through Bedrock Energistics Core's item slot API. This is
 * required to preserve the disk's `disk_id` dynamic property: a `MachineItemStack`
 * only carries type/amount/name/damage/lore/enchantments, so routing the disk
 * through it would strip the id and break the data transfer.
 */
import {
  Block,
  BlockCustomComponent,
  Container,
  ContainerSlot,
  Entity,
} from "@minecraft/server";
import {
  getMachineStorage,
  MachineDefinition,
  setMachineStorage,
} from "bedrock-energistics-core-api";
import { getEntityAtBlockLocation } from "./utils/location";
import { getBlockUid } from "./utils/block";
import { logWarn } from "./log";
import { upgradeDisk } from "./storage_disk_v3";
import { useEnergyRule } from "./addon_rules/addon_rules";

const MACHINE_ID = "fluffyalien_asn:disk_upgrader";

// Machine entity inventory layout. Slots 0-3 hold the energy bar (a Bedrock
// Energistics Core storageBar element); the rest are real item slots.
const GRID_START_INDEX = 4;
const GRID_SIZE = 9;
const ARROW_INDEX = 13;
const OUTPUT_INDEX = 14;

/** Energy spent per progress step. */
const ENERGY_PER_STEP = 20;
/**
 * Progress steps required to finish one upgrade. Also the number of frames in
 * the "arrow" progress indicator, so progress maps directly to the arrow frame.
 */
const MAX_PROGRESS = 16;

/**
 * A configurable disk upgrade recipe. The 3x3 input grid is matched like a
 * shaped crafting recipe; the disk in the {@link DiskUpgradeRecipe.diskCell}
 * slot has its stored data transferred to the {@link DiskUpgradeRecipe.result}.
 */
interface DiskUpgradeRecipe {
  /** Shaped 3x3 pattern: three rows of exactly three cells each; `" "` is empty. */
  pattern: [string, string, string];
  /** Maps each non-space pattern cell to the item type id required there. */
  key: Record<string, string>;
  /** The pattern cell holding the disk whose contents are transferred. */
  diskCell: string;
  /** The item type produced in the output slot. */
  result: string;
}

/**
 * The disk upgrade recipes. Edit this to configure what the machine accepts and
 * produces. Each recipe is matched against the 3x3 grid like a shaped crafting
 * recipe: the pattern maps directly onto the grid and empty cells must be empty.
 */
const DISK_UPGRADE_RECIPES: DiskUpgradeRecipe[] = [
  {
    // prettier-ignore
    pattern: [
      "BQB",
      "QDQ",
      "BQB"
    ],
    diskCell: "D",
    key: {
      D: "fluffyalien_asn:storage_disk_v3_32",
      B: "minecraft:blaze_powder",
      Q: "minecraft:quartz",
    },
    result: "fluffyalien_asn:storage_disk_v3_64",
  },
];

/** Progress (0..{@link MAX_PROGRESS}) per machine, keyed by block uid. */
const progressMap = new Map<string, number>();
/** Block uids whose upgrade is being finalized, to prevent re-entry. */
const finalizing = new Set<string>();

/** The grid cell character at flat index `i` (0..8) of a recipe pattern. */
function patternCell(recipe: DiskUpgradeRecipe, i: number): string {
  return recipe.pattern[Math.floor(i / 3)][i % 3];
}

/**
 * Whether `recipe` matches the machine's 3x3 grid: every keyed cell holds the
 * required item and every empty cell is empty.
 */
function recipeMatches(
  container: Container,
  recipe: DiskUpgradeRecipe,
): boolean {
  for (let i = 0; i < GRID_SIZE; i++) {
    const cell = patternCell(recipe, i);
    const item = container.getItem(GRID_START_INDEX + i);
    if (cell === " ") {
      if (item) return false;
    } else if (item?.typeId !== recipe.key[cell]) {
      return false;
    }
  }
  return true;
}

function findMatchingRecipe(
  container: Container,
): DiskUpgradeRecipe | undefined {
  return DISK_UPGRADE_RECIPES.find((recipe) =>
    recipeMatches(container, recipe),
  );
}

/** The grid slot index holding `recipe`'s disk. */
function diskSlotIndex(recipe: DiskUpgradeRecipe): number {
  return GRID_START_INDEX + recipe.pattern.join("").indexOf(recipe.diskCell);
}

function decrementSlot(slot: ContainerSlot): void {
  if (slot.amount <= 1) {
    slot.setItem();
  } else {
    slot.amount -= 1;
  }
}

/**
 * Consumes the recipe's ingredients and produces the upgraded disk. Re-validates
 * the grid before and after the (asynchronous) disk read so nothing is created
 * or destroyed if the player changes the grid mid-upgrade.
 */
async function finalizeUpgrade(
  entity: Entity,
  recipe: DiskUpgradeRecipe,
): Promise<void> {
  const container = entity.getComponent("inventory")!.container;

  if (!recipeMatches(container, recipe) || container.getItem(OUTPUT_INDEX)) {
    return;
  }

  const sourceDisk = container.getItem(diskSlotIndex(recipe));
  if (!sourceDisk) return;

  const resultr = await upgradeDisk(sourceDisk, recipe.result);
  if (resultr.isErr()) {
    logWarn(resultr.error.message);
    return;
  }

  // Re-check after the await, since the player may have changed the grid.
  if (!recipeMatches(container, recipe) || container.getItem(OUTPUT_INDEX)) {
    return;
  }

  for (let i = 0; i < GRID_SIZE; i++) {
    if (patternCell(recipe, i) === " ") continue;
    decrementSlot(container.getSlot(GRID_START_INDEX + i));
  }

  container.setItem(OUTPUT_INDEX, resultr.value);
}

function tick(block: Block): void {
  const uid = getBlockUid(block);
  if (finalizing.has(uid)) return;

  const entity = getEntityAtBlockLocation(block, MACHINE_ID);
  if (!entity) return;
  const container = entity.getComponent("inventory")!.container;

  const recipe = findMatchingRecipe(container);
  // result disks are unstackable, so the output must be empty to produce one.
  if (!recipe || container.getItem(OUTPUT_INDEX)) {
    progressMap.delete(uid);
    return;
  }

  const progress = progressMap.get(uid) ?? 0;

  if (progress >= MAX_PROGRESS) {
    // energy was already spent over the progress steps; finalize.
    progressMap.delete(uid);
    finalizing.add(uid);
    void finalizeUpgrade(entity, recipe).finally(() => finalizing.delete(uid));
    return;
  }

  if (useEnergyRule.safeGet()) {
    const storedEnergy = getMachineStorage(block, "energy");
    if (storedEnergy < ENERGY_PER_STEP * (MAX_PROGRESS - progress)) return;
    void setMachineStorage(block, "energy", storedEnergy - ENERGY_PER_STEP);
  }
  progressMap.set(uid, progress + 1);
}

export const diskUpgraderComponent: BlockCustomComponent = {
  onTick(e) {
    tick(e.block);
  },
};

export const diskUpgraderMachine: MachineDefinition = {
  description: {
    id: MACHINE_ID,
    persistentEntity: true,
    ui: {
      elements: {
        energyBar: {
          type: "storageBar",
          startIndex: 0,
        },
        arrow: {
          type: "progressIndicator",
          indicator: "arrow",
          index: ARROW_INDEX,
        },
      },
    },
  },
  handlers: {
    updateUi({ blockLocation }) {
      const useEnergy = useEnergyRule.safeGet();
      return {
        progressIndicators: {
          arrow: progressMap.get(getBlockUid(blockLocation)) ?? 0,
        },
        storageBars: {
          energyBar: {
            type: useEnergy ? "energy" : "_disabled",
            label: useEnergy ? undefined : "Energy usage disabled.",
          },
        },
      };
    },
  },
};

/**
 * Drops the machine's grid and output items into the world at `entity`'s
 * location, so they aren't lost when the machine is broken. Used by the shared
 * persistent-entity break handler.
 */
export function dropDiskUpgraderContents(entity: Entity): void {
  const container = entity.getComponent("inventory")!.container;
  for (let i = GRID_START_INDEX; i < GRID_START_INDEX + GRID_SIZE; i++) {
    const item = container.getItem(i);
    if (item) {
      entity.dimension.spawnItem(item, entity.location);
    }
  }
  const output = container.getItem(OUTPUT_INDEX);
  if (output) {
    entity.dimension.spawnItem(output, entity.location);
  }
}
