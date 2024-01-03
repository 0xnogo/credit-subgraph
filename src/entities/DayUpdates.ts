/* eslint-disable prefer-const */
import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  SWAP_FACTORY_ADDRESS,
  BIG_DECIMAL_ZERO,
  BIG_INT_ONE,
  BIG_INT_ZERO,
} from "const";
import {
  Bundle,
  SwapPair,
  SwapPairDayData,
  SwapPairHourData,
  Token,
  TokenDayData,
  UniswapDayData,
  SwapFactory,
  CreditPoolDayData,
  CreditPairPool,
  CreditPoolHourData,
} from "../../generated/schema";

export function updateUniswapDayData(event: ethereum.Event): UniswapDayData {
  let dex = SwapFactory.load(SWAP_FACTORY_ADDRESS.toHexString()) as SwapFactory;

  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let dexDayData = UniswapDayData.load(dayID.toString());
  if (dexDayData === null) {
    dexDayData = new UniswapDayData(dayID.toString());
    dexDayData.date = dayStartTimestamp;
    dexDayData.dailyVolumeUSD = BIG_DECIMAL_ZERO;
    dexDayData.dailyVolumeETH = BIG_DECIMAL_ZERO;
    dexDayData.totalVolumeUSD = BIG_DECIMAL_ZERO;
    dexDayData.totalVolumeETH = BIG_DECIMAL_ZERO;
    dexDayData.dailyVolumeUntracked = BIG_DECIMAL_ZERO;
  }

  dexDayData.totalLiquidityUSD = dex.totalLiquidityUSD;
  dexDayData.totalLiquidityETH = dex.totalLiquidityETH;
  dexDayData.txCount = dex.txCount;

  dexDayData.save();

  return dexDayData as UniswapDayData;
}

export function updateCreditPoolDayData(
  address: Address,
  blockTimestamp: BigInt,
  maturityInt: BigInt
): CreditPoolDayData {
  let timestamp = blockTimestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;

  const maturity = maturityInt.toString();
  let poolID = address.toHexString().concat("-").concat(maturity);
  const lendingPairPool = CreditPairPool.load(poolID) as CreditPairPool;
  let dayPoolID = poolID.concat("-").concat(BigInt.fromI32(dayID).toString());

  let lendingPoolDayData = CreditPoolDayData.load(dayPoolID);
  if (lendingPoolDayData === null) {
    lendingPoolDayData = new CreditPoolDayData(dayPoolID);
  }

  lendingPoolDayData.date = dayStartTimestamp;
  lendingPoolDayData.assetReserve = lendingPairPool.assetReserve;
  lendingPoolDayData.collateralReserve = lendingPairPool.collateralReserve;
  lendingPoolDayData.X = lendingPairPool.X;
  lendingPoolDayData.Y = lendingPairPool.Y;
  lendingPoolDayData.Z = lendingPairPool.Z;
  lendingPoolDayData.pool = lendingPairPool.id;
  lendingPoolDayData.assetReserveUSD = lendingPairPool.assetReserveUSD;
  lendingPoolDayData.collateralReserveUSD =
    lendingPairPool.collateralReserveUSD;
  lendingPoolDayData.totalBorrowed = lendingPairPool.totalBorrowed;
  lendingPoolDayData.totalLent = lendingPairPool.totalLent;
  lendingPoolDayData.totalRepayed = lendingPairPool.totalRepayed;
  lendingPoolDayData.totalBorrowedUSD = lendingPairPool.totalBorrowedUSD;
  lendingPoolDayData.totalLentUSD = lendingPairPool.totalLentUSD;
  lendingPoolDayData.totalRepayedUSD = lendingPairPool.totalRepayedUSD;

  lendingPoolDayData.save();

  return lendingPoolDayData as CreditPoolDayData;
}

export function updateCreditPoolHourlyData(
  address: Address,
  blockTimestamp: BigInt,
  maturityInt: BigInt
): CreditPoolHourData {
  let timestamp = blockTimestamp.toI32();
  let hourIndex = timestamp / 3600; // get unique hour within unix history
  let hourStartUnix = hourIndex * 3600; // want the rounded effect
  const maturity = maturityInt.toString();
  let poolID = address.toHexString().concat("-").concat(maturity);
  const lendingPairPool = CreditPairPool.load(poolID) as CreditPairPool;
  let dayPoolID = poolID
    .concat("-")
    .concat(BigInt.fromI32(hourIndex).toString());

  let lendingPoolHourData = CreditPoolHourData.load(dayPoolID);
  if (lendingPoolHourData === null) {
    lendingPoolHourData = new CreditPoolHourData(dayPoolID);
  }

  lendingPoolHourData.hourStartUnix = hourStartUnix;
  lendingPoolHourData.assetReserve = lendingPairPool.assetReserve;
  lendingPoolHourData.collateralReserve = lendingPairPool.collateralReserve;
  lendingPoolHourData.X = lendingPairPool.X;
  lendingPoolHourData.Y = lendingPairPool.Y;
  lendingPoolHourData.Z = lendingPairPool.Z;
  lendingPoolHourData.pool = lendingPairPool.id;
  lendingPoolHourData.assetReserveUSD = lendingPairPool.assetReserveUSD;
  lendingPoolHourData.collateralReserveUSD =
    lendingPairPool.collateralReserveUSD;
  lendingPoolHourData.totalBorrowed = lendingPairPool.totalBorrowed;
  lendingPoolHourData.totalLent = lendingPairPool.totalLent;
  lendingPoolHourData.totalRepayed = lendingPairPool.totalRepayed;
  lendingPoolHourData.totalBorrowedUSD = lendingPairPool.totalBorrowedUSD;
  lendingPoolHourData.totalLentUSD = lendingPairPool.totalLentUSD;
  lendingPoolHourData.totalRepayedUSD = lendingPairPool.totalRepayedUSD;

  lendingPoolHourData.save();

  return lendingPoolHourData as CreditPoolHourData;
}

export function updatePairDayData(event: ethereum.Event): SwapPairDayData {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let dayPairID = event.address
    .toHexString()
    .concat("-")
    .concat(BigInt.fromI32(dayID).toString());
  let pair = SwapPair.load(event.address.toHexString()) as SwapPair;

  let pairDayData = SwapPairDayData.load(dayPairID);
  if (pairDayData === null) {
    pairDayData = new SwapPairDayData(dayPairID);
    pairDayData.date = dayStartTimestamp;
    pairDayData.token0 = pair.token0;
    pairDayData.token1 = pair.token1;
    pairDayData.pair = event.address.toHexString();
    pairDayData.dailyVolumeToken0 = BIG_DECIMAL_ZERO;
    pairDayData.dailyVolumeToken1 = BIG_DECIMAL_ZERO;
    pairDayData.dailyVolumeUSD = BIG_DECIMAL_ZERO;
    pairDayData.dailyTxns = BIG_INT_ZERO;
  }

  pairDayData.totalSupply = pair.totalSupply;
  pairDayData.reserve0 = pair.reserve0;
  pairDayData.reserve1 = pair.reserve1;
  pairDayData.reserveUSD = pair.reserveUSD;
  pairDayData.dailyTxns = pairDayData.dailyTxns.plus(BIG_INT_ONE);
  pairDayData.save();

  return pairDayData as SwapPairDayData;
}

export function updatePairHourData(event: ethereum.Event): SwapPairHourData {
  let timestamp = event.block.timestamp.toI32();
  let hourIndex = timestamp / 3600; // get unique hour within unix history
  let hourStartUnix = hourIndex * 3600; // want the rounded effect
  let hourPairID = event.address
    .toHexString()
    .concat("-")
    .concat(BigInt.fromI32(hourIndex).toString());
  let pair = SwapPair.load(event.address.toHexString()) as SwapPair;
  let pairHourData = SwapPairHourData.load(hourPairID);

  if (pairHourData === null) {
    pairHourData = new SwapPairHourData(hourPairID);
    pairHourData.hourStartUnix = hourStartUnix;
    pairHourData.pair = event.address.toHexString();
    pairHourData.hourlyVolumeToken0 = BIG_DECIMAL_ZERO;
    pairHourData.hourlyVolumeToken1 = BIG_DECIMAL_ZERO;
    pairHourData.hourlyVolumeUSD = BIG_DECIMAL_ZERO;
    pairHourData.hourlyTxns = BIG_INT_ZERO;
  }

  pairHourData.totalSupply = pair.totalSupply;
  pairHourData.reserve0 = pair.reserve0;
  pairHourData.reserve1 = pair.reserve1;
  pairHourData.reserveUSD = pair.reserveUSD;
  pairHourData.hourlyTxns = pairHourData.hourlyTxns.plus(BIG_INT_ONE);
  pairHourData.save();

  return pairHourData as SwapPairHourData;
}

export function updateTokenDayData(
  token: Token,
  event: ethereum.Event
): TokenDayData {
  let bundle = Bundle.load("1") as Bundle;

  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let tokenDayID = token.id
    .toString()
    .concat("-")
    .concat(BigInt.fromI32(dayID).toString());

  let tokenDayData = TokenDayData.load(tokenDayID);
  if (tokenDayData === null) {
    tokenDayData = new TokenDayData(tokenDayID);
    tokenDayData.date = dayStartTimestamp;
    tokenDayData.token = token.id;

    tokenDayData.priceUSD = (token.derivedETH as BigDecimal).times(
      bundle.ethPrice
    );

    tokenDayData.dailyVolumeToken = BIG_DECIMAL_ZERO;
    tokenDayData.dailyVolumeETH = BIG_DECIMAL_ZERO;
    tokenDayData.dailyVolumeUSD = BIG_DECIMAL_ZERO;
    tokenDayData.dailyTxns = BIG_INT_ZERO;
    tokenDayData.totalLiquidityUSD = BIG_DECIMAL_ZERO;
  }

  tokenDayData.priceUSD = (token.derivedETH as BigDecimal).times(
    bundle.ethPrice
  );
  tokenDayData.totalLiquidityToken = token.totalLiquidity;
  tokenDayData.totalLiquidityETH = token.totalLiquidity.times(
    token.derivedETH as BigDecimal
  );
  tokenDayData.totalLiquidityUSD = tokenDayData.totalLiquidityETH.times(
    bundle.ethPrice
  );
  tokenDayData.dailyTxns = tokenDayData.dailyTxns.plus(BIG_INT_ONE);
  tokenDayData.save();

  /**
   * @todo test if this speeds up sync
   */
  // updateStoredTokens(tokenDayData as TokenDayData, dayID)
  // updateStoredPairs(tokenDayData as TokenDayData, dayPairID)

  return tokenDayData as TokenDayData;
}

// const inPool = pool.X;
// const totalX = pool.totalLent;
// const xDecrease = totalX.minus(inPool)
// const utilRate = xDecrease.div(totalX)

// const K = pool.X.mul(pool.Y).mul(pool.Z)

// const yMax = K.div(totalX.minus(xDecrease).mul(pool.Z)).sub(pool.Y)

// const yMin = yMax.div(16)

// const interestRateMin = yMin.mul(31556926).div(xDecrease)
// const interestRateMax = yMax.mul(31556926).div(xDecrease)

// const interestRateAvg = interestRateMin.plus(interestRateMax).div(2)
