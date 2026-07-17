/**
 * The fluid interface machine: a block that lets a player view the fluids
 * stored on its {@link StorageNetwork} through a paged set of storage bars.
 *
 * This module wires up three things:
 * - {@link fluidInterfaceMachine}: the Bedrock Energistics Core (BEC) machine
 *   definition (UI layout, button handling, and the `updateUi` refresh).
 * - {@link fluidInterfaceComponent}: the block component that keeps the block's
 *   visual connection states in sync with its neighbours.
 * - World event subscriptions + an interval that mirror the network's fluids
 *   into the interface entity's BEC machine storage so the bars render, and
 *   track which interfaces are currently open.
 */

import {
  Block,
  BlockCustomComponent,
  Entity,
  Player,
  system,
  world,
} from "@minecraft/server";
import {
  getMachineStorage,
  MachineDefinition,
  RegisteredStorageType,
  setMachineStorage,
} from "bedrock-energistics-core-api";
import { StorageNetwork } from "./storage_network";
import { getNetworkOrShowError, createErrorMessageForm } from "./utils/ui";
import { forceCloseStorageViewerInventory } from "./storage_ui/shared";
import {
  BACK_BUTTON_ITEM_ID,
  getPageNumberItemStacks,
  NEXT_BUTTON_ITEM_ID,
} from "./storage_ui/shared";
import { STR_DIRECTIONS, StrCardinalDirection } from "./utils/direction";
import {
  busUpdateBlockConnectStatesTransformer,
  updateBlockConnectStates,
} from "./utils/block_connect";

/** Number of fluid storage bars shown on a single page of the interface UI. */
const STORAGE_BARS_PER_PAGE = 5;

/**
 * Tracks the currently-open fluid interfaces and the page each is viewing.
 *
 * key = interface entity ID
 * value = current page number (0-based)
 *
 * This map does double duty: an entry existing also means "this interface is
 * open", so it also drives which entities {@link setStorageBars} refreshes on
 * the interval at the bottom of this file. Entries are added by the
 * `entityContainerOpened` handler and removed by `entityContainerClosed` (and
 * defensively by the interval when the entity/block/network can no longer be
 * resolved).
 */
const fluidInterfacePages = new Map<string, number>();

/**
 * Writes the two page-number digit items into the interface entity's inventory
 * (fixed slots 22 and 23) so the UI shows the current page. See
 * {@link getPageNumberItemStacks} for how a page maps to its two digit items.
 */
function updatePageNumbers(entity: Entity, page: number): void {
  const inv = entity.getComponent("inventory")!.container;
  const pageNumItems = getPageNumberItemStacks(page);
  inv.setItem(22, pageNumItems[0]);
  inv.setItem(23, pageNumItems[1]);
}

/**
 * The BEC machine definition for the fluid interface.
 *
 * The storage bars have no fixed fluid type; {@link updateUi} decides which
 * fluid each bar shows for the current page every refresh.
 */
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
            itemId: BACK_BUTTON_ITEM_ID,
          },
        },
        nextBtn: {
          type: "button",
          index: 1,
          defaults: {
            itemId: NEXT_BUTTON_ITEM_ID,
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
      const page = fluidInterfacePages.get(e.entityId) ?? 0;

      // Back is clamped at page 0. Next is intentionally unbounded: the
      // page-number display caps at "99+" (see getPageNumberItemStacks) but the
      // network can hold more pages than that, so paging further is still valid.
      if (e.elementId === "backBtn") {
        fluidInterfacePages.set(e.entityId, Math.max(0, page - 1));
      } else if (e.elementId === "nextBtn") {
        fluidInterfacePages.set(e.entityId, page + 1);
      }
    },
  },
  handlers: {
    async updateUi({ blockLocation, entityId }) {
      const block = blockLocation.dimension.getBlock(blockLocation);
      if (!block) return {};

      const network = StorageNetwork.getNetwork(block);
      if (!network) return {};

      const page = fluidInterfacePages.get(entityId) ?? 0;

      const entity = world.getEntity(entityId);
      if (!entity) return {};

      updatePageNumbers(entity, page);

      // Collect up to STORAGE_BARS_PER_PAGE fluid types to show on this page.
      // Only types that currently have machine storage on this block count
      // (that storage is populated by setStorageBars). `count` walks every
      // eligible type so the ones belonging to earlier pages can be skipped.
      const types: string[] = [];

      let count = 0;
      for (const id of await RegisteredStorageType.getAllIds()) {
        if (!getMachineStorage(blockLocation, id)) continue;
        if (count++ < page * STORAGE_BARS_PER_PAGE) continue;

        types.push(id);
        if (types.length >= 5) break;
      }

      // No fluids on this page. Leave the bars empty.
      if (!types.length) return {};

      // Every bar shares the same max: the network's total fluid capacity.
      const max = network.getFluidStorageCapacity();

      // Assign the collected types to the five bars in order. When fewer than
      // five types fall on this page, the trailing bars get `type: undefined`,
      // which BEC treats as "_disabled" and hides - so partial pages render
      // correctly without any explicit handling here.
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

/**
 * Block component for the fluid interface. On every block tick it recomputes
 * which of the block's faces are visually "connected", so the model shows a
 * pipe/connection on any side touching a storage-network-connectable block.
 *
 * The block is directional, so the raw directions are rotated by
 * {@link busUpdateBlockConnectStatesTransformer} to match the block's facing
 * before the `fluffyalien_asn:<direction>` states are set.
 */
export const fluidInterfaceComponent: BlockCustomComponent = {
  onTick(e) {
    const cardinalDirection = e.block.permutation.getState(
      "minecraft:cardinal_direction",
    ) as StrCardinalDirection;

    updateBlockConnectStates(
      e.block,
      STR_DIRECTIONS,
      (other) => other.hasTag("fluffyalien_asn:storage_network_connectable"),
      busUpdateBlockConnectStatesTransformer(cardinalDirection),
    );
  },
};

/**
 * Mirrors the network's stored fluids into the interface block's BEC machine
 * storage so the storage bars have data to render. Called on open and on the
 * refresh interval.
 *
 * Every fluid storage type is reconciled - including ones no longer stored,
 * which are written back as 0 - so a fully-drained fluid's bar doesn't keep
 * displaying a stale value. (getStoredFluids omits zero amounts, so iterating
 * it alone would never clear a drained type.) Energy is not a fluid and is
 * tracked separately, so it is skipped. Values already equal to their target
 * are left alone to avoid redundant writes every tick.
 */
async function setStorageBars(
  block: Block,
  network: StorageNetwork,
): Promise<void> {
  const storedFluids = (await network.getStoredFluids()).types;

  for (const id of await RegisteredStorageType.getAllIds()) {
    if (id === "energy") continue;

    const amount = storedFluids.get(id) ?? 0;
    if (getMachineStorage(block, id) !== amount) {
      void setMachineStorage(block, id, amount);
    }
  }
}

// When a player opens a fluid interface, seed its storage bars from the network
// and mark it open (page 0). If the network can't be established the helper
// shows the error and force-closes; if the network is under-powered we close
// the UI and show an "insufficient energy" message instead.
world.afterEvents.entityContainerOpened.subscribe(
  (e) => {
    const target = e.entity;
    const player = e.openSource.entity as Player;

    const block = target.dimension.getBlock(target.location);
    if (!block) {
      return;
    }

    // Mark the interface open (page 0) synchronously, before any await. If the
    // player closes it while the network is still being established,
    // entityContainerClosed then removes this entry - preventing a "ghost open"
    // interface that the refresh interval would otherwise keep updating forever.
    fluidInterfacePages.set(target.id, 0);

    void getNetworkOrShowError(block, target, player).then(async (network) => {
      // Network couldn't be established (an error was already shown and the UI
      // force-closed); stop tracking this interface.
      if (!network) {
        fluidInterfacePages.delete(target.id);
        return;
      }

      if (network.getUnmetEnergyDemand() > 0) {
        fluidInterfacePages.delete(target.id);
        await forceCloseStorageViewerInventory(target);
        void createErrorMessageForm({
          translate:
            "fluffyalien_asn.ui.storageInterface.error.insufficientEnergy",
        }).show(player);
        return;
      }

      void setStorageBars(block, network);
    });
  },
  {
    entityFilter: { type: "fluffyalien_asn:fluid_interface" },
    accessSourceFilter: { entityFilter: { type: "minecraft:player" } },
  },
);

// When the interface is closed, stop tracking it (and stop refreshing its bars).
world.afterEvents.entityContainerClosed.subscribe(
  (e) => {
    fluidInterfacePages.delete(e.entity.id);
  },
  {
    entityFilter: { type: "fluffyalien_asn:fluid_interface" },
  },
);

// Keep the bars of every open interface live: network fluids change over time,
// so re-mirror them into machine storage every 10 ticks. This loop also cleans
// up entries whose entity, block, or network can no longer be resolved.
system.runInterval(() => {
  for (const entityId of fluidInterfacePages.keys()) {
    const entity = world.getEntity(entityId);
    if (!entity) {
      fluidInterfacePages.delete(entityId);
      continue;
    }

    const block = entity.dimension.getBlock(entity.location);
    if (!block) {
      fluidInterfacePages.delete(entityId);
      continue;
    }

    const network = StorageNetwork.getNetwork(block);
    if (!network) {
      fluidInterfacePages.delete(entityId);
      continue;
    }

    void setStorageBars(block, network);
  }
}, 10);
