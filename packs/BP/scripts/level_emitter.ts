import { StorageNetwork } from "./storage_network";
import {
  Block,
  BlockCustomComponent,
  BlockPermutation,
  Entity,
  ItemStack,
  Player,
} from "@minecraft/server";
import { logWarn } from "./log";
import { ModalFormData } from "@minecraft/server-ui";
import {
  DynamicPropertyAccessor,
  removeAllDynamicPropertiesForBlock,
} from "./utils/dynamic_property";
import {
  STR_DIRECTIONS,
  StrCardinalDirection,
  getBlockInDirection,
  reverseDirection,
} from "./utils/direction";
import { getEntityAtBlockLocation } from "./utils/location";
import { getItemTranslationKey, getPlayerMainhandSlot } from "./utils/item";
import { makeErrorMessageUi, makeMessageUi, showForm } from "./utils/ui";
import {
  busUpdateBlockConnectStatesTransformer,
  updateBlockConnectStates,
} from "./utils/block_connect";
import { BlockStateSuperset } from "@minecraft/vanilla-data";

const OPERATOR_STRS = [">", "<", "==", "!="];
// Operator enum members should match the order of OPERATOR_STRS
enum Operator {
  GreaterThan,
  LessThan,
  EqEq,
  NotEq,
}

enum TestItemEnchantableStatus {
  Ignore,
  WithEnchantments,
  WithoutEnchantments,
}

const levelEmitterItem = DynamicPropertyAccessor.withoutDefault<string>(
  "fluffyalien_asn:level_emitter_item",
);

const levelEmitterTestAmount = DynamicPropertyAccessor.withoutDefault<number>(
  "fluffyalien_asn:level_emitter_test_amount",
);

const levelEmitterOperator = DynamicPropertyAccessor.withoutDefault<Operator>(
  "fluffyalien_asn:level_emitter_operator",
);

const levelEmitterTestEnchantments =
  DynamicPropertyAccessor.withoutDefault<TestItemEnchantableStatus>(
    "fluffyalien_asn:level_emitter_test_enchantments",
  );

const levelEmitterItemMinDamage =
  DynamicPropertyAccessor.withoutDefault<number>(
    "fluffyalien_asn:level_emitter_item_min_damage",
  );

const levelEmitterItemMaxDamage =
  DynamicPropertyAccessor.withoutDefault<number>(
    "fluffyalien_asn:level_emitter_item_max_damage",
  );

export const levelEmitterComponent: BlockCustomComponent = {
  onPlayerDestroy(e) {
    removeAllDynamicPropertiesForBlock(e.block);

    // legacy support - remove the entity if it exists
    getEntityAtBlockLocation(
      e.block,
      "fluffyalien_asn:level_emitter_entity",
    )?.remove();
  },
  onPlayerInteract(e) {
    if (!e.player) return;

    const dynamicPropertyTarget =
      getEntityAtBlockLocation(
        e.block,
        "fluffyalien_asn:level_emitter_entity",
      ) ?? e.block;

    const mainhandSlot = getPlayerMainhandSlot(e.player);
    const heldItem = mainhandSlot.getItem();
    if (heldItem) {
      levelEmitterItem.set(dynamicPropertyTarget, heldItem.typeId);

      // reset optional values
      levelEmitterTestEnchantments.set(dynamicPropertyTarget);
      levelEmitterItemMinDamage.set(dynamicPropertyTarget);
      levelEmitterItemMaxDamage.set(dynamicPropertyTarget);
    }

    void showLevelEmitterUi(e.player, dynamicPropertyTarget);
  },
  onTick(e) {
    updateBlockConnectStates(
      e.block,
      STR_DIRECTIONS,
      (other) => other.hasTag("fluffyalien_asn:storage_network_connectable"),
      busUpdateBlockConnectStatesTransformer(
        e.block.permutation.getState(
          "minecraft:cardinal_direction",
        ) as StrCardinalDirection,
      ),
    );
  },
};

async function showLevelEmitterUi(
  player: Player,
  dynamicPropertyTarget: Entity | Block,
): Promise<void> {
  const itemId = levelEmitterItem.get(dynamicPropertyTarget);

  if (!itemId) {
    return void showForm(
      makeMessageUi(
        { translate: "fluffyalien_asn.ui.levelEmitter.title" },
        { translate: "fluffyalien_asn.ui.levelEmitter.noItem" },
      ),
      player,
    );
  }

  const form = new ModalFormData();
  form.title({ translate: "fluffyalien_asn.ui.levelEmitter.title" });

  form.dropdown(
    {
      rawtext: [
        {
          translate: "fluffyalien_asn.ui.levelEmitter.testItem",
          with: {
            rawtext: [
              {
                rawtext: [
                  {
                    text: "§l",
                  },
                  {
                    translate: getItemTranslationKey(itemId),
                  },
                ],
              },
            ],
          },
        },
        {
          text: "§r\n\n",
        },
        {
          translate: "fluffyalien_asn.ui.levelEmitter.operator",
        },
      ],
    },
    OPERATOR_STRS,
    levelEmitterOperator.get(dynamicPropertyTarget),
  );

  form.textField(
    { translate: "fluffyalien_asn.ui.levelEmitter.amount" },
    "",
    (levelEmitterTestAmount.get(dynamicPropertyTarget) ?? 0).toString(),
  );

  const itemStack = new ItemStack(itemId);
  const enchantable = itemStack.hasComponent("enchantable");
  const breakable = itemStack.hasComponent("durability");

  const itemEnchantmentsStatus = levelEmitterTestEnchantments.get(
    dynamicPropertyTarget,
  );

  if (enchantable) {
    form.dropdown(
      {
        translate:
          "fluffyalien_asn.ui.exportBus.exportItemEnchantmentsStatus.label",
      },
      [
        // should be in the same order as the enum
        {
          translate:
            "fluffyalien_asn.ui.exportBus.exportItemEnchantmentsStatus.ignore",
        },
        {
          translate:
            "fluffyalien_asn.ui.exportBus.exportItemEnchantmentsStatus.with",
        },
        {
          translate:
            "fluffyalien_asn.ui.exportBus.exportItemEnchantmentsStatus.without",
        },
      ],
      itemEnchantmentsStatus,
    );
  }

  if (breakable) {
    form.textField(
      { translate: "fluffyalien_asn.ui.exportBus.exportItemMinDamage" },
      "0",
      (levelEmitterItemMinDamage.get(dynamicPropertyTarget) ?? 0).toString(),
    );

    form.textField(
      { translate: "fluffyalien_asn.ui.exportBus.exportItemMaxDamage" },
      "",
      levelEmitterItemMaxDamage.get(dynamicPropertyTarget)?.toString(),
    );
  }

  const response = await showForm(form, player);

  if (!response.formValues) {
    return;
  }

  const operator = response.formValues[0] as number;

  const amountStr = response.formValues[1] as string;
  const amount = Number(amountStr);

  if (isNaN(amount) || amount < 0) {
    return void showForm(
      makeErrorMessageUi({
        translate: "fluffyalien_asn.ui.levelEmitter.error.invalidAmount",
      }),
      player,
    );
  }

  const enchantmentsDropdownResponse = enchantable
    ? (response.formValues[2] as number)
    : undefined;

  const minDamageResponseRaw = breakable
    ? response.formValues[enchantable ? 3 : 2]
    : null;
  const maxDamageResponseRaw = breakable
    ? response.formValues[enchantable ? 4 : 3]
    : null;

  const minDamageResponse = minDamageResponseRaw
    ? Number(minDamageResponseRaw)
    : undefined;
  if (minDamageResponse !== undefined && isNaN(minDamageResponse)) {
    return void showForm(
      makeErrorMessageUi({
        translate: "fluffyalien_asn.ui.exportBus.error.invalidMinDamage",
      }),
      player,
    );
  }

  const maxDamageResponse = maxDamageResponseRaw
    ? Number(maxDamageResponseRaw)
    : undefined;
  if (maxDamageResponse !== undefined && isNaN(maxDamageResponse)) {
    return void showForm(
      makeErrorMessageUi({
        translate: "fluffyalien_asn.ui.exportBus.error.invalidMaxDamage",
      }),
      player,
    );
  }

  levelEmitterOperator.set(dynamicPropertyTarget, operator);
  levelEmitterTestAmount.set(dynamicPropertyTarget, amount);
  levelEmitterTestEnchantments.set(
    dynamicPropertyTarget,
    enchantmentsDropdownResponse,
  );
  levelEmitterItemMinDamage.set(dynamicPropertyTarget, minDamageResponse);
  levelEmitterItemMaxDamage.set(dynamicPropertyTarget, maxDamageResponse);
}

export function updateLevelEmitter(
  block: Block,
  network: StorageNetwork,
): void {
  const dummy = getEntityAtBlockLocation(
    block,
    "fluffyalien_asn:level_emitter_entity",
  );
  if (!dummy) {
    logWarn(
      `could not update level emitter at (${block.x.toString()}, ${block.y.toString()}, ${block.z.toString()}) in ${
        block.dimension.id
      }: could not get dummy entity`,
    );
    return;
  }

  const itemId = levelEmitterItem.get(dummy);
  if (!itemId) {
    return;
  }

  const operator = levelEmitterOperator.get(dummy) ?? 0;
  const amount = levelEmitterTestAmount.get(dummy) ?? 0;
  const enchantmentsStatus =
    levelEmitterTestEnchantments.get(dummy) ?? TestItemEnchantableStatus.Ignore;
  const minDamage = levelEmitterItemMinDamage.get(dummy) ?? 0;
  const maxDamage = levelEmitterItemMaxDamage.get(dummy);

  const matchingItemStacks = network
    .getStoredItemStacks()
    .filter(
      (itemStack) =>
        itemStack.typeId === itemId &&
        (enchantmentsStatus === TestItemEnchantableStatus.Ignore ||
          (enchantmentsStatus === TestItemEnchantableStatus.WithEnchantments &&
            itemStack.enchantments.length) ||
          (enchantmentsStatus ===
            TestItemEnchantableStatus.WithoutEnchantments &&
            !itemStack.enchantments.length)) &&
        itemStack.damage >= minDamage &&
        (maxDamage === undefined || itemStack.damage <= maxDamage),
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

  const cardinalDirection = block.permutation.getState(
    "minecraft:cardinal_direction",
  ) as StrCardinalDirection;

  const target = getBlockInDirection(block, cardinalDirection);

  if (
    target &&
    (target.typeId === "minecraft:powered_repeater" ||
      target.typeId === "minecraft:unpowered_repeater") &&
    target.permutation.getState("minecraft:cardinal_direction") ===
      reverseDirection(cardinalDirection)
  ) {
    target.setPermutation(
      BlockPermutation.resolve(
        "powered_repeater",
        target.permutation.getAllStates(),
      ),
    );
  }
}
