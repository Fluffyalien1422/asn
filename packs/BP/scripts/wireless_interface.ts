import { Entity, Player, Vector3, system, world } from "@minecraft/server";
import { DynamicPropertyAccessor } from "./utils/dynamic_property";
import {
  forceLoadNetworksRule,
  useEnergyRule,
  wirelessInterfaceRangeRule,
} from "./addon_rules";
import { StorageNetwork } from "./storage_network";
import { getPlayerMainhandSlot } from "./utils/item";
import { VECTOR3_UP, Vector3Utils } from "@minecraft/math";
import { refreshStorageViewer } from "./storage_ui";
import { ItemMachine, StandardStorageType } from "bedrock-energistics-core-api";

/**
 * key = player ID
 * value = wireless interface entity
 */
const wirelessInterfaceEntities = new Map<string, Entity>();

export const wirelessInterfaceLinkLocationProperty =
  DynamicPropertyAccessor.withoutDefault<Vector3>(
    "fluffyalien_asn:wireless_interface_link_location",
  );

export const wirelessInterfaceLinkDimensionProperty =
  DynamicPropertyAccessor.withoutDefault<string>(
    "fluffyalien_asn:wireless_interface_link_dimension",
  );

function removeWirelessInterfaceEntity(player: Player, entity: Entity): void {
  wirelessInterfaceEntities.delete(player.id);
  entity.remove();
}

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    let entity = wirelessInterfaceEntities.get(player.id);

    const mainhandSlot = getPlayerMainhandSlot(player);
    if (
      !mainhandSlot.hasItem() ||
      mainhandSlot.typeId !== "fluffyalien_asn:wireless_interface" ||
      player.getBlockFromViewDirection({
        maxDistance: 7,
        includeTypes: ["fluffyalien_asn:storage_core"],
      })
    ) {
      if (entity) {
        removeWirelessInterfaceEntity(player, entity);
      }
      continue;
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

  const playerInv = e.player.getComponent("inventory")!;
  const playerInvContainer = playerInv.container!;
  const playerMainHandSlotIndex = e.player.selectedSlotIndex;

  const mainHandSlot = playerInvContainer.getSlot(e.player.selectedSlotIndex);
  if (!mainHandSlot.getItem()) {
    removeWirelessInterfaceEntity(e.player, e.target);
    return;
  }

  if (!forceLoadNetworksRule.get(world)) {
    removeWirelessInterfaceEntity(e.player, e.target);
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
    removeWirelessInterfaceEntity(e.player, e.target);
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

  function errLinkedNetworkNotFound(): void {
    removeWirelessInterfaceEntity(e.player, e.target);
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

  function errNoTransmittersInRange(): void {
    removeWirelessInterfaceEntity(e.player, e.target);
    e.player.sendMessage({
      rawtext: [
        {
          text: "§c",
        },
        {
          translate:
            "fluffyalien_asn.message.wirelessInterface.noTransmittersInRange",
        },
      ],
    });
  }

  function errInsufficientEnergy(): void {
    removeWirelessInterfaceEntity(e.player, e.target);
    e.player.sendMessage({
      rawtext: [
        {
          text: "§c",
        },
        {
          translate:
            "fluffyalien_asn.message.wirelessInterface.insufficientEnergy",
        },
      ],
    });
  }

  void (async (): Promise<void> => {
    const dimension = world.getDimension(linkDimension);

    const block = dimension.getBlock(linkLocation);
    if (block?.typeId !== "fluffyalien_asn:storage_core") {
      errLinkedNetworkNotFound();
      return;
    }

    const networkResult = await StorageNetwork.getOrEstablishNetwork(block);
    if (!networkResult.success) {
      errLinkedNetworkNotFound();
      return;
    }

    const network = networkResult.value;

    const maxDistance = wirelessInterfaceRangeRule.get(world);

    const anyTransmittersInRange =
      maxDistance === -1
        ? true
        : network
            .getConnections()
            .wirelessTransmitters.some(
              (transmitter) =>
                transmitter.dimension.id === e.player.dimension.id &&
                Vector3Utils.distance(
                  e.player.location,
                  transmitter.location,
                ) <= maxDistance,
            );

    if (!anyTransmittersInRange) {
      errNoTransmittersInRange();
      return;
    }

    if (useEnergyRule.get(world)) {
      // @ts-expect-error incompatible type
      const itemMachine = new ItemMachine(playerInv, playerMainHandSlotIndex);

      const storedEnergy = await itemMachine.getStorage(
        StandardStorageType.Energy,
      );

      if (storedEnergy < 10) {
        errInsufficientEnergy();
        return;
      }

      itemMachine.setStorage(StandardStorageType.Energy, storedEnergy - 10);
    }

    refreshStorageViewer(e.target, e.player, network);
  })();
});
