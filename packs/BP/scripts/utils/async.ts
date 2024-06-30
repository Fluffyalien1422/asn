import { system } from "@minecraft/server";

export function wait(ticks: number): Promise<void> {
  return new Promise((resolve) => {
    system.runTimeout(resolve, ticks);
  });
}
