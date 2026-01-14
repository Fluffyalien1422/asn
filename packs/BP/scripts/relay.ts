import { StorageNetwork } from "./storage_network";
import { BlockCustomComponent, Entity, Player } from "@minecraft/server";
import { getEntityAtBlockLocation } from "./utils/location";
import { DynamicPropertyAccessor } from "./utils/dynamic_property";
import { ModalFormData } from "@minecraft/server-ui";
import { makeErrorMessageUi, showForm } from "./utils/ui";
import { logWarn } from "./log";
import { Vector3Utils } from "@minecraft/math";

export const relayName = DynamicPropertyAccessor.withoutDefault<string>(
  "fluffyalien_asn:relay_name",
);

async function showRelayUi(player: Player, relayEntity: Entity): Promise<void> {
  const form = new ModalFormData();
  form.title({ translate: "fluffyalien_asn.ui.relay.title" });

  form.textField({ translate: "fluffyalien_asn.ui.relay.name" }, "", {
    defaultValue: relayName.get(relayEntity),
  });

  const response = await showForm(form, player);
  if (!response.formValues) return;

  const name = response.formValues[0] as string;
  if (!name) {
    void showForm(
      makeErrorMessageUi({
        translate: "fluffyalien_asn.ui.relay.error.invalidName",
      }),
      player,
    );
    return;
  }

  relayName.set(relayEntity, name);
}

export const storageRelayComponent: BlockCustomComponent = {
  onPlace(e) {
    if (e.previousBlock.type.id === e.block.typeId) return;

    e.block.dimension.spawnEntity("fluffyalien_asn:relay_entity", {
      x: e.block.x + 0.5,
      y: e.block.y,
      z: e.block.z + 0.5,
    });
  },
  onPlayerBreak(e) {
    getEntityAtBlockLocation(e.block, "fluffyalien_asn:relay_entity")?.remove();
  },
  onPlayerInteract(e) {
    if (!e.player) return;

    const entity = getEntityAtBlockLocation(
      e.block,
      "fluffyalien_asn:relay_entity",
    );
    if (!entity) {
      logWarn(
        `could not get relay entity at ${Vector3Utils.toString(e.block.location)} in ${e.block.dimension.id} to process interaction`,
      );
      return;
    }

    void showRelayUi(e.player, entity).then(() => {
      void StorageNetwork.getNetwork(e.block)?.updateConnections();
    });
  },
};
