import { BigInt, log } from "@graphprotocol/graph-ts";
import {
  Borrow,
  Burn,
  Lend,
  Mint,
  Pay,
  Sync,
  Withdraw,
} from "../../generated/CreditFactory/CreditPair";
import { Transfer as LockedDebtTransfer } from "../../generated/templates/LockedDebt/LockedDebt";
import {
  createLockedDebtToken,
  getCreditPair,
  getCreditPairPool,
  updateLockedDebtToken,
  updateConstantProduct,
  updatePoolReserves,
  getCreditFactory,
} from "../entities";
import { CreditPairPool, CreditTransaction, Token } from "../../generated/schema";
import {
  updateCreditPoolDayData,
  updateCreditPoolHourlyData,
} from "../entities/DayUpdates";
import { convertInttoUSD } from "../utils/pricing";
import { createCreditTransaction } from "../entities/CreditTransaction";
import { BIG_INT_ONE, BIG_INT_ZERO, CREDIT_POSITION_ADDRESS } from "const";
import { createCreditPosition } from "../entities/CreditPosition";
import { CreditPositionManager as CreditPosition } from "../../generated/templates/CreditPair/CreditPositionManager";

export function onSync(event: Sync): void {
  log.info(
    "lending pair sync:\n pair: {}\n maturity: {}\n x: {}\n y: {}\n z: {}\n",
    [
      event.address.toHexString(),
      event.params.maturity.toString(),
      event.params.x.toString(),
      event.params.y.toString(),
      event.params.z.toString(),
    ]
  );

  // create pair/pool before updating constant product (sync is fired before the mint event so the pool needs to be created beforehand)
  getCreditPair(event.address, event.block);
  getCreditPairPool(event.address, event.params.maturity, event.block);
  updateConstantProduct(
    event.address,
    event.params.maturity,
    event.params.x,
    event.params.y,
    event.params.z
  );
  updatePoolReserves(event.address, event.params.maturity);
}

export function onBorrow(event: Borrow): void {
  log.info(
    "onBorrow >> \n pair: {} \n maturity: {} \n sender: {} \n assetTo: {} \n dueTo: {} \n assetOut: {} \n id: {} \n debt: {} \n collateral: {} \n startBlock: {} \n feeIn: {}, protocolFeeIn: {}, stakingFeeIn: {}, senderTx: {}",
    [
      event.address.toHexString(),
      event.params.maturity.toString(),
      event.params.sender.toHexString(),
      event.params.assetTo.toHexString(),
      event.params.dueTo.toHexString(),
      event.params.assetOut.toString(),
      event.params.id.toString(),
      event.params.dueOut.debt.toString(),
      event.params.dueOut.collateral.toString(),
      event.params.dueOut.startBlock.toString(),
      event.params.feeIn.toString(),
      event.params.protocolFeeIn.toString(),
      event.params.stakingFeeIn.toString(),
      event.transaction.from.toHexString()
    ]
  );
  
  const lendingPair = getCreditPair(event.address, event.block);
  const lendingFactory = getCreditFactory();
  const pool = getCreditPairPool(
    event.address,
    event.params.maturity,
    event.block
  );
  if (pool === null) return;
  const totalDebt = pool.totalDebt.plus(event.params.dueOut.debt);
  createCreditTransaction(lendingPair,pool,event.transaction.hash,event.block,event.transaction.from,"Borrow",event.params.assetOut,event.params.dueOut.collateral);
  pool.transactionCount = pool.transactionCount.plus(BIG_INT_ONE);
  pool.totalDebt = totalDebt;
  const totalFee = pool.totalFee.plus(event.params.feeIn).plus(event.params.protocolFeeIn);
  pool.totalFee = totalFee;

  pool.borrowTransactionCount = pool.borrowTransactionCount.plus(BIG_INT_ONE);
  const totalBorrowed = pool.totalBorrowed.plus(event.params.assetOut);
  // const totalCollateral = pool.totalCollateral.plus(
  //   event.params.dueOut.collateral
  // );
  pool.totalBorrowed = totalBorrowed
  // pool.totalCollateral = totalCollateral
  let asset = Token.load(lendingPair.asset) as Token;
  //update USD values here
  pool.totalBorrowedUSD = convertInttoUSD(totalBorrowed,asset.id);
  // pool.totalCollateralUSD = convertInttoUSD(totalCollateral,collateral.id);
  pool.totalFeeUSD = pool.totalFeeUSD.plus(convertInttoUSD(event.params.feeIn.plus(event.params.protocolFeeIn),asset.id));
  pool.totalLentUSD = convertInttoUSD(pool.totalLent,asset.id);
  pool.totalRepayedUSD = convertInttoUSD(pool.totalRepayed,asset.id);
  pool.totalDebtUSD = convertInttoUSD(totalDebt,asset.id);
  pool.save();

  const cpContract = CreditPosition.bind(CREDIT_POSITION_ADDRESS)
  const nextCPID =  cpContract.nextTokenIdToMint();
  if(nextCPID.gt(BIG_INT_ZERO) && ((lendingFactory.lastCreditTokenId===null) || nextCPID.minus(BIG_INT_ONE).gt(lendingFactory.lastCreditTokenId as BigInt))){
    let latestTokenId:BigInt;
    if(lendingFactory.lastCreditTokenId === null){
      latestTokenId = BIG_INT_ZERO
    }
    else{
      latestTokenId = (lendingFactory.lastCreditTokenId as BigInt).plus(BIG_INT_ONE);
    }
    const owner = cpContract.ownerOf(latestTokenId)
    createCreditPosition(pool,lendingPair,owner.toHexString(),2,latestTokenId.toString(),event.params.assetOut,event.params.dueOut.debt);
    lendingFactory.lastCreditTokenId = latestTokenId;
    lendingFactory.save()
  }
  updateCreditPoolDayData(event.address, event.block.timestamp, pool.maturity);
  updateCreditPoolHourlyData(
    event.address,
    event.block.timestamp,
    pool.maturity
  );
}

export function onBurn(event: Burn): void {
  log.info("onBurn >> \n pair: {}\nmaturity: {}", [
    event.address.toHexString(),
    event.params.maturity.toString(),
  ]);
  const lendingPair = getCreditPair(event.address, event.block);
  const pool = getCreditPairPool(
    event.address,
    event.params.maturity,
    event.block
  ) as CreditPairPool;

  createCreditTransaction(lendingPair,pool,event.transaction.hash,event.block,event.transaction.from,"Remove Liquidity",event.params.assetOut,event.params.collateralOut);
  pool.transactionCount = pool.transactionCount.plus(BIG_INT_ONE);
  const totalLent = pool.totalLent.minus(event.params.assetOut);
  pool.totalLent = totalLent
  updatePoolReserves(event.address, event.params.maturity);


  let asset = Token.load(lendingPair.asset) as Token;
  pool.totalBorrowedUSD = convertInttoUSD(pool.totalBorrowed,asset.id);
  pool.totalRepayedUSD = convertInttoUSD(pool.totalRepayed,asset.id);
  pool.totalDebtUSD = convertInttoUSD(pool.totalDebt,asset.id);
  pool.totalLentUSD = convertInttoUSD(totalLent,asset.id);
  pool.save()
  updateCreditPoolHourlyData(
    event.address,
    event.block.timestamp,
    pool.maturity
  );
  updateCreditPoolDayData(event.address, event.block.timestamp, pool.maturity);
}

export function onLend(event: Lend): void {
  log.info(
    "onLend >> \n pair: {} \n maturity: {} \n sender: {} \n bondTo: {} \n insuranceTo: {} \n assetIn: {} \n bondPrincipal: {} \n bondInterest: {} \n insurancePrincipal: {} \n insuranceInterest: {} \n feeIn: {}, protocolFeeIn: {}",
    [
      event.address.toHexString(),
      event.params.maturity.toString(),
      event.params.sender.toHexString(),
      event.params.loanTo.toHexString(),
      event.params.coverageTo.toHexString(),
      event.params.assetIn.toString(),
      event.params.claimsOut.loanPrincipal.toString(),
      event.params.claimsOut.loanInterest.toString(),
      event.params.claimsOut.coveragePrincipal.toString(),
      event.params.claimsOut.coverageInterest.toString(),
      event.params.feeIn.toString(),
      event.params.protocolFeeIn.toString(),
    ]
  );
  const lendingPair = getCreditPair(event.address, event.block);
  const pool = getCreditPairPool(
    event.address,
    event.params.maturity,
    event.block
  ) as CreditPairPool;
  createCreditTransaction(lendingPair,pool,event.transaction.hash,event.block,event.transaction.from,"Lend",event.params.assetIn,event.params.claimsOut.coveragePrincipal);
  pool.transactionCount = pool.transactionCount.plus(BIG_INT_ONE);
  const totalLent = pool.totalLent.plus(event.params.assetIn);
  // const totalCollateral = pool.totalCollateral.minus(event.params.claimsOut.insurancePrincipal);
  // const total
  // pool.totalCollateral = totalCollateral;
  pool.totalLent = totalLent
  const totalFee = pool.totalFee.plus(event.params.feeIn).plus(event.params.protocolFeeIn);
  pool.totalFee = totalFee;

  pool.lendTransactionCount = pool.lendTransactionCount.plus(BIG_INT_ONE);
  let asset = Token.load(lendingPair.asset) as Token;
  pool.totalLentUSD = convertInttoUSD(totalLent,asset.id);
  // pool.totalCollateralUSD = convertInttoUSD(totalCollateral,collateral.id);
  pool.totalFeeUSD = pool.totalFeeUSD.plus(convertInttoUSD(event.params.feeIn.plus(event.params.protocolFeeIn),asset.id));
  pool.totalBorrowedUSD = convertInttoUSD(pool.totalBorrowed,asset.id);
  pool.totalRepayedUSD = convertInttoUSD(pool.totalRepayed,asset.id);
  pool.totalDebtUSD = convertInttoUSD(pool.totalDebt,asset.id);
  pool.save();
  updateCreditPoolDayData(event.address, event.block.timestamp, pool.maturity);
  updateCreditPoolHourlyData(
    event.address,
    event.block.timestamp,
    pool.maturity
  );
}

export function onPay(event: Pay): void {
  log.info("onPay >> pair: {}\n maturity: {}\n", [
    event.address.toHexString(),
    event.params.maturity.toString(),
  ]);
  const lendingPair = getCreditPair(event.address, event.block);
  updatePoolReserves(event.address, event.params.maturity);
  const pool = getCreditPairPool(
    event.address,
    event.params.maturity,
    event.block
  ) as CreditPairPool;
  createCreditTransaction(lendingPair,pool,event.transaction.hash,event.block,event.transaction.from,"Repay",event.params.assetIn,event.params.collateralOut);
  pool.transactionCount = pool.transactionCount.plus(BIG_INT_ONE);
  const totalRepayed = pool.totalRepayed.plus(event.params.assetIn);
  // const totalCollateral = pool.totalCollateral.minus(event.params.collateralOut);
  const totalDebt = pool.totalDebt.minus(event.params.assetIn);
  pool.totalRepayed = totalRepayed;
  // pool.totalCollateral = totalCollateral;
  pool.totalDebt = totalDebt;

  let asset = Token.load(lendingPair.asset) as Token;
  pool.totalRepayedUSD = convertInttoUSD(totalRepayed,asset.id);
  // pool.totalCollateralUSD = convertInttoUSD(totalCollateral,collateral.id);
  pool.totalDebtUSD = convertInttoUSD(totalDebt,asset.id);
  pool.totalLentUSD = convertInttoUSD(pool.totalLent,asset.id);
  // pool.totalCollateralUSD = convertInttoUSD(totalCollateral,collateral.id);
  pool.totalBorrowedUSD = convertInttoUSD(pool.totalBorrowed,asset.id);

  pool.save();
  updateCreditPoolDayData(event.address, event.block.timestamp, pool.maturity);
  updateCreditPoolHourlyData(
    event.address,
    event.block.timestamp,
    pool.maturity
  );
}

export function onMint(event: Mint): void {
  log.info(
    "onMint >> \n pair: {} \n maturity: {} \n sender: {} \n liquidityTo: {} \n dueTo: {} \n assetIn: {} \n liquidityOut: {} \n id: {} \n debt: {} \n collateral: {} \n startBlock: {} \n feeIn: {}",
    [
      event.address.toHexString(),
      event.params.maturity.toString(),
      event.params.sender.toHexString(),
      event.params.liquidityTo.toHexString(),
      event.params.dueTo.toHexString(),
      event.params.liquidityOut.toHexString(),
      event.params.assetIn.toString(),
      event.params.id.toString(),
      event.params.dueOut.debt.toString(),
      event.params.dueOut.collateral.toString(),
      event.params.dueOut.startBlock.toString(),
      event.params.feeIn.toString(),
    ]
  );
  const lendingPair = getCreditPair(event.address, event.block);
  const lendingPairPool = getCreditPairPool(
    event.address,
    event.params.maturity,
    event.block
  ) as CreditPairPool;

  createCreditTransaction(lendingPair,lendingPairPool,event.transaction.hash,event.block,event.transaction.from,"Add Liquidity",event.params.assetIn,event.params.dueOut.collateral);
  lendingPairPool.transactionCount = lendingPairPool.transactionCount.plus(BIG_INT_ONE);
  const totalFee = lendingPairPool.totalFee.plus(event.params.feeIn);
  const totalLent = lendingPairPool.totalLent.plus(event.params.assetIn);
  lendingPairPool.totalFee = totalFee;
  lendingPairPool.totalLent = totalLent;
  lendingPairPool.totalFeeUSD =  lendingPairPool.totalFeeUSD.plus(convertInttoUSD(event.params.feeIn,lendingPair.asset));
  let asset = Token.load(lendingPair.asset) as Token;
  lendingPairPool.totalBorrowedUSD = convertInttoUSD(lendingPairPool.totalBorrowed,asset.id);
  lendingPairPool.totalLentUSD = convertInttoUSD(totalLent,asset.id);
  lendingPairPool.totalRepayedUSD = convertInttoUSD(lendingPairPool.totalRepayed,asset.id);
  lendingPairPool.totalDebtUSD = convertInttoUSD(lendingPairPool.totalDebt,asset.id);

  lendingPairPool.liquidityTransactionCount = lendingPairPool.liquidityTransactionCount.plus(BIG_INT_ONE);
  lendingPairPool.save()
  updateCreditPoolDayData(
    event.address,
    event.block.timestamp,
    lendingPairPool.maturity
  ); 
  updateCreditPoolHourlyData(
    event.address,
    event.block.timestamp,
    lendingPairPool.maturity
  );
}

export function onWithdraw(event: Withdraw): void {
  log.info("onWithdraw >> pair: {}\n maturity: {}\n", [
    event.address.toHexString(),
    event.params.maturity.toString(),
  ]);
  const lendingPair = getCreditPair(event.address, event.block);
  const lendingPairPool = getCreditPairPool(
    event.address,
    event.params.maturity,
    event.block
  ) as CreditPairPool;
  createCreditTransaction(lendingPair,lendingPairPool,event.transaction.hash,event.block,event.transaction.from,"Claim",event.params.tokensOut.asset,event.params.tokensOut.collateral);
  lendingPairPool.transactionCount = lendingPairPool.transactionCount.plus(BIG_INT_ONE);
  updatePoolReserves(event.address, event.params.maturity);
  updatePoolReserves(event.address, event.params.maturity);
  const totalLent = lendingPairPool.totalLent.minus(
    event.params.tokensOut.asset
  );
  lendingPairPool.totalLent = totalLent;
  let asset = Token.load(lendingPair.asset) as Token;
  lendingPairPool.totalLentUSD = convertInttoUSD(totalLent,asset.id);
  lendingPairPool.save();
  updateCreditPoolDayData(
    event.address,
    event.block.timestamp,
    lendingPairPool.maturity
  );
  updateCreditPoolHourlyData(
    event.address,
    event.block.timestamp,
    lendingPairPool.maturity
  );
}

export function handleLockedDebtTokenTransfer(
  event: LockedDebtTransfer
): void {
  log.info("LockedDebtTransfer >> from: {}\n to: {}\n tokenId: {}\n", [
    event.params.from.toHexString(),
    event.params.to.toHexString(),
    event.params.tokenId.toString(),
  ]);
  updateLockedDebtToken(event);
}