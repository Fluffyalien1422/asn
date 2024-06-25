/*

serialization format info:

type_id(amount "name tag" damage "lore line 1","lore line 2" "dynamicProperty"@t,"dynamicProperty2"@v0#0#0 enchant@level,enchant2@level)

- damage refers to ItemDurabilityComponent#damage
  (https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemdurabilitycomponent?view=minecraft-bedrock-experimental#damage)

- space is the separator

- enchantments, lore, dynamic properties, and name tag are optional, others are expected
  to have a value even if they're is not used (for example,
  damage is still required for items that have no durability)

- name tag is a string, only double quotes are allowed,
  double quotes inside must be escaped with backslashes \"

- \" and \n are the only valid escape codes in strings

- booleans are represented with t (true) or f (false)

- vectors are represent with v<x value>#<y value>#<z value> (eg. v0#0#0)

- dynamic properties are also used to store some additional data
  - these dynamic properties are fluffyalien_asn namespaced and always start with $
  - these dynamic properties are
    fluffyalien_asn:$potion_effect, fluffyalien_asn:$potion_liquid,
    fluffyalien_asn:$potion_modifier

examples:
minecraft:dirt(1 "my dirt" 0   )
minecraft:dirt(1  0   )
minecraft:wooden_sword(1  0   sharpness@1,unbreaking@2)
*/

import {
  Enchantment,
  EnchantmentType,
  ItemTypes,
  Vector3,
} from "@minecraft/server";
import {
  StorageSystemItemStack,
  StorageSystemItemStackDynamicProperty,
  StorageSystemItemStackPotionData,
} from "./storage_system_item_stack";
import { getEnchantmentTypeId } from "./utils/item";
import { Logger } from "./log";

const log = new Logger("serialize.ts");

export function deserialize(data: string): StorageSystemItemStack[] {
  const parser = new DeserializeParser(data);
  return parser.parse();
}

function serializeString(str: string): string {
  return '"' + str.replaceAll('"', '\\"').replaceAll("\n", "\\n") + '"';
}

function serializeVector(v: Vector3): string {
  return `v${v.x.toString()}#${v.y.toString()}#${v.y.toString()}`;
}

function serializeBoolean(b: boolean): string {
  return b ? "t" : "f";
}

function isVector3(val: object): val is Vector3 {
  return "x" in val && "y" in val && "z" in val;
}

function serializeValue(val: string | number | boolean | Vector3): string {
  const t = typeof val;
  return t === "string"
    ? serializeString(val as string)
    : t === "number"
      ? (val as number).toString()
      : t === "boolean"
        ? serializeBoolean(val as boolean)
        : t === "object" && isVector3(val as object)
          ? serializeVector(val as Vector3)
          : ((): never => {
              throw new Error(
                log.makeRaiseString("serializeValue", `invalid type: ${t}`),
              );
            })();
}

export function serialize(itemStack: StorageSystemItemStack): string {
  const id = itemStack.typeId;
  const amount = itemStack.amount;
  const nameTag = itemStack.nameTag;
  const damage = itemStack.damage;
  const lore = itemStack.lore;
  const dynamicProperties = [...itemStack.dynamicProperties];
  const enchantments = itemStack.enchantments;

  // add additional data as dynamic properties
  if (itemStack.potionData) {
    dynamicProperties.push(
      {
        id: "fluffyalien_asn:$potion_effect",
        value: itemStack.potionData.effect,
      },
      {
        id: "fluffyalien_asn:$potion_liquid",
        value: itemStack.potionData.liquid,
      },
      {
        id: "fluffyalien_asn:$potion_modifier",
        value: itemStack.potionData.modifier,
      },
    );
  }

  return `${id}(${amount.toString()} ${
    nameTag ? serializeString(nameTag) : ""
  } ${damage.toString()} ${
    lore.length ? lore.map((s) => serializeString(s)).join(",") : ""
  } ${dynamicProperties
    .map((prop) => `"${prop.id}"@${serializeValue(prop.value)}`)
    .join(",")} ${enchantments
    .map(
      (enchantment) =>
        `${getEnchantmentTypeId(enchantment)}@${enchantment.level.toString()}`,
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
        log.makeRaiseString(
          "DeserializeParser#next",
          "failed to deserialize data: reached EOI before completing parse",
        ),
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
            log.makeRaiseString(
              "DeserializeParser#readString",
              `failed to deserialize data: could not read string: illegal escape code: '\\${char}'`,
            ),
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

  private readVector(): Vector3 {
    this.next(); // skip v

    const x = Number(this.read(["#"]));
    if (isNaN(x)) {
      throw new Error(
        log.makeRaiseString(
          "DeserializeParser#readVector",
          "failed to deserialize data: could not read vector: could not convert x value from string to number",
        ),
      );
    }
    this.next();

    const y = Number(this.read(["#"]));
    if (isNaN(y)) {
      throw new Error(
        log.makeRaiseString(
          "DeserializeParser#readVector",
          "failed to deserialize data: could not read vector: could not convert y value from string to number",
        ),
      );
    }
    this.next();

    const z = Number(this.read([",", " "]));
    if (isNaN(z)) {
      throw new Error(
        log.makeRaiseString(
          "DeserializeParser#readVector",
          "failed to deserialize data: could not read vector: could not convert z value from string to number",
        ),
      );
    }

    return { x, y, z };
  }

  private readEnchantments(enchantments: Enchantment[] = []): Enchantment[] {
    const id = this.read(["@"]);
    this.next();

    const level = Number(this.read([",", ")"]));
    if (isNaN(level)) {
      throw new Error(
        log.makeRaiseString(
          "DeserializeParser#readEnchantments",
          "failed to deserialize data: could not read enchantments: could not convert enchantment level string to a number",
        ),
      );
    }

    enchantments.push({ type: new EnchantmentType(id), level });

    const char = this.getCurrentChar();

    if (char === ",") {
      this.next();
      this.readEnchantments(enchantments);
    } else if (char !== ")") {
      throw new Error(
        log.makeRaiseString(
          "DeserializeParser#readEnchantments",
          `failed to deserialize data: could not read enchantments: reached illegal character: '${char}'`,
        ),
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
        log.makeRaiseString(
          "DeserializeParser#readLore",
          `failed to deserialize data: could not read lore: reached illegal character: '${char}'`,
        ),
      );
    }

    return lore;
  }

  private readDynamicProperties(
    dynamicProperties: StorageSystemItemStackDynamicProperty[] = [],
  ): StorageSystemItemStackDynamicProperty[] {
    const id = this.readString();
    this.next();

    let value: string | number | boolean | Vector3;
    {
      const char = this.getCurrentChar();
      if (char === '"') {
        value = this.readString();
      } else if (char === "v") {
        value = this.readVector();
      } else if (char === "t") {
        value = true;
        this.next();
      } else if (char === "f") {
        value = false;
        this.next();
      } else {
        value = Number(this.read([",", " "]));
        if (isNaN(value)) {
          throw new Error(
            log.makeRaiseString(
              "DeserializeParser#readDynamicProperties",
              "failed to deserialize data: could not read value of dynamic property: could not convert value from string to number",
            ),
          );
        }
      }
    }

    dynamicProperties.push({ id, value });

    const char = this.getCurrentChar();

    if (char === ",") {
      this.next();
      this.readDynamicProperties(dynamicProperties);
    } else if (char !== " ") {
      throw new Error(
        log.makeRaiseString(
          "DeserializeParser#readDynamicProperties",
          `failed to deserialize data: could not read dynamic properties: reached illegal character: '${char}'`,
        ),
      );
    }

    return dynamicProperties;
  }

  /**
   * @returns the parsed StorageSystemItemStack or undefined if the item ID doesn't exist
   */
  private parseSingle(): StorageSystemItemStack | undefined {
    // parse

    const id = this.read(["("]);
    this.next();

    const amount = Number(this.read([" "]));
    // amount cannot be zero, so use ! instead of isNaN
    if (!amount) {
      throw new Error(
        log.makeRaiseString(
          "DeserializeParser#parseSingle",
          "failed to deserialize data: could not convert item stack amount string to a number",
        ),
      );
    }
    this.next();

    const nameTag =
      this.getCurrentChar() === '"' ? this.readString() : undefined;
    this.next();

    const damage = Number(this.read([" "]));
    if (isNaN(damage)) {
      throw new Error(
        log.makeRaiseString(
          "DeserializeParser#parseSingle",
          "failed to deserialize data: could not convert item stack damage string to a number",
        ),
      );
    }
    this.next();

    const lore = this.getCurrentChar() === '"' ? this.readLore() : [];
    this.next();

    const dynamicPropertiesRaw =
      this.getCurrentChar() === '"' ? this.readDynamicProperties() : [];
    this.next();

    // process dynamic properties
    const dynamicProperties: StorageSystemItemStackDynamicProperty[] = [];
    let potionEffect: string | undefined;
    let potionLiquid: string | undefined;
    let potionModifier: string | undefined;

    for (const rawDynamicProp of dynamicPropertiesRaw) {
      switch (rawDynamicProp.id) {
        case "fluffyalien_asn:$potion_effect":
          potionEffect = rawDynamicProp.value as string;
          break;
        case "fluffyalien_asn:$potion_liquid":
          potionLiquid = rawDynamicProp.value as string;
          break;
        case "fluffyalien_asn:$potion_modifier":
          potionModifier = rawDynamicProp.value as string;
          break;
        default:
          dynamicProperties.push(rawDynamicProp);
      }
    }

    const enchantments =
      this.getCurrentChar() === ")" ? [] : this.readEnchantments();

    // make result

    if (!ItemTypes.get(id)) {
      return;
    }

    const potionData: StorageSystemItemStackPotionData | undefined =
      potionEffect && potionLiquid && potionModifier
        ? {
            effect: potionEffect,
            liquid: potionLiquid,
            modifier: potionModifier,
          }
        : undefined;

    return new StorageSystemItemStack(
      id,
      amount,
      nameTag,
      damage,
      lore,
      dynamicProperties,
      enchantments,
      potionData,
    );
  }

  parse(): StorageSystemItemStack[] {
    const itemStacks: StorageSystemItemStack[] = [];

    while (!this.isEoi()) {
      const item = this.parseSingle();
      if (item) itemStacks.push(item);

      if (this.isEoi()) {
        break;
      }

      this.next();
    }

    return itemStacks;
  }
}
