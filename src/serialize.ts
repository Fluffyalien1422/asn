/*

serialization format info:

type_id(amount "name tag" damage "lore line 1","lore line 2" enchant@level,enchant2@level)

- damage refers to ItemDurabilityComponent#damage
  (https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemdurabilitycomponent?view=minecraft-bedrock-experimental#damage)

- space is the separator

- enchantments, lore, and name tag are optional, others are expected
  to have a value even if they're is not used (for example,
  damage is still required for items that have no durability)

- name tag is a string, only double quotes are allowed,
  double quotes inside must be escaped with backslashes \"

- \" and \n are the only valid escape codes in strings

examples:
minecraft:dirt(1 "my dirt" 0  )
minecraft:dirt(1  0  )
minecraft:wooden_sword(1  0  sharpness@1,unbreaking@2)
*/

import { Enchantment } from "@minecraft/server";
import { StorageSystemItemStack } from "./storage_system_item_stack";
import { getEnchantmentTypeId } from "./utils";

export function deserialize(data: string): StorageSystemItemStack[] {
  const parser = new DeserializeParser(data);
  return parser.parse();
}

function serializeString(str: string): string {
  return str.replaceAll('"', '\\"').replaceAll("\n", "\\n");
}

export function serialize(itemStack: StorageSystemItemStack): string {
  const id = itemStack.typeId;
  const amount = itemStack.amount;
  const nameTag = itemStack.nameTag;
  const damage = itemStack.damage;
  const lore = itemStack.lore;
  const enchantments = itemStack.enchantments;

  return `${id}(${amount} ${
    nameTag ? `"${serializeString(nameTag)}"` : ""
  } ${damage} ${
    lore.length ? `"${lore.map((s) => serializeString(s)).join('","')}"` : ""
  } ${enchantments
    .map(
      (enchantment) =>
        `${getEnchantmentTypeId(enchantment)}@${enchantment.level}`
    )
    .join(",")})`;
}

class DeserializeParser {
  private index = 0;
  constructor(private readonly data: string) {}

  /**
   * @returns `true` if the current character is the last character, otherwise `false`
   */
  private isEoi(): boolean {
    return this.index + 1 >= this.data.length;
  }

  private next(): void {
    if (this.isEoi()) {
      throw new Error(
        "(DeserializeParser#next) Failed to deserialize data: reached EOI before completing parse."
      );
    }

    this.index++;
  }

  private getCurrentChar(): string {
    return this.data[this.index];
  }

  private read(endChars: string[]): string {
    let s = "";
    while (!endChars.includes(this.getCurrentChar())) {
      s += this.getCurrentChar();
      this.next();
    }
    return s;
  }

  private readString(): string {
    let s = "";
    this.next();

    while (this.getCurrentChar() !== '"') {
      const char = this.getCurrentChar();

      if (char === "\\") {
        this.next();

        const char = this.getCurrentChar();
        if (char === '"') {
          s += '"';
        } else if (char === "n") {
          s += "\n";
        } else {
          throw new Error(
            `(DeserializeParser#readString) Could not read string: illegal escape code: '\\${char}'`
          );
        }

        this.next();
        continue;
      }

      s += char;
      this.next();
    }

    this.next();
    return s;
  }

  private readEnchantments(enchantments: Enchantment[] = []): Enchantment[] {
    const id = this.read(["@"]);
    this.next();

    const level = Number(this.read([",", ")"]));
    if (isNaN(level)) {
      throw new Error(
        "(DeserializeParser#readEnchantments) Failed to deserialize data: could not convert enchantment level string to a number."
      );
    }

    enchantments.push({ type: id, level });

    const char = this.getCurrentChar();

    if (char === ",") {
      this.next();
      this.readEnchantments(enchantments);
    } else if (char !== ")") {
      throw new Error(
        `(DeserializeParser#readEnchantments) Failed to deserialize data: could not read enchantments: reached illegal character: '${char}'.`
      );
    }

    return enchantments;
  }

  private readLore(lore: string[] = []): string[] {
    const str = this.readString();

    lore.push(str);

    const char = this.getCurrentChar();

    if (char === ",") {
      this.next();
      this.readLore(lore);
    } else if (char !== " ") {
      throw new Error(
        `(DeserializeParser#readEnchantments) Failed to deserialize data: could not read enchantments: reached illegal character: '${char}'.`
      );
    }

    return lore;
  }

  private parseSingle(): StorageSystemItemStack {
    // parse

    const id = this.read(["("]);
    this.next();

    const amount = Number(this.read([" "]));
    // amount cannot be zero, so use ! instead of isNaN
    if (!amount) {
      throw new Error(
        "(DeserializeParser#parseSingle) Failed to deserialize data: could not convert item stack amount string to a number."
      );
    }
    this.next();

    const nameTag =
      this.getCurrentChar() === '"' ? this.readString() : undefined;
    this.next();

    const damage = Number(this.read([" "]));
    if (isNaN(damage)) {
      throw new Error(
        "(DeserializeParser#parseSingle) Failed to deserialize data: could not convert item stack damage string to a number."
      );
    }
    this.next();

    const lore = this.getCurrentChar() === '"' ? this.readLore() : [];
    this.next();

    const enchantments =
      this.getCurrentChar() === ")" ? [] : this.readEnchantments();

    // make result

    return new StorageSystemItemStack(
      id,
      amount,
      nameTag,
      damage,
      lore,
      enchantments
    );
  }

  parse(): StorageSystemItemStack[] {
    const itemStacks: StorageSystemItemStack[] = [];

    while (!this.isEoi()) {
      itemStacks.push(this.parseSingle());

      if (this.isEoi()) {
        break;
      }

      this.next();
    }

    return itemStacks;
  }
}
