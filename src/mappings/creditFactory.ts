import { log } from "@graphprotocol/graph-ts";
import { CreatePair } from "../../generated/CreditFactory/CreditFactory";
import { CreditPair as CreditPairTemplate } from "../../generated/templates";
import { getCreditFactory } from "../entities/CreditFactory";
import { BIG_INT_ONE } from "const";
import { getCreditPair } from "../entities/CreditPair";

export function onCreditPairCreated(event: CreatePair): void {
  log.info("lending pair created:\n asset: {}\ncollateral: {}\npair: {}", [
    event.params.asset.toHexString(),
    event.params.collateral.toHexString(),
    event.params.pair.toHexString(),
  ]);

  const factory = getCreditFactory();
  const pair = getCreditPair(event.params.pair, event.block);
  // Now it's safe to save
  pair.save();

  // create the tracked contract based on the template
  CreditPairTemplate.create(event.params.pair);

  // Update pair count once we've sucessesfully created a pair
  factory.pairCount = factory.pairCount.plus(BIG_INT_ONE);
  factory.save();
}
