import { Block, Vector3 } from "@minecraft/server";
import { Result, failure, success } from "./result";
import { STORAGE_DRIVE_BLOCK_TYPE_ID } from "./storage_drive";
import { STORAGE_INTERFACE_BLOCK_TYPE_ID } from "./storage_interface";
import { STORAGE_CORE_BLOCK_TYPE_ID } from "./storage_core";
import { CABLE_BLOCK_TYPE_ID } from "./cable";
import { IMPORT_BUS_BLOCK_TYPE_ID } from "./import_bus";

export interface CableNetworkConnections {
  cables: Vector3[];
  storageCore: Vector3;
  storageDrives: Vector3[];
  storageInterfaces: Vector3[];
  /**
   * Other connections: import bus, export bus, level emitter
   */
  other: Vector3[];
}

export type DiscoverCableNetworkConnectionsError =
  | "multipleStorageCores"
  | "noStorageCore";

export function discoverCableNetworkConnections(
  origin: Block
): Result<CableNetworkConnections, DiscoverCableNetworkConnectionsError> {
  const visitedLocations: Vector3[] = [];
  const stack: Block[] = [];

  const cables: Vector3[] = [];
  const storageDrives: Vector3[] = [];
  const storageInterfaces: Vector3[] = [];
  const otherConnections: Vector3[] = [];
  let storageCore: Vector3 | undefined;

  function handleNextBlock(
    block?: Block
  ): Result<null, DiscoverCableNetworkConnectionsError> {
    if (
      !block ||
      ![
        CABLE_BLOCK_TYPE_ID,
        STORAGE_CORE_BLOCK_TYPE_ID,
        STORAGE_DRIVE_BLOCK_TYPE_ID,
        STORAGE_INTERFACE_BLOCK_TYPE_ID,
        IMPORT_BUS_BLOCK_TYPE_ID,
      ].includes(block.typeId) ||
      visitedLocations.some(
        (vector) =>
          block.x === vector.x && block.y === vector.y && block.z === vector.z
      )
    ) {
      return success(null);
    }

    visitedLocations.push(block.location);

    if (block.typeId === CABLE_BLOCK_TYPE_ID) {
      cables.push(block.location);
      stack.push(block);

      return success(null);
    }

    if (block.typeId === STORAGE_CORE_BLOCK_TYPE_ID) {
      if (storageCore) {
        return failure("multipleStorageCores");
      }

      storageCore = block.location;
      return success(null);
    }

    if (block.typeId === STORAGE_DRIVE_BLOCK_TYPE_ID) {
      storageDrives.push(block.location);
      return success(null);
    }

    if (block.typeId === STORAGE_INTERFACE_BLOCK_TYPE_ID) {
      storageInterfaces.push(block.location);
      return success(null);
    }

    otherConnections.push(block.location);
    return success(null);
  }

  handleNextBlock(origin);
  if (origin.typeId !== CABLE_BLOCK_TYPE_ID) {
    stack.push(origin);
  }

  while (stack.length) {
    const block = stack.pop()!;

    {
      const res = handleNextBlock(block.north());
      if (!res.success) return res;
    }

    {
      const res = handleNextBlock(block.east());
      if (!res.success) return res;
    }

    {
      const res = handleNextBlock(block.south());
      if (!res.success) return res;
    }

    {
      const res = handleNextBlock(block.west());
      if (!res.success) return res;
    }

    {
      const res = handleNextBlock(block.above());
      if (!res.success) return res;
    }

    {
      const res = handleNextBlock(block.below());
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
    other: otherConnections,
  });
}
