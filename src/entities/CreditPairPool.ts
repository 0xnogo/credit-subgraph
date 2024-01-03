import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  ADDRESS_ZERO,
  BIG_DECIMAL_ZERO,
  BIG_INT_ONE,
  BIG_INT_ZERO,
  CONVENIENCE_ADDRESS,
} from "const";
import {
  LockedDebtToken,
  CreditPair,
  CreditPairPool,
  Token,
} from "../../generated/schema";
import { LockedDebt as LockedDebtTemplate } from "../../generated/templates";
import {
  LockedDebt,
  Transfer as LockedDebtTransfer,
} from "../../generated/templates/LockedDebt/LockedDebt";
import { CreditRouter as CreditRouterContract } from "../../generated/CreditPositionManager/CreditRouter";
import { CreditPair as LendingPairContract } from "../../generated/templates/CreditPair/CreditPair";
import { getOrCreateUser } from "../utils/helpers";
import { convertInttoUSD } from "../utils/pricing";

export function getCreditPairPool(
  pairAddress: Address,
  maturity: BigInt,
  block: ethereum.Block
): CreditPairPool | null {
  const poolId = pairAddress
    .toHexString()
    .concat("-")
    .concat(maturity.toString());
  let lendingPairPool = CreditPairPool.load(poolId);

  if (lendingPairPool === null) {
    const lendingPair = CreditPair.load(pairAddress.toHexString());
    // const convenienceContract = CreditRouterContract.bind(CONVENIENCE_ADDRESS);
    if (!lendingPair) {
      return null;
    }
    lendingPair.poolCount = lendingPair.poolCount.plus(BIG_INT_ONE);

    lendingPairPool = new CreditPairPool(poolId);
    lendingPairPool.pair = pairAddress.toHexString();
    lendingPairPool.maturity = maturity;

    lendingPairPool.timestamp = block.timestamp;
    lendingPairPool.block = block.number;

    lendingPairPool.X = BIG_INT_ZERO;
    lendingPairPool.Y = BIG_INT_ZERO;
    lendingPairPool.Z = BIG_INT_ZERO;
    lendingPairPool.assetReserve = BIG_INT_ZERO;
    lendingPairPool.collateralReserve = BIG_INT_ZERO;
    lendingPairPool.assetReserveUSD = BIG_DECIMAL_ZERO;
    lendingPairPool.collateralReserveUSD = BIG_DECIMAL_ZERO;
    lendingPairPool.totalBorrowed = BIG_INT_ZERO;
    lendingPairPool.totalLent = BIG_INT_ZERO;
    lendingPairPool.totalRepayed = BIG_INT_ZERO;
    lendingPairPool.totalBorrowedUSD = BIG_DECIMAL_ZERO;
    lendingPairPool.totalLentUSD = BIG_DECIMAL_ZERO;
    lendingPairPool.totalRepayedUSD = BIG_DECIMAL_ZERO;
    // lendingPairPool.totalCollateral = BIG_INT_ZERO;
    // lendingPairPool.totalCollateralUSD = BIG_DECIMAL_ZERO;
    lendingPairPool.totalDebtUSD = BIG_DECIMAL_ZERO;


    lendingPairPool.farm = null;

    lendingPairPool.totalFee = BIG_INT_ZERO;
    lendingPairPool.totalDebt = BIG_INT_ZERO;
    lendingPairPool.totalDebtUSD = BIG_DECIMAL_ZERO;

    lendingPairPool.totalFeeUSD = BIG_DECIMAL_ZERO;
    lendingPairPool.transactionCount = BIG_INT_ZERO;
    lendingPairPool.lendTransactionCount = BIG_INT_ZERO;
    lendingPairPool.borrowTransactionCount = BIG_INT_ZERO;
    lendingPairPool.liquidityTransactionCount = BIG_INT_ZERO;
    lendingPair.save();
    lendingPairPool.save();

    // create collateralizedDebt template to track transfers
    // LockedDebtTemplate.create(natives.lockedDebt);
  }

  return lendingPairPool as CreditPairPool;
}

export function createLockedDebtToken(
  pool: CreditPairPool,
  tokenId: BigInt
): void {
  // const collateralizedDebtContract = LockedDebt.bind(
  //   Address.fromString(pool.lockedDebtAddress.toHexString())
  // );
  // const owner = collateralizedDebtContract.ownerOf(tokenId);
  // const user = getOrCreateUser(owner);
  // const borrowPosition = new LockedDebtToken(
  //   pool.lockedDebtAddress
  //     .toHexString()
  //     .concat("-")
  //     .concat(tokenId.toString())
  // );
  // borrowPosition.user = user.id;
  // borrowPosition.pool = pool.id;
  // borrowPosition.lockedDebtAddress = pool.lockedDebtAddress;
  // borrowPosition.tokenId = tokenId;
  // borrowPosition.save();
}

export function updateLockedDebtToken(
  event: LockedDebtTransfer
): void {
  // ignore token mints, token gets created in the borrow handler
  if (event.params.from == ADDRESS_ZERO) return;
  const id = event.address
    .toHexString()
    .concat("-")
    .concat(event.params.tokenId.toString());
  const collateralizedDebtToken = LockedDebtToken.load(id);
  if (collateralizedDebtToken === null) {
    // ignore liquidity cdt transfer, only borrow CDTs are persisted
    return;
  }
  const user = getOrCreateUser(event.params.to);
  collateralizedDebtToken.user = user.id;
  collateralizedDebtToken.save();
}

export function updateConstantProduct(
  pairAddress: Address,
  maturity: BigInt,
  X: BigInt,
  Y: BigInt,
  Z: BigInt
): void {
  const poolId = pairAddress
    .toHexString()
    .concat("-")
    .concat(maturity.toString());
  const pool = CreditPairPool.load(poolId);
  if (pool === null) return;
  pool.X = X;
  pool.Y = Y;
  pool.Z = Z;
  pool.save();
}

export function updatePoolReserves(
  pairAddress: Address,
  maturity: BigInt
): void {
  const pairContract = LendingPairContract.bind(pairAddress);
  const poolId = pairAddress
    .toHexString()
    .concat("-")
    .concat(maturity.toString());
  const pool = CreditPairPool.load(poolId);
  if (pool === null) return;

  const reserves = pairContract.totalReserves(maturity);
  pool.assetReserve = reserves.asset;
  pool.collateralReserve = reserves.collateral;

  // get new amounts of USD and ETH for tracking
  const lendingPair = CreditPair.load(
    pairAddress.toHexString()
  ) as CreditPair;

  let asset = Token.load(lendingPair.asset) as Token;
  let collateral = Token.load(lendingPair.collateral) as Token;
  pool.assetReserveUSD = convertInttoUSD(reserves.asset,asset.id);
  pool.collateralReserveUSD = convertInttoUSD(reserves.collateral,collateral.id);
  pool.save();
}
