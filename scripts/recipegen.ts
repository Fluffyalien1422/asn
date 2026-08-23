/**
 * Generates the `packs/BP/scripts/generated/__recipes.js` file, which maps each
 * result item ID to the crafting recipes that produce it. Only shaped and
 * shapeless recipes tagged `crafting_table` are included.
 *
 * Run with two or three positional arguments, each a path to a directory of
 * recipe JSON files:
 *
 *   node scripts/recipegen.ts <vanilla recipes> <asn recipes> [additional recipes]
 *
 *   0. Vanilla recipes path    (required) Vanilla crafting recipe JSON files.
 *   1. ASN recipes path        (required) This add-on's recipe JSON files.
 *   2. Additional recipes path (optional) Extra recipe JSON files to include,
 *      e.g. when bundling ASN with other add-ons (see the "Bundling With Other
 *      Add-Ons" section of the README).
 *
 * Recipes from every provided directory are merged into a single output. Legacy
 * item references with data values are resolved to flattened IDs via OVERRIDES.
 */

import * as fs from "fs";
import * as path from "path";
import jsonc from "jsonc-parser";

//#region Overrides
// Key syntax: <ID>:<DATA|*>
// Value syntax: <ID|null>
const OVERRIDES: Record<string, string | null> = {
  "minecraft:sign": "minecraft:oak_sign",
  "minecraft:boat:4": "minecraft:acacia_boat",
  "minecraft:chest_boat:4": "minecraft:acacia_chest_boat",
  "minecraft:boat:7": "minecraft:bamboo_raft",
  "minecraft:chest_boat:7": "minecraft:bamboo_chest_raft",
  "minecraft:bamboo_planks:4": "minecraft:bamboo_planks",
  "minecraft:banner_pattern:4": "minecraft:field_masoned_banner_pattern",
  "minecraft:skull:4": "minecraft:creeper_head",
  "minecraft:banner_pattern:2": "minecraft:flower_banner_pattern",
  "minecraft:skull:1": "minecraft:wither_skeleton_skull",
  "minecraft:banner_pattern:1": "minecraft:skull_banner_pattern",
  "minecraft:banner_pattern:3": "minecraft:mojang_banner_pattern",
  "minecraft:banner_pattern:5": "minecraft:bordure_indented_banner_pattern",
  "minecraft:emptymap:1": "minecraft:empty_map",
  "minecraft:emptymap:2": null, // Locator Map - No flattened ID.
  "minecraft:boat:2": "minecraft:birch_boat",
  "minecraft:chest_boat:2": "minecraft:birch_chest_boat",
  "minecraft:dye:16": "minecraft:black_dye",
  "minecraft:banner:*": null, // No flattened IDs for banner colors.
  "minecraft:dye:18": "minecraft:blue_dye",
  "minecraft:dye:4": "minecraft:lapis_lazuli",
  "minecraft:dye:15": "minecraft:bone_meal",
  "minecraft:dye:17": "minecraft:brown_dye",
  "minecraft:dye:3": "minecraft:cocoa_beans",
  "minecraft:bucket:1": "minecraft:milk_bucket",
  "minecraft:dye:6": "minecraft:cyan_dye",
  "minecraft:dye:2": "minecraft:green_dye",
  "minecraft:boat:5": "minecraft:dark_oak_boat",
  "minecraft:chest_boat:5": "minecraft:dark_oak_chest_boat",
  "minecraft:dispenser:3": "minecraft:dispenser",
  "minecraft:dropper:3": "minecraft:dropper",
  "minecraft:dye:8": "minecraft:gray_dye",
  "minecraft:dye:19": "minecraft:white_dye",
  "minecraft:boat:3": "minecraft:jungle_boat",
  "minecraft:chest_boat:3": "minecraft:jungle_chest_boat",
  "minecraft:dye:12": "minecraft:light_blue_dye",
  "minecraft:dye:7": "minecraft:light_gray_dye",
  "minecraft:carpet:8": "minecraft:light_gray_crapet",
  "minecraft:dye:10": "minecraft:lime_dye",
  "minecraft:carpet:5": "minecraft:lime_carpet",
  "minecraft:dye:13": "minecraft:magenta_dye",
  "minecraft:dye:1": "minecraft:red_dye",
  "minecraft:dye:9": "minecraft:pink_dye",
  "minecraft:dye:5": "minecraft:purple_dye",
  "minecraft:mangrove_planks:4": "minecraft:mangrove_planks",
  "minecraft:boat:6": "minecraft:mangrove_boat",
  "minecraft:chest_boat:6": "minecraft:mangrove_chest_boat",
  "minecraft:dye:14": "minecraft:orange_dye",
  "minecraft:dye:11": "minecraft:yellow_dye",
  "minecraft:quartz_block:2": "minecraft:quartz_pillar",
  "minecraft:piston:1": "minecraft:piston",
  "minecraft:boat:1": "minecraft:spruce_boat",
  "minecraft:chest_boat:1": "minecraft:spruce_chest_boat",
  "minecraft:sticky_piston:1": "minecraft:sticky_piston",
  "minecraft:suspicious_stew:*": null, // No flattened IDs for Suspicious Stew variants.
};
//#endregion Overrides

//#region Types
/**
 * [id, count]
 * If 'id' starts with '#' then it is a tag.
 */
type RecipeItem = [string, number];
/**
 * [count, ingredients]
 */
type RecipeData = [number, RecipeItem[]];
/**
 * resultId: recipes
 */
type Output = Record<string, RecipeData[]>;

interface VanillaItemRef {
  item?: string;
  tag?: string;
  data?: number;
  count?: number;
}
interface VanillaRecipe {
  description: {
    identifier: string;
  };
  tags: string[];
  result: VanillaItemRef;
}
interface VanillaRecipeShapeless extends VanillaRecipe {
  ingredients: VanillaItemRef[];
}
interface VanillaRecipeShaped extends VanillaRecipe {
  pattern: string[];
  key: Record<string, VanillaItemRef>;
}
//#endregion Types

//#region Prepare
console.log("Preparing...");

function readPathArg(argIndex: number, name: string): string;
function readPathArg(
  argIndex: number,
  name: string,
  optional: boolean,
): string | undefined;
function readPathArg(
  argIndex: number,
  name: string,
  optional = false,
): string | undefined {
  const argvIndex = argIndex + 2;
  if (process.argv.length <= argvIndex) {
    if (optional) return;
    throw new Error(
      `Invalid argument ${argIndex.toString()} (${name}): Argument does not exist.`,
    );
  }
  const p = path.normalize(process.argv[argvIndex]);
  console.log(`${name}: ${p}`);
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
    throw new Error(
      `Invalid argument ${argIndex.toString()} (${name}): Path does not exist or does not point to a directory.`,
    );
  }
  return p;
}
const recipesPath = readPathArg(0, "Vanilla recipes path");
const asnRecipesPath = readPathArg(1, "ASN recipes path");
const additionalRecipesPath = readPathArg(2, "Additional recipes path", true);

const scriptsGeneratedDirPath = "packs/BP/scripts/generated";
if (!fs.existsSync(scriptsGeneratedDirPath)) {
  fs.mkdirSync(scriptsGeneratedDirPath, { recursive: true });
}
//#endregion Prepare

//#region Generate
console.log("Generating...");

// Maps the result item ID to the recipe data.
const output: Output = {};

function setRecipeData(item: string, data: RecipeData): void {
  if (!(item in output)) output[item] = [];
  output[item].push(data);
}

function hasValidTag(content: VanillaRecipe): boolean {
  return content.tags.includes("crafting_table");
}

function parseItemRef(ref: VanillaItemRef): RecipeItem | null {
  const count = ref.count ?? 1;

  let item = ref.item;
  if (!item) {
    if (!ref.tag) return null;
    return ["#" + ref.tag, count];
  }

  if (!item.includes(":")) item = `minecraft:${item}`;
  if (ref.data) {
    const override = `${item}:${ref.data.toString()}`;
    if (override in OVERRIDES) {
      const v = OVERRIDES[override];
      if (v === null) return null;
      item = v;
    } else {
      const overrideStar = `${item}:*`;
      if (overrideStar in OVERRIDES) {
        const v = OVERRIDES[overrideStar];
        if (v === null) return null;
        item = v;
      } else {
        console.warn(`No override found for '${override}'.`);
      }
    }
  } else if (item in OVERRIDES) {
    const v = OVERRIDES[item];
    if (!v) return null;
    item = v;
  }

  return [item, count];
}

function parseShapeless(content: VanillaRecipeShapeless): void {
  if (!hasValidTag(content)) return;

  const ingredientsMap: Record<string, number> = {};
  for (const ingredientItemRef of content.ingredients) {
    const ingredient = parseItemRef(ingredientItemRef);
    if (ingredient === null) return;
    ingredientsMap[ingredient[0]] =
      (ingredientsMap[ingredient[0]] ?? 0) + ingredient[1];
  }

  const result = parseItemRef(content.result);
  if (result === null) return;

  setRecipeData(result[0], [result[1], Object.entries(ingredientsMap)]);
}

function parseShaped(content: VanillaRecipeShaped): void {
  if (!hasValidTag(content)) return;

  const ingredientsMap: Record<string, number> = {};
  for (const row of content.pattern) {
    for (const char of row) {
      if (!(char in content.key)) continue;
      const ingredientItemRef = content.key[char];
      const ingredient = parseItemRef(ingredientItemRef);
      if (ingredient === null) return;
      ingredientsMap[ingredient[0]] =
        (ingredientsMap[ingredient[0]] ?? 0) + ingredient[1];
    }
  }

  const result = parseItemRef(content.result);
  if (result === null) return;

  setRecipeData(result[0], [result[1], Object.entries(ingredientsMap)]);
}

function readAndParseFile(basePath: string, fileName: string): void {
  const content = jsonc.parse(
    fs.readFileSync(path.join(basePath, fileName), "utf8"),
  ) as object;

  if ("minecraft:recipe_shapeless" in content) {
    parseShapeless(
      content["minecraft:recipe_shapeless"] as VanillaRecipeShapeless,
    );
  } else if ("minecraft:recipe_shaped" in content) {
    parseShaped(content["minecraft:recipe_shaped"] as VanillaRecipeShaped);
  }
}

for (const fileName of fs.readdirSync(recipesPath)) {
  readAndParseFile(recipesPath, fileName);
}
for (const fileName of fs.readdirSync(asnRecipesPath)) {
  readAndParseFile(asnRecipesPath, fileName);
}
if (additionalRecipesPath !== undefined) {
  for (const fileName of fs.readdirSync(additionalRecipesPath)) {
    readAndParseFile(additionalRecipesPath, fileName);
  }
}

//#endregion Generate

//#region Finish up
console.log("Finishing up...");

fs.writeFileSync(
  path.join(scriptsGeneratedDirPath, "__recipes.js"),
  `export default ${JSON.stringify(output)};`,
);
//#endregion Finish up

console.log("Done.");
