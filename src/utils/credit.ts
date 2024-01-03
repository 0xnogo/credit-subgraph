import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { convertInttoUSD } from "./pricing";
import { BIG_DECIMAL_1E2, BIG_DECIMAL_ZERO } from "const";

export function calculateAPR(y:BigInt,x:BigInt):BigDecimal{
    const bdY = y.toBigDecimal()
    const bdX = x.toBigDecimal()
    const SECONDS = BigDecimal.fromString('31556926');
    const shr = BigInt.fromString('2').pow(32).toBigDecimal();
    return bdY.times(SECONDS).div(bdX.times(shr)).times(BIG_DECIMAL_1E2);
}

export function calculateCdp (
    x: BigInt,
    z: BigInt,
    asset: string,
    collateral: string,
  ):BigDecimal{
    const denominator = convertInttoUSD(x,asset)
    if(denominator.equals(BIG_DECIMAL_ZERO)) return BIG_DECIMAL_ZERO;
    return convertInttoUSD(z,collateral).div(denominator).times(BIG_DECIMAL_1E2);
};
