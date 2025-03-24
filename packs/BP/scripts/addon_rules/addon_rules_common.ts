import { Player, world } from "@minecraft/server";
import { AddonRuleCommand } from "./set_addon_rule";

export function sendRuleValueMessage(
  player: Player,
  rule: string,
  value: number | boolean,
): void {
  player.sendMessage(`§s${rule}§r = §p${value.toString()}`);
}

export function sendCurrentRuleValueMessage(
  player: Player,
  rule: string,
  ruleCommand: AddonRuleCommand,
): void {
  sendRuleValueMessage(player, rule, ruleCommand.property.get(world));
}
