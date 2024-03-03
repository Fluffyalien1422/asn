import { Enchantment } from "@minecraft/server";
import { StorageSystemItemStack } from "./storage_system_item_stack";

export function serialize(itemStacks: StorageSystemItemStack[]): string {
  let s = "";

  for (const itemStack of itemStacks) {
    s += serializeSingle(itemStack);
  }

  return s;
}

export function deserialize(data: string): StorageSystemItemStack[] {
  const parser = new DeserializeParser(data);
  return parser.parse();
}

function serializeSingle(itemStack: StorageSystemItemStack): string {
  const id = itemStack.typeId;
  const amount = itemStack.amount;
  const nameTag = itemStack.nameTag;
  const damage = itemStack.damage;
  const enchantments = itemStack.enchantments;

  // id(amount "name tag" damage enchant@level,enchant2@level)
  return `${id}(${amount} ${
    nameTag ? `"${nameTag.replaceAll('"', '\\"')}"` : ""
  } ${damage} ${enchantments
    .map(
      (enchantment) =>
        `${
          typeof enchantment.type === "string"
            ? enchantment.type
            : enchantment.type.id
        }@${enchantment.level}`
    )
    .join(",")})`;
}

class DeserializeParser {
  private index = 0;
  constructor(private data: string) {}

  private isEoi(): boolean {
    return this.index + 1 >= this.data.length;
  }

  private next(): void {
    if (this.isEoi()) {
      throw new Error(
        "Failed to deserialize data: reached EOI before completing parse."
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
        s += this.getCurrentChar();
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
        "Failed to deserialize data: could not convert enchantment level string to a number."
      );
    }

    enchantments.push({ type: id, level });

    const char = this.getCurrentChar();

    if (char === ",") {
      this.next();
      this.readEnchantments(enchantments);
    } else if (char === ")") {
      if (!this.isEoi()) this.next();
    } else {
      throw new Error(
        `Failed to deserialize data: could not read enchantments: reached illegal character: '${char}'`
      );
    }

    return enchantments;
  }

  private parseSingle(): StorageSystemItemStack {
    // parse

    const id = this.read(["("]);
    this.next();

    const amount = Number(this.read([" "]));
    // amount cannot be zero, so use ! instead of isNaN
    if (!amount) {
      throw new Error(
        "Failed to deserialize data: could not convert item stack amount string to a number."
      );
    }
    this.next();

    const nameTag =
      this.getCurrentChar() === '"' ? this.readString() : undefined;
    this.next();

    const damage = Number(this.read([" "]));
    if (isNaN(damage)) {
      throw new Error(
        "Failed to deserialize data: could not convert item stack damage string to a number."
      );
    }
    this.next();

    const enchantments =
      this.getCurrentChar() === ")" ? [] : this.readEnchantments();

    // make result

    return new StorageSystemItemStack(
      id,
      amount,
      nameTag,
      damage,
      enchantments
    );
  }

  parse(): StorageSystemItemStack[] {
    const itemStacks: StorageSystemItemStack[] = [];

    while (!this.isEoi()) {
      itemStacks.push(this.parseSingle());
    }

    return itemStacks;
  }
}
