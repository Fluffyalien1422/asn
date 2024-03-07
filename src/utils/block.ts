import { Block, Direction } from "@minecraft/server";

export function getBlockInDirection(
  block: Block,
  direction: Direction
): Block | undefined {
  switch (direction) {
    case $.server.Direction.North:
      return block.north();
    case $.server.Direction.East:
      return block.east();
    case $.server.Direction.South:
      return block.south();
    case $.server.Direction.West:
      return block.west();
    case $.server.Direction.Up:
      return block.above();
    case $.server.Direction.Down:
      return block.below();
  }
}
