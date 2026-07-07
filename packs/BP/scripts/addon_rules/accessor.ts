import { Result, ok, err } from "neverthrow";
import {
  DynamicPropertyAccessor,
  DynamicPropertyValue,
  HasDynamicProperties,
} from "../utils/dynamic_property_v3";
import { Block, world } from "@minecraft/server";

/**
 * A {@link DynamicPropertyAccessor} for an addon rule stored on the world.
 *
 * Unlike the base accessor, the target is always the {@link world}, so callers
 * never pass one. A rule may also be locked: a locked rule always reports its
 * {@link defaultValue} and rejects any attempt to change it.
 */
export class RuleAccessor<
  T extends DynamicPropertyValue,
> extends DynamicPropertyAccessor<T, T> {
  /**
   * @param id - The dynamic property id used to store the rule on the world.
   * @param defaultValue - The value returned when the rule is unset or locked.
   * @param isLocked - When `true`, the rule cannot be changed and always
   * resolves to {@link defaultValue}.
   */
  constructor(
    id: string,
    defaultValue: T,
    readonly isLocked: boolean,
  ) {
    super(id, defaultValue);
  }

  /**
   * Gets the rule's current value from the world, or {@link defaultValue} if it
   * is unset. A locked rule always returns {@link defaultValue}.
   */
  get(): Result<T, Error> {
    return this.isLocked ? ok(this.defaultValue) : super.get(world);
  }

  /**
   * Like {@link get}, but returns {@link defaultValue} instead of an error on
   * failure.
   */
  safeGet(): T {
    return this.get().match(
      /* ok */ (v) => v,
      /* err */ () => this.defaultValue,
    );
  }

  /**
   * Sets the rule's value on the world.
   *
   * @param target - Ignored; the target is always the {@link world}. Present
   * only to satisfy the base class signature — prefer {@link setRule}.
   * @param value - The value to store.
   * @returns An error if the rule is locked, otherwise the result of the set.
   */
  set(target?: HasDynamicProperties | Block, value?: T): Result<void, Error> {
    return this.isLocked
      ? err(new Error(`Cannot set value for locked accessor '${this.id}'.`))
      : super.set(world, value);
  }

  /**
   * Sets the rule's value on the world. Convenience wrapper around {@link set}
   * that omits the ignored target argument.
   *
   * @param value - The value to store.
   * @returns An error if the rule is locked, otherwise the result of the set.
   */
  setRule(value?: T): Result<void, Error> {
    return this.set(undefined, value);
  }
}
