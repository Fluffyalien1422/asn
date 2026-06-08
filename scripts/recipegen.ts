/**
 * Generates the packs/BP/scripts/generated/recipes.js file
 */

import * as fs from "fs";
import * as path from "path";

//#region Overrides
// Key syntax: <ID>:<DATA|*>
// Value syntax: <ID|null>
const OVERRIDES: Record<string, string | null> = {
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
  "piston:1": "minecraft:piston",
  "minecraft:boat:1": "minecraft:spruce_boat",
  "minecraft:chest_boat:1": "minecraft:spruce_chest_boat",
  "minecraft:sticky_piston:1": "minecraft:sticky_piston",
  "minecraft:suspicious_stew:*": null, // No flattened IDs for Suspicious Stew variants.
};
//#endregion Overrides

//#region Types
/**
 * [id, count]
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
  item: string;
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
console.log("Preparing.");

if (process.argv.length < 3) {
  throw new Error("Expected path to vanilla 'recipes' directory.");
}
const recipesPath = path.normalize(process.argv[2]);
console.log(`Recipes path: ${recipesPath}`);
if (!fs.existsSync(recipesPath) || !fs.statSync(recipesPath).isDirectory()) {
  throw new Error(
    "Provided recipes path does not exist or does not point to a directory.",
  );
}

const scriptsGeneratedDirPath = "packs/BP/scripts/generated";
if (!fs.existsSync(scriptsGeneratedDirPath)) {
  fs.mkdirSync(scriptsGeneratedDirPath);
}
//#endregion Prepare

//#region Generate
console.log("Generating.");

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
  let item = ref.item;
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
  }

  return [item, ref.count ?? 1];
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

for (const fileName of fs.readdirSync(recipesPath)) {
  const content = JSON.parse(
    fs.readFileSync(path.join(recipesPath, fileName), "utf8"),
  ) as object;

  if ("minecraft:recipe_shapeless" in content) {
    parseShapeless(
      content["minecraft:recipe_shapeless"] as VanillaRecipeShapeless,
    );
  } else if ("minecraft:recipe_shaped" in content) {
    parseShaped(content["minecraft:recipe_shaped"] as VanillaRecipeShaped);
  }
}

//#endregion Generate

//#region Finish up
console.log("Finishing up.");

fs.writeFileSync(
  path.join(scriptsGeneratedDirPath, "recipes.js"),
  `export default ${JSON.stringify(output)};`,
);
//#endregion Finish up

console.log("Done.");
