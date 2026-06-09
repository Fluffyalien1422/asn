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

declare const o: Output;
export default o;
