import {
  Entity,
  ItemLockMode,
  Player,
  Vector3,
  system,
  world,
} from "@minecraft/server";
import { DynamicPropertyAccessor } from "./utils/dynamic_property";
import {
  forceLoadNetworksRule,
  useEnergyRule,
  wirelessInterfaceEnergyConsumptionRule,
  wirelessInterfaceRangeRule,
} from "./addon_rules/addon_rules";
import { StorageNetwork } from "./storage_network";
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
    let holdingWirelessInterface = false;

    // we need to unlock the slots if they player is not holding it
    // the slot is locked when the player interacts with the entity
    // see [#32](https://github.com/Fluffyalien1422/asn/issues/32)
    const playerInv = player.getComponent("inventory")!.container!;
    for (let i = 0; i < playerInv.size; i++) {
      const slot = playerInv.getSlot(i);
      if (
        !slot.hasItem() ||
        slot.typeId !== "fluffyalien_asn:wireless_interface"
      ) {
        continue;
      }

      if (i === player.selectedSlotIndex) {
        holdingWirelessInterface = true;
        continue;
      }

      slot.lockMode = ItemLockMode.none;
    }

    if (
      !holdingWirelessInterface ||
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
  if (
    !mainHandSlot.getItem() ||
    mainHandSlot.typeId !== "fluffyalien_asn:wireless_interface"
  ) {
    removeWirelessInterfaceEntity(e.player, e.target);
    return;
  }

  // we need to lock the slot so the player can't put it inside itself and it will disappear.
  // see [#32](https://github.com/Fluffyalien1422/asn/issues/32)
  mainHandSlot.lockMode = ItemLockMode.slot;

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

      const energyConsumption =
        wirelessInterfaceEnergyConsumptionRule.get(world);

      if (storedEnergy < energyConsumption) {
        errInsufficientEnergy();
        return;
      }

      itemMachine.setStorage(
        StandardStorageType.Energy,
        storedEnergy - energyConsumption,
      );
    }

    refreshStorageViewer(e.target, e.player, network);
  })();
});
