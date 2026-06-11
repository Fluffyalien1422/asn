import "./custom_components";
import "./energistics";
import "./script_events";
import "./tutorial_book";
import "./wireless_interface";

//TODO: replace all new ItemStack with safeCreateItemStack function to prevent errors
//TODO: enable useEnergy by default, but keep the rule if players want to disable it.
//TODO: remove fluidStorage, showRequestItemDialog, and forceLoadNetworks rules. fluidStorage and forceLoadNetworks will be always enabled and cannot be disabled (the rule should be removed). showRequestItemDialog is legacy and should be removed entirely.
//TODO: remove legacy drives and disks
//TODO: update legacy bus code and improve export bus and level emitter ui (use an inventory based ui?)
//TODO: update buses to use block entity component and new block dynamic properties
//TODO: test everything: buses, fluid storage, wireless interfaces, relays, etc
//TODO: crafting terminal
//TODO: autocrafting
//TODO: remove all unused code and definitions
//TODO: performance optimizations: don't save items to disk every time an item is added
//TODO: fix: some items are lost when spam adding
//TODO: update legacy code to use Results instead of logging or throwing
//TODO: use custom components v2 and onBreak instead of onPlayerBreak for block components

// crafting interface ui idea:
// crafting button in toolbar: switches items view to show all craftable items
// click a craftable item: opens a form with buttons to craft it
