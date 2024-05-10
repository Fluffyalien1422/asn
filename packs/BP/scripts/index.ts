import "./storage_core";
import "./storage_interface";
import "./cable";
import "./script_events";
import "./tutorial_book";

//TODO: make storage interface blocks unbreakable
//TODO: make pre-2.3 storage interface blocks auto-update (add a fluffyalien_asn:2_3_update that is set to true when a new one is placed and
//  when interacting with a storage interface block check the state and if it's false then spawn the entity)
//TODO: make request amount default to half of the amount if there is less than 64, otherwise default to 64
