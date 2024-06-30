import { Block, Direction, Player, Vector3 } from "@minecraft/server";
import { Result, failure, success } from "./utils/result";
import { Vector3Utils } from "@minecraft/math";
import { ActionFormResponse } from "@minecraft/server-ui";
import { logWarn } from "./log";
import {
  addAnonymousTickingArea,
  removeAnonymousTickingArea,
} from "./utils/tickingarea";
import { forceLoadNetworksRule } from "./addon_rules";
import { getBlockInDirection } from "./utils/direction";
import { makeErrorMessageUi } from "./utils/ui";
import { getEntityAtBlockLocation } from "./utils/location";
import { relayName } from "./relay";

export interface CableNetworkConnections {
  cables: Vector3[];
  storageCore: Vector3;
  storageDrives: Vector3[];
  storageInterfaces: Vector3[];
  buses: Vector3[];
  levelEmitters: Vector3[];
}

export type DiscoverCableNetworkConnectionsError =
  | "multipleStorageCores"
  | "noStorageCore";

export async function discoverCableNetworkConnections(
  origin: Block,
): Promise<
  Result<CableNetworkConnections, DiscoverCableNetworkConnectionsError>
> {
  const visitedLocations: Vector3[] = [];
  const stack: Block[] = [];

  const cables: Vector3[] = [];
  const storageDrives: Vector3[] = [];
  const storageInterfaces: Vector3[] = [];
  const buses: Vector3[] = [];
  const levelEmitters: Vector3[] = [];
  let storageCore: Vector3 | undefined;

  async function handleBlock(
    block: Block,
  ): Promise<Result<null, DiscoverCableNetworkConnectionsError>> {
    if (
      !block.hasTag("fluffyalien_asn:storage_network_connectable") ||
      visitedLocations.some((vector) =>
        Vector3Utils.equals(block.location, vector),
      )
    ) {
      return success(null);
    }

    visitedLocations.push(block.location);
    stack.push(block);

    if (block.typeId === "fluffyalien_asn:storage_cable") {
      cables.push(block.location);

      return success(null);
    }

    if (block.typeId === "fluffyalien_asn:storage_core") {
      if (storageCore) {
        return failure("multipleStorageCores");
      }

      storageCore = block.location;
      return success(null);
    }

    if (block.typeId === "fluffyalien_asn:storage_drive") {
      storageDrives.push(block.location);
      return success(null);
    }

    if (block.typeId === "fluffyalien_asn:storage_interface") {
      storageInterfaces.push(block.location);
      return success(null);
    }

    if (block.typeId === "fluffyalien_asn:level_emitter") {
      levelEmitters.push(block.location);
      return success(null);
    }

    if (block.typeId === "fluffyalien_asn:storage_relay") {
      cables.push(block.location);

      const entity = getEntityAtBlockLocation(
        block,
        "fluffyalien_asn:relay_entity",
      );
      if (!entity) {
        logWarn(
          `couldn't add matching relays to discovery stack: couldn't get relay entity at ${Vector3Utils.toString(block.location)} in ${block.dimension.id}`,
        );
        return success(null);
      }

      const name = relayName.get(entity);
      if (!name) return success(null);

      for (const otherEntity of block.dimension.getEntities({
        type: "fluffyalien_asn:relay_entity",
      })) {
        const otherName = relayName.get(entity);
        if (name !== otherName) continue;

        let nextBlock = block.dimension.getBlock(otherEntity.location);

        if (!nextBlock) {
          if (forceLoadNetworksRule.get() === false) {
            logWarn(
              `cable network extends into unloaded chunks at ${Vector3Utils.toString(block.location)} in ${block.dimension.id} and forceLoadNetworks is disabled. some parts of the network may be unloaded`,
            );
            continue;
          }

          await addAnonymousTickingArea(
            block.dimension,
            otherEntity.location,
            2,
          );

          nextBlock = block.dimension.getBlock(otherEntity.location);

          removeAnonymousTickingArea(block.dimension, otherEntity.location);

          if (!nextBlock) {
            logWarn(
              `failed to follow the cable network into unloaded chunks at ${Vector3Utils.toString(block.location)} in ${block.dimension.id}. some parts of the network may be unloaded`,
            );
            continue;
          }
        }

        stack.push(nextBlock);
      }

      return success(null);
    }

    buses.push(block.location);
    return success(null);
  }

  async function next(
    block: Block,
    nextDirection: Direction,
  ): Promise<Result<null, DiscoverCableNetworkConnectionsError>> {
    let nextBlock = getBlockInDirection(block, nextDirection);

    if (!nextBlock) {
      if (forceLoadNetworksRule.get() === false) {
        logWarn(
          `cable network extends into unloaded chunks at ${Vector3Utils.toString(block.location)} in ${block.dimension.id} and forceLoadNetworks is disabled. some parts of the network may be unloaded`,
        );
        return success(null);
      }

      await addAnonymousTickingArea(block.dimension, block.location, 2);

      nextBlock = getBlockInDirection(block, nextDirection);

      removeAnonymousTickingArea(block.dimension, block.location);

      if (!nextBlock) {
        logWarn(
          `failed to follow the cable network into unloaded chunks at ${Vector3Utils.toString(block.location)} in ${block.dimension.id}. some parts of the network may be unloaded`,
        );
        return success(null);
      }
    }

    return handleBlock(nextBlock);
  }

  await handleBlock(origin);

  while (stack.length) {
    const block = stack.pop()!;

    {
      const res = await next(block, Direction.North);
      if (!res.success) return res;
    }

    {
      const res = await next(block, Direction.East);
      if (!res.success) return res;
    }

    {
      const res = await next(block, Direction.South);
      if (!res.success) return res;
    }

    {
      const res = await next(block, Direction.West);
      if (!res.success) return res;
    }

    {
      const res = await next(block, Direction.Up);
      if (!res.success) return res;
    }

    {
      const res = await next(block, Direction.Down);
      if (!res.success) return res;
    }
  }

  if (!storageCore) {
    return failure("noStorageCore");
  }

  return success({
    cables,
    storageCore,
    storageDrives,
    storageInterfaces,
    buses,
    levelEmitters,
  });
}

export function showEstablishNetworkError(
  player: Player,
  error: DiscoverCableNetworkConnectionsError,
): Promise<ActionFormResponse> {
  return makeErrorMessageUi({
    translate:
      error === "multipleStorageCores"
        ? "fluffyalien_asn.ui.cableNetwork.error.multipleStorageCores"
        : "fluffyalien_asn.ui.cableNetwork.error.noStorageCores",
  }).show(player);
}
