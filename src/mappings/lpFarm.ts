import { Address, log } from "@graphprotocol/graph-ts";
import { BIG_DECIMAL_ZERO, BIG_INT_ONE, BIG_INT_ZERO, CREDIT_TOKEN_ADDRESS } from "const";
import {  CreditPairPool, Token } from "../../generated/schema";
import {
  Deposit,
  EmergencyWithdraw,
  Harvest,
  LogPoolAddition,
  LogPoolExpiration,
  LogUpdatePool,
  OwnershipTransferred,
  Withdraw,
} from "../../generated/LPFarming/LPFarming";
import { ACC_CREDIT_PRECISION } from "const/index.template";
import { getLPFarm } from "../entities/LPFarm";
import { getPool } from "../entities/Pool";
import { getFarmPosition } from "../entities/FarmPosition";
import { convertDecimalstoUSD, convertInttoUSD } from "../utils/pricing";

export function expirePool(event: LogPoolExpiration): void {
  const lpFarm = getLPFarm(event.block);
  const pool = getPool(event.params.poolHash, event.block);
  lpFarm.totalAllocPoint = lpFarm.totalAllocPoint.minus(pool.allocPoint);
  pool.hasExpired = true;

  pool.save();
  lpFarm.save();
}

export function addPool(event: LogPoolAddition): void {
  const lpFarm = getLPFarm(event.block);

  const lendingPairPoolId = Address.fromBytes(event.params.pair)
    .toHexString()
    .concat("-")
    .concat(event.params.maturity.toString());

  log.info("Add pool #{}", [lpFarm.poolCount.toString()]);
  log.info("Pool Address #{}", [lendingPairPoolId]);

  const pool = getPool(event.params.poolHash, event.block);
  pool.save();

  let lendingPairPool = CreditPairPool.load(lendingPairPoolId);

  if (lendingPairPool !== null) {
    lendingPairPool.farm = pool.id;
    lendingPairPool.save();
  }
  // Update LpFarm.
  lpFarm.totalAllocPoint = lpFarm.totalAllocPoint.plus(pool.allocPoint);
  lpFarm.poolCount = lpFarm.poolCount.plus(BIG_INT_ONE);

  lpFarm.save();
}

export function updatePool(event: LogUpdatePool): void {
  getLPFarm(event.block);
  const pool = getPool(event.params.poolHash, event.block);
  pool.lastRewardTime = event.params.lastRewardTime;
  pool.accTokenPerShare = event.params.accCreditPerShare;
  pool.save();
}

export function deposit(event: Deposit): void {
  getLPFarm(event.block);
  const pool = getPool(event.params.poolHash, event.block);
  const farmPosition = getFarmPosition(
    event.params.poolHash,
    event.params.user,
    event.params.collateralPositionId.toBigDecimal(),
    event.block
  );

  pool.balance = pool.balance.plus(event.params.amount);
  pool.save();

  farmPosition.amount = farmPosition.amount.plus(event.params.amount);
  const rewardDebt = farmPosition.rewardDebt.plus(
    event.params.amount.times(pool.accTokenPerShare).div(ACC_CREDIT_PRECISION)
  );
  farmPosition.rewardDebt = rewardDebt

  let creditToken = Token.load(CREDIT_TOKEN_ADDRESS.toHexString()) as Token;
  farmPosition.rewardDebtUSD =  convertInttoUSD(rewardDebt,creditToken.id)
 
  farmPosition.save();
}

export function withdraw(event: Withdraw): void {
  getLPFarm(event.block);
  const pool = getPool(event.params.poolHash, event.block);
  const farmPosition = getFarmPosition(
    event.params.poolHash,
    event.params.user,
    event.params.collateralPositionId.toBigDecimal(),
    event.block
  );
  pool.balance = pool.balance.minus(event.params.amount);
  pool.save();
  farmPosition.amount = BIG_INT_ZERO;
  const rewardDebt = farmPosition.rewardDebt.minus(
    event.params.amount.times(pool.accTokenPerShare).div(ACC_CREDIT_PRECISION)
  );
  farmPosition.rewardDebt = rewardDebt

  let creditToken = Token.load(CREDIT_TOKEN_ADDRESS.toHexString()) as Token;
  farmPosition.rewardDebtUSD =  convertInttoUSD(rewardDebt,creditToken.id);
  farmPosition.save();
}

export function emergencyWithdraw(event: EmergencyWithdraw): void {
  log.info("User {} emergancy withdrawal of {} from pool #{}", [
    event.params.user.toHex(),
    event.params.amount.toString(),
    event.params.poolHash.toString(),
  ]);

  getLPFarm(event.block);
  const pool = getPool(event.params.poolHash, event.block);

  pool.balance = pool.balance.minus(event.params.amount);

  for (var index = 0; index < event.params.creditPositionIds.length; index++) {
    const creditPositionId =
      event.params.creditPositionIds[index].toBigDecimal();
    const farmPosition = getFarmPosition(
      event.params.poolHash,
      event.params.user,
      creditPositionId,
      event.block
    );
    farmPosition.amount = BIG_INT_ZERO;
    farmPosition.rewardDebt = BIG_INT_ZERO;
    farmPosition.creditPositionId = null;
    farmPosition.rewardDebtUSD = BIG_DECIMAL_ZERO;
    farmPosition.save();
  }

  pool.save();
}

export function harvest(event: Harvest): void {
  getLPFarm(event.block);
  const pool = getPool(event.params.poolHash, event.block);

  const farmPosition = getFarmPosition(
    event.params.poolHash,
    event.params.user,
    event.params.creditPositionId.toBigDecimal(),
    event.block
  );

  let accumulatedSushi = farmPosition.amount
    .times(pool.accTokenPerShare)
    .div(ACC_CREDIT_PRECISION);

  farmPosition.rewardDebt = accumulatedSushi;
  const tokensHarvested =  farmPosition.tokensHarvested.plus(
    event.params.amount.toBigDecimal()
  );
  farmPosition.tokensHarvested = tokensHarvested
  let creditToken = Token.load(CREDIT_TOKEN_ADDRESS.toHexString()) as Token;
  farmPosition.rewardDebtUSD =  convertInttoUSD(accumulatedSushi,creditToken.id);
  farmPosition.tokensHarvestedUSD = convertDecimalstoUSD(tokensHarvested,creditToken.id);
  farmPosition.save();
}

export function ownershipTransferred(event: OwnershipTransferred): void {
  log.info("Ownership transfered from previous owner: {} to new owner: {}", [
    event.params.previousOwner.toHex(),
    event.params.newOwner.toHex(),
  ]);
}
