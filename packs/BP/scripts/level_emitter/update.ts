import { Block } from "@minecraft/server";
import { BlockStateSuperset } from "@minecraft/vanilla-data";
import { StorageNetwork } from "../storage_network";
import { getItemStackDamage } from "../utils/item";
import {
  Operator,
  TestItemEnchantableStatus,
  itemMaxDamageProperty,
  itemMinDamageProperty,
  itemProperty,
  operatorProperty,
  testAmountProperty,
  testEnchantmentsProperty,
} from "./properties";

export async function updateLevelEmitter(
  block: Block,
  network: StorageNetwork,
): Promise<void> {
  const itemId = itemProperty.safeGet(block);
  if (!itemId) {
    return;
  }

  const operator = operatorProperty.safeGet(block);
  const amount = testAmountProperty.safeGet(block);
  const enchantmentsStatus = testEnchantmentsProperty.safeGet(block);
  const minDamage = itemMinDamageProperty.safeGet(block);
  const maxDamage = itemMaxDamageProperty.safeGet(block);

  const storedItemStacksResult = await network.getStoredItemStacks();
  if (storedItemStacksResult.isErr()) {
    return;
  }

  const matchingItemStacks = [...storedItemStacksResult.value.values()].filter(
    (itemStack) => {
      const hasEnchantments =
        (itemStack.getComponent("enchantable")?.getEnchantments().length ?? 0) >
        0;
      const damage = getItemStackDamage(itemStack);

      return (
        itemStack.typeId === itemId &&
        (enchantmentsStatus === TestItemEnchantableStatus.Ignore ||
          (enchantmentsStatus === TestItemEnchantableStatus.WithEnchantments &&
            hasEnchantments) ||
          (enchantmentsStatus ===
            TestItemEnchantableStatus.WithoutEnchantments &&
            !hasEnchantments)) &&
        damage >= minDamage &&
        (maxDamage === undefined || damage <= maxDamage)
      );
    },
  );

  let totalMatchingAmount = 0;
  for (const matchingItemStack of matchingItemStacks) {
    totalMatchingAmount += matchingItemStack.amount;
  }

  const shouldEmitSignal =
    (operator === Operator.EqEq && totalMatchingAmount === amount) ||
    (operator === Operator.GreaterThan && totalMatchingAmount > amount) ||
    (operator === Operator.LessThan && totalMatchingAmount < amount) ||
    (operator === Operator.NotEq && totalMatchingAmount !== amount);

  const litState = block.permutation.getState(
    "fluffyalien_asn:lit" as keyof BlockStateSuperset,
  ) as 0 | 1;

  if (!shouldEmitSignal) {
    if (litState) {
      block.setPermutation(
        block.permutation.withState(
          "fluffyalien_asn:lit" as keyof BlockStateSuperset,
          0,
        ),
      );
    }

    return;
  }

  if (!litState) {
    block.setPermutation(
      block.permutation.withState(
        "fluffyalien_asn:lit" as keyof BlockStateSuperset,
        1,
      ),
    );
  }
}
