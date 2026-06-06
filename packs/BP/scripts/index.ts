import "./custom_components";
import "./energistics";
import "./script_events";
import "./tutorial_book";
import "./wireless_interface";

//TODO: enable useEnergy by default, but keep the rule if players want to disable it.
//TODO: remove fluidStorage, showRequestItemDialog, and forceLoadNetworks rules. fluidStorage and forceLoadNetworks will be always enabled and cannot be disabled (the rule should be removed). showRequestItemDialog is legacy and should be removed entirely.
//TODO: different disk sizes (64 and 32?)
//TODO: remove legacy drives and disks
//TODO: update legacy bus code and improve export bus and level emitter ui (use an inventory based ui?)
//TODO: test everything: buses, fluid storage, wireless interfaces, relays, etc
