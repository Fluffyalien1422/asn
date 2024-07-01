import {
  VECTOR3_DOWN,
  VECTOR3_EAST,
  VECTOR3_NORTH,
  VECTOR3_SOUTH,
  VECTOR3_UP,
  VECTOR3_WEST,
} from "@minecraft/math";
import { Block, Direction, Vector3 } from "@minecraft/server";

export const STR_CARDINAL_DIRECTIONS = [
  "north",
  "east",
  "south",
  "west",
] as const;
export type StrCardinalDirection = (typeof STR_CARDINAL_DIRECTIONS)[number];

export const STR_VERTICAL_DIRECTIONS = ["up", "down"] as const;
export type StrVerticalDirection = (typeof STR_VERTICAL_DIRECTIONS)[number];

export const STR_DIRECTIONS = [
  "north",
  "east",
  "south",
  "west",
  "up",
  "down",
] as const;
export type StrDirection = (typeof STR_DIRECTIONS)[number];

export function getBlockInDirection(
  block: Block,
  direction: Direction | StrDirection,
): Block | undefined {
  switch (direction) {
    case "north":
    case Direction.North:
      return block.north();
    case "east":
    case Direction.East:
      return block.east();
    case "south":
    case Direction.South:
      return block.south();
    case "west":
    case Direction.West:
      return block.west();
    case "up":
    case Direction.Up:
      return block.above();
    case "down":
    case Direction.Down:
      return block.below();
  }
}

export function directionToVector3(
  direction: Direction | StrDirection,
): Vector3 {
  switch (direction) {
    case "north":
    case Direction.North:
      return VECTOR3_NORTH;
    case "east":
    case Direction.East:
      return VECTOR3_EAST;
    case "south":
    case Direction.South:
      return VECTOR3_SOUTH;
    case "west":
    case Direction.West:
      return VECTOR3_WEST;
    case "up":
    case Direction.Up:
      return VECTOR3_UP;
    case "down":
    case Direction.Down:
      return VECTOR3_DOWN;
  }
}

export function reverseDirection(dir: Direction): Direction;
export function reverseDirection(
  dir: StrCardinalDirection,
): StrCardinalDirection;
export function reverseDirection(
  dir: StrVerticalDirection,
): StrVerticalDirection;
export function reverseDirection(dir: StrDirection): StrDirection;
export function reverseDirection(
  dir: Direction | StrDirection,
): Direction | StrDirection {
  switch (dir) {
    case Direction.North:
      return Direction.South;
    case Direction.East:
      return Direction.West;
    case Direction.South:
      return Direction.North;
    case Direction.West:
      return Direction.West;
    case Direction.Up:
      return Direction.Down;
    case Direction.Down:
      return Direction.Up;
    case "north":
      return "south";
    case "east":
      return "west";
    case "south":
      return "north";
    case "west":
      return "east";
    case "up":
      return "down";
    case "down":
      return "up";
  }
}
