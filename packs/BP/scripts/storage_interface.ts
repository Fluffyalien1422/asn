import { BlockCustomComponent, Player, world } from "@minecraft/server";
import { STR_DIRECTIONS, StrCardinalDirection } from "./utils/direction";
import {
  busUpdateBlockConnectStatesTransformer,
  updateBlockConnectStates,
} from "./utils/block_connect";
import { logWarn } from "./log";
import { refreshStorageViewerOrLog } from "./storage_ui";
import {
  getNetworkOrShowError,
  createErrorMessageForm,
  showForm,
} from "./utils/ui";
import { forceCloseStorageViewerInventory } from "./storage_ui/shared";
import {
  disableStorageViewer,
  drainStorageViewerInput,
} from "./storage_ui/storage";

export const storageInterfaceComponent: BlockCustomComponent = {
  onPlace(e) {
    if (e.previousBlock.type.id === e.block.typeId) return;
    e.block.dimension.spawnEntity("fluffyalien_asn:storage_interface_entity", {
      x: e.block.x + 0.5,
      y: e.block.y,
      z: e.block.z + 0.5,
    }).nameTag = e.block.typeId;
  },
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
  onPlayerInteract(e) {
    if (!e.player) return;
    e.player.sendMessage({
      rawtext: [
        {
          text: "§c",
        },
        {
          translate: "fluffyalien_asn.message.storageInterface.alreadyOpen",
        },
      ],
    });
  },
};

world.afterEvents.entityContainerOpened.subscribe(
  (e) => {
    const target = e.entity;
    const player = e.openSource.entity as Player;

    const block = target.dimension.getBlock(target.location);
    if (!block) {
      logWarn(
        `Expected a storage interface block at (${target.location.x.toString()}, ${target.location.y.toString()}, ${target.location.z.toString()}) in ${target.dimension.id}.`,
      );
      return;
    }

    target.triggerEvent("fluffyalien_asn:block_interactions");

    void (async (): Promise<void> => {
      const network = await getNetworkOrShowError(block, target, player);
      if (!network) return;

      if (network.getUnmetEnergyDemand() > 0) {
        await forceCloseStorageViewerInventory(target);
        void showForm(
          createErrorMessageForm({
            translate:
              "fluffyalien_asn.ui.storageInterface.error.insufficientEnergy",
          }),
          player,
        );
        return;
      }

      refreshStorageViewerOrLog(target, player, network);
    })();
  },
  {
    accessSourceFilter: { entityFilter: { type: "minecraft:player" } },
    entityFilter: { type: "fluffyalien_asn:storage_interface_entity" },
  },
);

world.afterEvents.entityContainerClosed.subscribe(
  (e) => {
    // Deposits are only noticed by the interaction poll, and disabling the
    // viewer stops it, so store anything deposited since the last poll now.
    // Otherwise it is stranded in the container and destroyed the next time the
    // viewer is filled.
    drainStorageViewerInput(e.entity);
    disableStorageViewer(e.entity);
    e.entity.triggerEvent("fluffyalien_asn:allow_interactions");
  },
  {
    entityFilter: { type: "fluffyalien_asn:storage_interface_entity" },
  },
);
