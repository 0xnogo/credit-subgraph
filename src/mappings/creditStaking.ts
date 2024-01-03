import { BIG_DECIMAL_ZERO, BIG_INT_1E16, BIG_INT_1E18, BIG_INT_1E2, BIG_INT_ZERO, CREDIT_TOKEN_ADDRESS } from "const";
import {
  DistributedTokenDisabled,
  DistributedTokenEnabled,
  DistributedTokenRemoved,
  DividendsAddedToPending,
  DividendsCollected,
  DividendsUpdated,
  Initialized,
  UpdatedCurrentCycleStartTime,
  UserUpdated,
} from "../../generated/CreditStaking/CreditStaking";
import { getCreditStakingData } from "../entities/CreditStakingData";
import { getDividendsInfo } from "../entities/DividendsInfo";
import { Bytes } from "@graphprotocol/graph-ts";
import { getUserInfo } from "../entities/UserInfo";
import { getOrCreateUser } from "../utils/helpers";
import { convertInttoUSD } from "../utils/pricing";
import { getToken } from "../entities";

export function initialize(event: Initialized): void {
  getCreditStakingData(event, "global");
}

export function updateCurrentCycleStartTime(
  event: UpdatedCurrentCycleStartTime
): void {
  const stakingData = getCreditStakingData(event, "global");
  const previousCycle = stakingData.currentCycleStartTime;
  stakingData.currentCycleStartTime = event.params.param0;

  //create a historical entity for last epoch
  getCreditStakingData(event, previousCycle.toString());
  stakingData.save();
}

export function dividendsCollected(event: DividendsCollected): void {
  const stakingData = getCreditStakingData(event, "global");
  const user = getOrCreateUser(event.params.user);
  const userInfo = getUserInfo(
    event.params.token,
    event.params.user,
    stakingData
  );
  const dividendsInfo = getDividendsInfo(event.params.token, stakingData);
  let accDividendsPerShare = dividendsInfo.accDividendsPerShare;
  let userCreditAllocation = user.stakedCreditAllocation;
  userInfo.pendingDividends = BIG_INT_ZERO;
  const rewardDebt =userCreditAllocation
  .times(accDividendsPerShare)
  .div(BIG_INT_1E18);
  userInfo.rewardDebt = rewardDebt
  //update USD values
  userInfo.pendingDividendsUSD = BIG_DECIMAL_ZERO;
  userInfo.rewardDebtUSD = convertInttoUSD(rewardDebt,CREDIT_TOKEN_ADDRESS.toHexString())
  userInfo.save();
}

export function dividendsAddedToPending(event: DividendsAddedToPending): void {
  const stakingData = getCreditStakingData(event, "global");

  let dividendsInfo = getDividendsInfo(event.params.token, stakingData);
  const pendingAmount =  dividendsInfo.pendingAmount.plus(
    event.params.amount
  );
  dividendsInfo.pendingAmount = pendingAmount
  dividendsInfo.pendingAmountUSD = convertInttoUSD(pendingAmount,dividendsInfo.token.toHexString())

  dividendsInfo.save();
}

export function userUpdated(event: UserUpdated): void {
  const user = getOrCreateUser(event.params.user);

  const previousUserAllocation = user.stakedCreditAllocation;

  const stakingData = getCreditStakingData(event, "global");

  // for each distributedToken
  const length = stakingData.distributedTokens.length;
  for (let index = 0; index < length; ++index) {
    let token = stakingData.distributedTokens[index];

    const dividendsInfo = getDividendsInfo(token, stakingData);

    const userInfo = getUserInfo(token, event.params.user, stakingData);
    const accDividendsPerShare = dividendsInfo.accDividendsPerShare;

    const pending = previousUserAllocation
      .times(accDividendsPerShare)
      .div(BIG_INT_1E18)
      .minus(userInfo.rewardDebt);
    userInfo.pendingDividends = userInfo.pendingDividends.plus(pending);
    userInfo.rewardDebt = event.params.newBalance
      .times(accDividendsPerShare)
      .div(BIG_INT_1E18);
    userInfo.pendingDividendsUSD = convertInttoUSD(userInfo.pendingDividends,CREDIT_TOKEN_ADDRESS.toHexString());
    userInfo.rewardDebtUSD = convertInttoUSD(userInfo.rewardDebt,CREDIT_TOKEN_ADDRESS.toHexString());
    userInfo.save();
  }

  user.stakedCreditAllocation = event.params.newBalance;
  stakingData.totalAllocation = event.params.newTotalAllocation;

  stakingData.totalAllocationUSD = convertInttoUSD(event.params.newTotalAllocation,CREDIT_TOKEN_ADDRESS.toHexString());
  user.save();
  stakingData.save();
}

export function distributedTokenEnabled(event: DistributedTokenEnabled): void {
  let stakingData = getCreditStakingData(event, "global");
  const dividendsInfo = getDividendsInfo(event.params.token, stakingData);
  if (dividendsInfo.lastUpdateTime == BIG_INT_ZERO) {
    dividendsInfo.lastUpdateTime = event.block.timestamp;
  }

  getToken(event.params.token);

  dividendsInfo.distributionDisabled = false;
  let distributedTokens: Bytes[] = stakingData.distributedTokens;
  distributedTokens.push(Bytes.fromHexString(event.params.token.toHexString()));
  stakingData.distributedTokens = distributedTokens;
  stakingData.save();
  dividendsInfo.save();
}

export function distributedTokenDisabled(
  event: DistributedTokenDisabled
): void {
  let stakingData = getCreditStakingData(event, "global");
  const dividendsInfo = getDividendsInfo(event.params.token, stakingData);

  dividendsInfo.distributionDisabled = true;
  dividendsInfo.save();
}

export function distributedTokenRemoved(event: DistributedTokenRemoved): void {
  let stakingData = getCreditStakingData(event, "global");

  let distributedTokens: Bytes[] = [];

  for (let index = 0; index < stakingData.distributedTokens.length; index++) {
    const token = stakingData.distributedTokens[index];
    if (stakingData.distributedTokens[index] !== event.params.token) {
      distributedTokens.push(token);
    }
  }
  stakingData.distributedTokens = distributedTokens;
  stakingData.save();
}

export function dividendsUpdated(event: DividendsUpdated): void {
  const stakingData = getCreditStakingData(event, "global");

  const currentBlockTimestamp = event.params.currentStartTimestamp;

  const dividendsInfo = getDividendsInfo(event.params.token, stakingData);

  let lastUpdateTime = dividendsInfo.lastUpdateTime;
  let accDividendsPerShare = dividendsInfo.accDividendsPerShare;

  if (
    stakingData.totalAllocation == BIG_INT_ZERO ||
    currentBlockTimestamp < stakingData.currentCycleStartTime
  ) {
    dividendsInfo.lastUpdateTime = currentBlockTimestamp;
  } else {
    let currentDistributionAmount = dividendsInfo.currentDistributionAmount;
    let currentCycleDistributedAmount =
      dividendsInfo.currentCycleDistributedAmount;

    if (lastUpdateTime < stakingData.currentCycleStartTime) {
      accDividendsPerShare = accDividendsPerShare.plus(
        currentDistributionAmount
          .times(BIG_INT_1E2)
          .minus(currentCycleDistributedAmount)
          .times(BIG_INT_1E16)
          .div(stakingData.totalAllocation)
      );
      let distributedAmount = dividendsInfo.distributedAmount.plus(
        currentDistributionAmount
      );
      dividendsInfo.distributedAmount = distributedAmount
      if (!dividendsInfo.distributionDisabled) {
        currentDistributionAmount = dividendsInfo.pendingAmount;
        dividendsInfo.currentDistributionAmount = currentDistributionAmount;
        dividendsInfo.pendingAmount = BIG_INT_ZERO;
        dividendsInfo.pendingAmountUSD = BIG_DECIMAL_ZERO;
      } else {
        currentDistributionAmount = BIG_INT_ZERO;
        dividendsInfo.currentDistributionAmount = BIG_INT_ZERO;
      }

      dividendsInfo.distributedAmountUSD = convertInttoUSD(distributedAmount,CREDIT_TOKEN_ADDRESS.toHexString());
      dividendsInfo.currentDistributionAmountUSD = convertInttoUSD(currentDistributionAmount,CREDIT_TOKEN_ADDRESS.toHexString());

      currentCycleDistributedAmount = BIG_INT_ZERO;
      lastUpdateTime = stakingData.currentCycleStartTime;

      dividendsInfo.save();

      //create historical data here
      const historicalStakingData = getCreditStakingData(
        event,
        dividendsInfo.lastUpdatedCycle.toString()
      );
      getDividendsInfo(event.params.token, historicalStakingData);
    }

    const dividendAmountPerSecond = stakingData.distributedTokens.includes(
      event.params.token
    )
      ? dividendsInfo.currentDistributionAmount
          .times(BIG_INT_1E2)
          .div(stakingData.cycleDurationSeconds)
      : BIG_INT_ZERO;

    let toDistribute = currentBlockTimestamp
      .minus(lastUpdateTime)
      .times(dividendAmountPerSecond);
    if (
      currentCycleDistributedAmount.plus(toDistribute) >
      currentDistributionAmount.times(BIG_INT_1E2)
    ) {
      toDistribute = currentDistributionAmount
        .times(BIG_INT_1E2)
        .minus(currentCycleDistributedAmount);
    }

    dividendsInfo.currentCycleDistributedAmount =
      currentCycleDistributedAmount.plus(toDistribute);
    dividendsInfo.currentCycleDistributedAmountUSD = convertInttoUSD(currentCycleDistributedAmount.plus(toDistribute),CREDIT_TOKEN_ADDRESS.toHexString());
   let updatedAccDividendsPerShare = accDividendsPerShare.plus(
    toDistribute.times(BIG_INT_1E16).div(stakingData.totalAllocation)
  );
    dividendsInfo.accDividendsPerShare = updatedAccDividendsPerShare
    dividendsInfo.currentCycleDistributedAmountUSD = convertInttoUSD(currentCycleDistributedAmount.plus(toDistribute),CREDIT_TOKEN_ADDRESS.toHexString());
    dividendsInfo.accDividendsPerShareUSD = convertInttoUSD(updatedAccDividendsPerShare,CREDIT_TOKEN_ADDRESS.toHexString());
    dividendsInfo.lastUpdateTime = currentBlockTimestamp;
  }
  dividendsInfo.lastUpdatedCycle = stakingData.currentCycleStartTime;
  dividendsInfo.save();
}
