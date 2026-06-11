import { ItemStack, Player, RawMessage } from "@minecraft/server";
import { itemStacksMatch } from "../utils/item";

/**
 * hidden lore marker appended to display items so they can be identified as ui
 * items. the vanilla items shown in the storage viewer do not have the
 * `fluffyalien_asn:ui_item` tag, so this marker is needed to detect them.
 *
 * every character is hidden behind a color code (`§a§s§n` spells "asn") and the
 * trailing `§r` resets the color. the game does not render any visible text for
 * this string, but it can still be read back from the item's lore.
 */
const DISPLAY_ITEM_LORE_MARKER = "§a§s§n§r";

/**
 * Detection and manipulation of "UI items": the display items shown in the
 * storage viewer that must not be confused with real items the player owns.
 */

/**
 * Whether the item is a storage viewer display/control item. Control items
 * carry the `fluffyalien_asn:ui_item` tag; vanilla display items are detected
 * via the hidden lore marker instead (see {@link DISPLAY_ITEM_LORE_MARKER}).
 */
export function isUiItem(itemStack: ItemStack): boolean {
  if (itemStack.hasTag("fluffyalien_asn:ui_item")) return true;
  const firstLine = itemStack.getRawLore()[0] as RawMessage | undefined;
  return (
    (firstLine?.text ?? firstLine?.rawtext?.[0]?.text)?.startsWith(
      DISPLAY_ITEM_LORE_MARKER,
    ) === true
  );
}

/**
 * Prepends DISPLAY_ITEM_LORE_MARKER to the item's lore so it can be
 * identified as a UI display item (see isUiItem).
 */
export function addDisplayItemLoreMarker(itemStack: ItemStack): ItemStack {
  if (isUiItem(itemStack)) return itemStack;

  const lore = itemStack.getRawLore();

  if (!lore.length) {
    itemStack.setLore([DISPLAY_ITEM_LORE_MARKER]);
    return itemStack;
  }

  // If the first line has text, merge the marker into it to avoid adding an
  // extra visible line. Otherwise insert the marker as a new first line.
  const firstLine = lore[0];
  if (firstLine.text) {
    itemStack.setLore([
      DISPLAY_ITEM_LORE_MARKER + firstLine.text,
      ...lore.slice(1),
    ]);
  } else if (firstLine.rawtext?.[0]?.text) {
    const [first, ...restRawtext] = firstLine.rawtext;
    itemStack.setLore([
      {
        rawtext: [
          { text: DISPLAY_ITEM_LORE_MARKER + first.text! },
          ...restRawtext,
        ],
      },
      ...lore.slice(1),
    ]);
  } else {
    itemStack.setLore([DISPLAY_ITEM_LORE_MARKER, ...lore]);
  }
  return itemStack;
}

/**
 * Reverses {@link addDisplayItemLoreMarker}, restoring the item's original lore.
 */
export function removeDisplayItemLoreMarker(itemStack: ItemStack): ItemStack {
  const lore = itemStack.getRawLore();
  const firstLine = lore[0] as RawMessage | undefined;

  // Strip the marker prefix. If the marker was the entire line (standalone),
  // drop the line; otherwise keep the remaining text (merged case).
  if (firstLine?.text?.startsWith(DISPLAY_ITEM_LORE_MARKER)) {
    const stripped = firstLine.text.slice(DISPLAY_ITEM_LORE_MARKER.length);
    itemStack.setLore(stripped ? [stripped, ...lore.slice(1)] : lore.slice(1));
    return itemStack;
  }

  const firstNestedText = firstLine?.rawtext?.[0]?.text;
  if (firstNestedText?.startsWith(DISPLAY_ITEM_LORE_MARKER)) {
    const stripped = firstNestedText.slice(DISPLAY_ITEM_LORE_MARKER.length);
    const restRawtext = firstLine!.rawtext!.slice(1);
    const newRawtext = stripped
      ? [{ text: stripped }, ...restRawtext]
      : restRawtext;
    itemStack.setLore(
      newRawtext.length
        ? [{ rawtext: newRawtext }, ...lore.slice(1)]
        : lore.slice(1),
    );
    return itemStack;
  }

  return itemStack;
}

/**
 * check if an item in the interface inventory has been taken by the player
 */
export function isStorageInventoryItemTaken(
  storageItem: ItemStack,
  inventoryItem_: ItemStack,
): boolean {
  const inventoryItem = inventoryItem_.clone();
  removeDisplayItemLoreMarker(inventoryItem);
  return !itemStacksMatch(storageItem, inventoryItem, true);
}

/**
 * Removes any leftover UI item from the player's cursor or inventory. Only the
 * first one found is removed, since at most one UI item leaks per interaction.
 */
export function clearUiItemsFromPlayer(player: Player): void {
  const playerCursorInventory = player.getComponent("cursor_inventory")!;
  if (playerCursorInventory.item && isUiItem(playerCursorInventory.item)) {
    playerCursorInventory.clear();
    return;
  }

  const playerInventory = player.getComponent("inventory")!.container;
  for (let i = 0; i < playerInventory.size; i++) {
    const item = playerInventory.getItem(i);

    if (item && isUiItem(item)) {
      playerInventory.setItem(i);
      return;
    }
  }
}
