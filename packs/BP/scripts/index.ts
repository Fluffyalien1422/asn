import "./commands";
import "./custom_components";
import "./energistics";
import "./tutorial_book";
import "./wireless_interface";

//TODO: remove BUILD_DETAILS as there is now only one build, standalone is now legacy.
//TODO: update legacy bus code and improve export bus and level emitter ui (use an inventory based ui?)
//TODO: update buses to use block entity component and new block dynamic properties
//TODO: test everything: buses, fluid storage, wireless interfaces, relays, etc
//TODO: advanced crafting: craft ingredients needed for a recipe.
//TODO: remove all unused code and definitions
//TODO: update tutorial book entries
//TODO: rebalance energy consumption

//TODO: disk upgrader - updates a 32 disk to 64. preserves the items stored in the 32 disk. requires energy is 'useEnergy' is enabled.
//TODO: autocrafter - connects to the storage network and automatically crafts items. interact with an item to set the recipe. can be disabled with redstone (for configurability with level emitter).
//TODO: update disk textures
