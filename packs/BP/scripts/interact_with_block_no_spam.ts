import {
  PlayerInteractWithBlockAfterEvent,
  system,
  world,
} from "@minecraft/server";

type PlayerInteractWithBlockAfterEventCallback = (
  arg: PlayerInteractWithBlockAfterEvent,
) => void | Promise<void>;

const callbacks: PlayerInteractWithBlockAfterEventCallback[] = [];

let lastPlayerInteractWithBlockTriggerTick = 0;
world.afterEvents.playerInteractWithBlock.subscribe((e) => {
  if (lastPlayerInteractWithBlockTriggerTick + 5 > system.currentTick) return;

  lastPlayerInteractWithBlockTriggerTick = system.currentTick;

  for (const callback of callbacks) {
    void callback(e);
  }
});

/**
 * Forwards the callback to the playerInteractWithBlock after event but does not spam the callback (waits atleast 5 ticks since last trigger)
 */
export function onPlayerInteractWithBlockNoSpam(
  callback: PlayerInteractWithBlockAfterEventCallback,
): void {
  callbacks.push(callback);
}
