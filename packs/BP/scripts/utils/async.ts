import { system } from "@minecraft/server";

export type MaybePromise<T> = Promise<T> | T;

export function wait(ticks: number): Promise<void> {
  return new Promise((resolve) => {
    system.runTimeout(resolve, ticks);
  });
}
