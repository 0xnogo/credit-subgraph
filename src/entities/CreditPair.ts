import { Address, ethereum } from "@graphprotocol/graph-ts";
import { BIG_INT_ZERO, LENDING_FACTORY_ADDRESS } from "const";
import { CreditPair } from "../../generated/schema";
import { CreditPair as CreditPairContract } from "../../generated/templates/CreditPair/CreditPair";
import { getToken } from "./Token";

export function getCreditPair(
  address: Address,
  block: ethereum.Block
): CreditPair {
  let pair = CreditPair.load(address.toHexString());
  if (pair === null) {
    const pairContract = CreditPairContract.bind(address);
    // asset token
    const assetTokenAddress = pairContract.asset();
    const assetToken = getToken(assetTokenAddress);
    assetToken.save();
    // collateral token
    const collateralTokenAddress = pairContract.collateral();
    const collateralToken = getToken(collateralTokenAddress);
    collateralToken.save();
    pair = new CreditPair(address.toHexString());
    pair.factory = LENDING_FACTORY_ADDRESS.toHexString();
    pair.name = assetToken.symbol.concat("-").concat(collateralToken.symbol);
    pair.asset = assetToken.id;
    pair.collateral = collateralToken.id;
    pair.poolCount = BIG_INT_ZERO;
    pair.timestamp = block.timestamp;
    pair.block = block.number;
    // pair fees
    pair.fee = pairContract.lpFee();
    pair.protocolFee = pairContract.protocolFee();
    pair.stakingFee = pairContract.stakingFee();
    pair.save();
  }
  return pair as CreditPair;
}
