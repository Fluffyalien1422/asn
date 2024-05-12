import { Block, Direction, Player, Vector3 } from "@minecraft/server";
import { Result, failure, success } from "./result";
import { Vector3Utils } from "@minecraft/math";
import { ActionFormResponse } from "@minecraft/server-ui";
import { Logger } from "./log";
import {
  addAnonymousTickingArea,
  removeAnonymousTickingArea,
} from "./tickingarea";
import { forceLoadNetworksRule } from "./addon_rules";
import { getBlockInDirection } from "./utils/direction";
import { wait } from "./utils/async";
import { makeErrorMessageUi } from "./utils/ui";

const log = new Logger("cable_network.ts");

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

  function handleBlock(
    block: Block,
  ): Result<null, DiscoverCableNetworkConnectionsError> {
    if (
      ![
        "fluffyalien_asn:storage_cable",
        "fluffyalien_asn:storage_core",
        "fluffyalien_asn:storage_drive",
        "fluffyalien_asn:storage_interface",
        "fluffyalien_asn:import_bus",
        "fluffyalien_asn:export_bus",
        "fluffyalien_asn:level_emitter",
      ].includes(block.typeId) ||
      visitedLocations.some((vector) =>
        Vector3Utils.equals(block.location, vector),
      )
    ) {
      return success(null);
    }

    visitedLocations.push(block.location);

    if (block.typeId === "fluffyalien_asn:storage_cable") {
      cables.push(block.location);
      stack.push(block);

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

    buses.push(block.location);
    return success(null);
  }

  async function next(
    block: Block,
    nextDirection: Direction,
  ): Promise<Result<null, DiscoverCableNetworkConnectionsError>> {
    let nextBlock = getBlockInDirection(block, nextDirection);

    if (!nextBlock) {
      if (!forceLoadNetworksRule.get()) {
        log.warn(
          "discoverCableNetworkConnections > next",
          `cable network extends into unloaded chunks and forceLoadNetworks is disabled. some parts of the network may be unloaded`,
        );
        return success(null);
      }

      addAnonymousTickingArea(block.dimension, block.location, 2);

      await wait(1);
      nextBlock = getBlockInDirection(block, nextDirection);

      removeAnonymousTickingArea(block.dimension, block.location);

      if (!nextBlock) {
        log.warn(
          "discoverCableNetworkConnections > next",
          `failed to follow the cable network into unloaded chunks. some parts of the network may be unloaded`,
        );
        return success(null);
      }
    }

    return handleBlock(nextBlock);
  }

  handleBlock(origin);
  if (origin.typeId !== "fluffyalien_asn:storage_cable") {
    stack.push(origin);
  }

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
