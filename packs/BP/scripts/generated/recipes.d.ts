type RecipeItem = [string, number];
interface RecipeData {
  input: RecipeItem[];
  count: number;
}
type Output = Record<string, RecipeData[]>;
declare const o: Output;
export default o;
