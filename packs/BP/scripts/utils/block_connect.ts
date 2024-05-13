import { Block } from "@minecraft/server";
import {
  StrCardinalDirection,
  StrDirection,
  getBlockInDirection,
  reverseDirection,
} from "./direction";

/**
 * sets the connect states of a block (eg. `fluffyalien_asn:north`) to a boolean value
 */
export function updateBlockConnectStates<TDirection extends StrDirection>(
  block: Block,
  directions: readonly TDirection[],
  condition: (block: Block) => boolean,
  transformer?: (direction: TDirection) => TDirection | undefined,
): void {
  let permutation = block.permutation;

  for (const direction of directions) {
    const blockInDirection = getBlockInDirection(block, direction);
    if (!blockInDirection) {
      continue;
    }

    const transformedDirection = transformer
      ? transformer(direction)
      : direction;
    if (!transformedDirection) {
      continue;
    }

    permutation = permutation.withState(
      `fluffyalien_asn:${transformedDirection}`,
      condition(blockInDirection),
    );
  }

  block.setPermutation(permutation);
}

export function busUpdateBlockConnectStatesTransformer(
  cardinalDirection: StrCardinalDirection,
): (direction: StrDirection) => StrDirection | undefined {
  return (direction) => {
    if (direction === "up" || direction === "down") {
      return direction;
    }

    switch (cardinalDirection) {
      case "north":
        switch (direction) {
          case "north":
            return;
          default:
            return direction;
        }
      case "east":
        switch (direction) {
          case "north":
            return "west";
          case "east":
            return;
          case "south":
            return "east";
          case "west":
            return "south";
        }
        break;
      case "south":
        switch (direction) {
          case "south":
            return;
          default:
            return reverseDirection(direction);
        }
      case "west":
        switch (direction) {
          case "north":
            return "east";
          case "east":
            return "south";
          case "south":
            return "west";
          case "west":
            return;
        }
    }
  };
}
