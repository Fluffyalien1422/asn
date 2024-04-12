import { Block, Vector3 } from "@minecraft/server";
import { Result, failure, success } from "./result";
import { Vector3Utils } from "@minecraft/math";

export interface CableNetworkConnections {
  cables: Vector3[];
  storageCore: Vector3;
  storageDrives: Vector3[];
  storageInterfaces: Vector3[];
  /**
   * Connections that should be updated on interval (import buses, export buses, level emitter, etc)
   */
  updateConnections: Vector3[];
}

export type DiscoverCableNetworkConnectionsError =
  | "multipleStorageCores"
  | "noStorageCore";

export function discoverCableNetworkConnections(
  origin: Block,
): Result<CableNetworkConnections, DiscoverCableNetworkConnectionsError> {
  const visitedLocations: Vector3[] = [];
  const stack: Block[] = [];

  const cables: Vector3[] = [];
  const storageDrives: Vector3[] = [];
  const storageInterfaces: Vector3[] = [];
  const updateConnections: Vector3[] = [];
  let storageCore: Vector3 | undefined;

  function handleNextBlock(
    block?: Block,
  ): Result<null, DiscoverCableNetworkConnectionsError> {
    if (
      !block ||
      ![
        "fluffyalien_asn:storage_cable",
        "fluffyalien_asn:storage_core",
        "fluffyalien_asn:storage_drive",
        "fluffyalien_asn:storage_interface",
        "fluffyalien_asn:import_bus",
        "fluffyalien_asn:export_bus",
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

    updateConnections.push(block.location);
    return success(null);
  }

  handleNextBlock(origin);
  if (origin.typeId !== "fluffyalien_asn:storage_cable") {
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
    updateConnections,
  });
}
