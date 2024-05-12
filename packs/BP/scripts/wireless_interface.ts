import { Entity, Vector3, system, world } from "@minecraft/server";
import { MinecraftDimensionTypes } from "@minecraft/vanilla-data";
import { DynamicProperty } from "./dynamic_property";
import { forceLoadNetworksRule } from "./addon_rules";
import {
  addAnonymousTickingArea,
  removeAnonymousTickingArea,
} from "./tickingarea";
import { StorageNetwork } from "./storage_network";
import { getPlayerMainhandSlot } from "./utils/item";
import { VECTOR3_UP, Vector3Utils } from "@minecraft/math";
import { forceCloseInventory, refreshInterface } from "./storage_interface";

/**
 * key = player ID
 * value = wireless interface entity
 */
const wirelessInterfaceEntities = new Map<string, Entity>();

export const wirelessInterfaceLinkLocationProperty =
  new DynamicProperty<Vector3>(
    "fluffyalien_asn:wireless_interface_link_location",
  );

export const wirelessInterfaceLinkDimensionProperty =
  new DynamicProperty<MinecraftDimensionTypes>(
    "fluffyalien_asn:wireless_interface_link_dimension",
  );

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    let entity = wirelessInterfaceEntities.get(player.id);

    const mainhandSlot = getPlayerMainhandSlot(player);
    if (
      !mainhandSlot.hasItem() ||
      mainhandSlot.typeId !== "fluffyalien_asn:wireless_interface" ||
      player.getBlockFromViewDirection({
        maxDistance: 7,
        blockFilter: { includeTypes: ["fluffyalien_asn:storage_core"] },
      })
    ) {
      if (entity) {
        wirelessInterfaceEntities.delete(player.id);
        entity.remove();
      }
      return;
    }

    if (!entity) {
      entity = player.dimension.spawnEntity(
        "fluffyalien_asn:wireless_interface_entity",
        player.location,
      );

      entity.nameTag = "fluffyalien_asn:storage_interface";

      wirelessInterfaceEntities.set(player.id, entity);
    }

    entity.teleport(Vector3Utils.add(player.location, VECTOR3_UP));
  }
});

world.afterEvents.playerInteractWithEntity.subscribe((e) => {
  if (e.target.typeId !== "fluffyalien_asn:wireless_interface_entity") return;

  const mainHandSlot = getPlayerMainhandSlot(e.player);
  if (!mainHandSlot.getItem()) {
    void forceCloseInventory(e.target);
    return;
  }

  if (!forceLoadNetworksRule.get()) {
    void forceCloseInventory(e.target);
    e.player.sendMessage({
      rawtext: [
        {
          text: "§c",
        },
        {
          translate:
            "fluffyalien_asn.message.wirelessInterface.forceLoadNetworksDisabled",
        },
      ],
    });
    return;
  }

  const linkLocation = wirelessInterfaceLinkLocationProperty.get(mainHandSlot);
  const linkDimension =
    wirelessInterfaceLinkDimensionProperty.get(mainHandSlot);

  if (!linkLocation || !linkDimension) {
    void forceCloseInventory(e.target);
    e.player.sendMessage({
      rawtext: [
        {
          text: "§c",
        },
        {
          translate: "fluffyalien_asn.message.wirelessInterface.notLinked",
        },
      ],
    });
    return;
  }

  function sendLinkedNetworkNotFound(): void {
    void forceCloseInventory(e.target);
    e.player.sendMessage({
      rawtext: [
        {
          text: "§c",
        },
        {
          translate:
            "fluffyalien_asn.message.wirelessInterface.linkedNetworkNotFound",
        },
      ],
    });
  }

  void (async (): Promise<void> => {
    const dimension = world.getDimension(linkDimension);

    let block = dimension.getBlock(linkLocation);
    if (!block) {
      await addAnonymousTickingArea(dimension, linkLocation, 1);
      block = dimension.getBlock(linkLocation);
      removeAnonymousTickingArea(dimension, linkLocation);

      if (!block) {
        sendLinkedNetworkNotFound();
        return;
      }
    }

    if (block.typeId !== "fluffyalien_asn:storage_core") {
      sendLinkedNetworkNotFound();
      return;
    }

    const networkResult = await StorageNetwork.getOrEstablishNetwork(block);
    if (!networkResult.success) {
      sendLinkedNetworkNotFound();
      return;
    }

    const network = networkResult.value;

    refreshInterface(e.target, e.player, network);
  })();
});
