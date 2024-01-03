import { Address } from "@graphprotocol/graph-ts";
import { BIG_INT_ZERO, LENDING_FACTORY_ADDRESS } from "const";
import { CreditFactory } from "../../generated/schema";

export function getCreditFactory(
  id: Address = LENDING_FACTORY_ADDRESS
): CreditFactory {
  let factory = CreditFactory.load(id.toHexString());

  if (factory === null) {
    factory = new CreditFactory(id.toHexString());
    factory.pairCount = BIG_INT_ZERO;
    factory.save();
  }

  return factory as CreditFactory;
}
