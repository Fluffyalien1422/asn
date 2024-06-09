import { Block, Direction } from "@minecraft/server";
import {
  StrCardinalDirection,
  getBlockInDirection,
  reverseDirection,
} from "./direction";
import { Vector3Utils } from "@minecraft/math";

export function recievingRedstoneSignalFromDirection(
  block: Block,
  direction: Direction,
): boolean {
  const target = getBlockInDirection(block, direction);
  if (!target?.getRedstonePower() || target.typeId === "minecraft:hopper") {
    return false;
  }

  if (direction === Direction.Up || direction === Direction.Down) {
    return ![
      "minecraft:redstone_wire",
      "minecraft:powered_comparator",
      "minecraft:powered_repeater",
    ].includes(target.typeId);
  }

  if (
    target.typeId === "minecraft:powered_comparator" ||
    target.typeId === "minecraft:powered_repeater"
  ) {
    const facingBlock = getBlockInDirection(
      target,
      reverseDirection(
        target.permutation.getState(
          "minecraft:cardinal_direction",
        ) as StrCardinalDirection,
      ),
    );

    if (!facingBlock) {
      return false;
    }

    return Vector3Utils.equals(block, facingBlock);
  }

  return true;
}

export function receivingRedstoneSignal(block: Block): boolean {
  return (
    recievingRedstoneSignalFromDirection(block, Direction.North) ||
    recievingRedstoneSignalFromDirection(block, Direction.East) ||
    recievingRedstoneSignalFromDirection(block, Direction.South) ||
    recievingRedstoneSignalFromDirection(block, Direction.West) ||
    recievingRedstoneSignalFromDirection(block, Direction.Up) ||
    recievingRedstoneSignalFromDirection(block, Direction.Down)
  );
}
