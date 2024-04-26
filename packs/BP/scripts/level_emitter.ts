import { StorageNetwork } from "./storage_network";
import {
  Block,
  BlockPermutation,
  Entity,
  Player,
  world,
} from "@minecraft/server";
import {
  getEntityAtBlockLocation,
  getItemTranslationKey,
  getPlayerMainhandSlot,
  makeErrorMessageUi,
  makeMessageUi,
} from "./utils";
import { Logger } from "./log";
import { ModalFormData } from "@minecraft/server-ui";
import { onPlayerInteractWithBlockNoSpam } from "./interact_with_block_no_spam";

const log = new Logger("level_emitter.ts");

const OPERATOR_STRS = [">", "<", "==", "!="];
// Operator enum members should match the order of OPERATOR_STRS
enum Operator {
  GREATER_THAN,
  LESS_THAN,
  EQ_EQ,
  NOT_EQ,
}

world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== "fluffyalien_asn:level_emitter") return;

  e.block.dimension.spawnEntity("fluffyalien_asn:level_emitter_entity", {
    x: e.block.x + 0.5,
    y: e.block.y,
    z: e.block.z + 0.5,
  });

  StorageNetwork.updateConnectableNetworks(e.block);
});

world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== "fluffyalien_asn:level_emitter")
    return;

  getEntityAtBlockLocation(
    e.block,
    "fluffyalien_asn:level_emitter_entity",
  )?.remove();

  StorageNetwork.getNetwork(
    e.block,
    e.brokenBlockPermutation.type.id,
  )?.updateConnections();
});

onPlayerInteractWithBlockNoSpam((e) => {
  if (e.block.typeId !== "fluffyalien_asn:level_emitter" || e.player.isSneaking)
    return;

  const entity = getEntityAtBlockLocation(
    e.block,
    "fluffyalien_asn:level_emitter_entity",
  );
  if (!entity) {
    log.warn("playerInteractWithBlock event", "could not get dummy entity");
    return;
  }

  const mainhandSlot = getPlayerMainhandSlot(e.player);
  const heldItem = mainhandSlot?.getItem();
  if (heldItem) {
    entity.setDynamicProperty("fluffyalien_asn:test_item", heldItem.typeId);
  }

  void showLevelEmitterUi(e.player, entity);
});

async function showLevelEmitterUi(
  player: Player,
  dummyEntity: Entity,
): Promise<void> {
  const itemId = dummyEntity.getDynamicProperty("fluffyalien_asn:test_item") as
    | string
    | undefined;

  if (!itemId) {
    return void makeMessageUi(
      { translate: "fluffyalien_asn.ui.levelEmitter.title" },
      { translate: "fluffyalien_asn.ui.levelEmitter.noItem" },
    ).show(player);
  }

  const form = new ModalFormData();

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
    dummyEntity.getDynamicProperty("fluffyalien_asn:test_operator") as
      | Operator
      | undefined,
  );

  form.textField(
    { translate: "fluffyalien_asn.ui.levelEmitter.amount" },
    "",
    (
      (dummyEntity.getDynamicProperty("fluffyalien_asn:test_amount") as
        | number
        | undefined) ?? 0
    ).toString(),
  );

  const response = await form.show(player);

  if (!response.formValues) {
    return;
  }

  const operator = response.formValues[0] as number;

  const amountStr = response.formValues[1] as string;
  const amount = Number(amountStr);

  if (isNaN(amount) || amount < 0) {
    return void makeErrorMessageUi({
      translate: "fluffyalien_asn.ui.levelEmitter.error.invalidAmount",
    }).show(player);
  }

  dummyEntity.setDynamicProperty("fluffyalien_asn:test_operator", operator);
  dummyEntity.setDynamicProperty("fluffyalien_asn:test_amount", amount);
}

export function updateLevelEmitter(
  block: Block,
  network: StorageNetwork,
): void {
  const cardinalDirection = block.permutation.getState(
    "minecraft:cardinal_direction",
  ) as string;

  const target =
    cardinalDirection === "north"
      ? block.north()
      : cardinalDirection === "east"
        ? block.east()
        : cardinalDirection === "south"
          ? block.south()
          : block.west();

  if (
    !target ||
    (target.typeId !== "minecraft:powered_repeater" &&
      target.typeId !== "minecraft:unpowered_repeater")
  ) {
    return;
  }

  const dummy = getEntityAtBlockLocation(
    block,
    "fluffyalien_asn:level_emitter_entity",
  );
  if (!dummy) {
    log.warn(
      "updateLevelEmitter",
      `could not update level emitter at (${block.x.toString()}, ${block.y.toString()}, ${block.z.toString()}) in ${
        block.dimension.id
      }: could not get dummy entity`,
    );
    return;
  }

  const itemId = dummy.getDynamicProperty("fluffyalien_asn:test_item") as
    | string
    | undefined;
  if (!itemId) {
    return;
  }

  const operator =
    (dummy.getDynamicProperty("fluffyalien_asn:test_operator") as
      | Operator
      | undefined) ?? 0;
  const amount =
    (dummy.getDynamicProperty("fluffyalien_asn:test_amount") as
      | number
      | undefined) ?? 0;

  const shouldEmitSignal = network
    .getStoredItemStacks()
    .some(
      (itemStack) =>
        itemStack.typeId === itemId &&
        ((operator === Operator.EQ_EQ && itemStack.amount === amount) ||
          (operator === Operator.GREATER_THAN && itemStack.amount > amount) ||
          (operator === Operator.LESS_THAN && itemStack.amount < amount) ||
          (operator === Operator.NOT_EQ && itemStack.amount !== amount)),
    );

  if (!shouldEmitSignal) {
    return;
  }

  target.setPermutation(
    BlockPermutation.resolve(
      "powered_repeater",
      target.permutation.getAllStates(),
    ),
  );
}
