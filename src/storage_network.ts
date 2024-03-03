import { Block, Dimension } from "@minecraft/server";
import {
  CableNetworkConnections,
  discoverCableNetworkConnections,
} from "./cable";
import { vector3Matches } from "./utils/vector";

export class StorageNetwork {
  private static storageNetworks: StorageNetwork[] = [];

  /**
   * Establish a network from any starting position inside of the network
   * @param origin any block inside the network
   * @returns the new {@link StorageNetwork}
   */
  static establishNetwork(origin: Block): StorageNetwork {
    const result = discoverCableNetworkConnections(origin);
    if (!result.success) {
      throw new Error(result.error);
    }

    const connections = result.value;

    return new StorageNetwork(origin.dimension, connections);
  }

  /**
   * Get the {@link StorageNetwork} that the {@link Block} belongs to
   * @returns the {@link StorageNetwork} if it was found or undefined
   */
  static getNetwork(block: Block): StorageNetwork | undefined {
    return StorageNetwork.storageNetworks.find((network) =>
      network.isPartOfNetwork(block)
    );
  }

  private constructor(
    private readonly dimension: Dimension,
    private connections: CableNetworkConnections
  ) {
    StorageNetwork.storageNetworks.push(this);
  }

  /**
   * Check if a {@link Block} is part of this network
   */
  isPartOfNetwork(block: Block): boolean {
    return (
      block.dimension.id === this.dimension.id &&
      (vector3Matches(block.location, this.connections.storageCore) ||
        this.connections.cables.some((v) =>
          vector3Matches(v, block.location)
        ) ||
        this.connections.storageDrives.some((v) =>
          vector3Matches(v, block.location)
        ) ||
        this.connections.storageInterfaces.some((v) =>
          vector3Matches(v, block.location)
        ))
    );
  }

  updateConnections(): void {
    const coreBlock = this.dimension.getBlock(this.connections.storageCore);
    if (!coreBlock) {
      throw new Error(
        `Storage core does not exist at (${this.connections.storageCore.x}, ${this.connections.storageCore.y}, ${this.connections.storageCore.z})`
      );
    }

    const result = discoverCableNetworkConnections(coreBlock);
    if (!result.success) {
      throw new Error(result.error);
    }

    this.connections = result.value;
  }
}
