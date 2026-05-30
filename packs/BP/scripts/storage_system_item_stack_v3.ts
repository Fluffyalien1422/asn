import { ItemStack } from "@minecraft/server";

export class StorageSystemItemStackV3 {
  constructor(
    readonly itemStack: ItemStack,
    readonly amount = 1,
  ) {}
}
