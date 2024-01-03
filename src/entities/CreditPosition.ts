import { BIG_INT_ONE } from "const";
import { CreditPair, CreditPairPool, CreditPosition } from "../../generated/schema";
import { calculateAPR, calculateCdp } from "../utils/credit";
import { getCreditFactory } from "./CreditFactory";
import { getOrCreateUser } from "../utils/helpers";
import { Address, BigInt } from "@graphprotocol/graph-ts";

export function createCreditPosition(
  pool:CreditPairPool,
  pair:CreditPair,
  owner:string,
  positionType:number,
  tokenId:string,
  totalAmount:BigInt,
  totalDebt:BigInt
): void {
    const creditPositionMetric = new CreditPosition(tokenId);
    getOrCreateUser(Address.fromString(owner));
    creditPositionMetric.owner = owner;
    creditPositionMetric.pool = pool.id;
    creditPositionMetric.APR = calculateAPR(pool.Y,pool.X);
    creditPositionMetric.CDP = calculateCdp(pool.X,pool.Z,pair.asset,pair.collateral);
    creditPositionMetric.positionType = positionType.toString();
    creditPositionMetric.borrowAmount = totalAmount;
    creditPositionMetric.debt = totalDebt;
    creditPositionMetric.save();
}
