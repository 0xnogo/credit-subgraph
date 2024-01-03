import { Bytes } from "@graphprotocol/graph-ts";
import { StakingData } from "../../generated/schema";
import { StakingDividendsInfo } from "../../generated/schema";
import { BIG_DECIMAL_ZERO, BIG_INT_ZERO, CREDIT_TOKEN_ADDRESS } from "const";
import { convertInttoUSD } from "../utils/pricing";


export function getDividendsInfo(
  token: Bytes,
  creditStakingData: StakingData
): StakingDividendsInfo {
  const id = token.toHexString().concat("-").concat(creditStakingData.id);
  let dividendsInfo = StakingDividendsInfo.load(id);
  if (dividendsInfo === null) {
    dividendsInfo = new StakingDividendsInfo(id);
    if (id.includes("-global")) {
      //we update the current epoch details here
      dividendsInfo.currentDistributionAmount = BIG_INT_ZERO;
      dividendsInfo.currentCycleDistributedAmount = BIG_INT_ZERO;
      dividendsInfo.pendingAmount = BIG_INT_ZERO;
      dividendsInfo.distributedAmount = BIG_INT_ZERO;
      dividendsInfo.accDividendsPerShare = BIG_INT_ZERO;
      dividendsInfo.lastUpdateTime = BIG_INT_ZERO;
      dividendsInfo.lastUpdatedCycle = creditStakingData.currentCycleStartTime;
      dividendsInfo.distributionDisabled = false;
      dividendsInfo.token = token;
      dividendsInfo.creditStaking = creditStakingData.id;
      dividendsInfo.accDividendsPerShareUSD = BIG_DECIMAL_ZERO;
      dividendsInfo.distributedAmountUSD = BIG_DECIMAL_ZERO;
      dividendsInfo.pendingAmountUSD = BIG_DECIMAL_ZERO;
      dividendsInfo.currentDistributionAmountUSD = BIG_DECIMAL_ZERO;
      dividendsInfo.currentCycleDistributedAmountUSD = BIG_DECIMAL_ZERO;
    } else {
      const oldDividendsInfo = StakingDividendsInfo.load(
        token.toHexString().concat("-").concat("global")
      ) as StakingDividendsInfo;
      dividendsInfo.currentDistributionAmount =
        oldDividendsInfo.currentDistributionAmount;
      dividendsInfo.currentCycleDistributedAmount =
        oldDividendsInfo.currentCycleDistributedAmount;
      dividendsInfo.pendingAmount = oldDividendsInfo.pendingAmount;
      dividendsInfo.distributedAmount = oldDividendsInfo.distributedAmount;
      dividendsInfo.accDividendsPerShare =
        oldDividendsInfo.accDividendsPerShare;
      dividendsInfo.lastUpdateTime = oldDividendsInfo.lastUpdateTime;
      dividendsInfo.distributionDisabled =
        oldDividendsInfo.distributionDisabled;
      dividendsInfo.token = oldDividendsInfo.token;
      dividendsInfo.creditStaking = creditStakingData.id;
      dividendsInfo.lastUpdatedCycle = oldDividendsInfo.lastUpdatedCycle;

      let creditToken = CREDIT_TOKEN_ADDRESS.toHexString()
      dividendsInfo.accDividendsPerShareUSD = convertInttoUSD(oldDividendsInfo.accDividendsPerShare,creditToken);
      dividendsInfo.distributedAmountUSD = convertInttoUSD(oldDividendsInfo.distributedAmount,creditToken);
      dividendsInfo.pendingAmountUSD = convertInttoUSD(oldDividendsInfo.pendingAmount,creditToken);
      dividendsInfo.currentDistributionAmountUSD = convertInttoUSD(oldDividendsInfo.currentDistributionAmount,creditToken);
      dividendsInfo.currentCycleDistributedAmountUSD = convertInttoUSD(oldDividendsInfo.currentCycleDistributedAmount,creditToken);
    }
    dividendsInfo.save();
  }
  return dividendsInfo;
}
