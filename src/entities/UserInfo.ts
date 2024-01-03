import { Bytes } from "@graphprotocol/graph-ts";
import { StakingData, StakingUserInfo } from "../../generated/schema";
import { BIG_DECIMAL_ZERO, BIG_INT_ZERO } from "const";

export function getUserInfo(
  token: Bytes,
  user: Bytes,
  creditStakingData: StakingData
): StakingUserInfo {
  const id = user.toHexString().concat("-").concat(token.toHexString());
  let userInfo = StakingUserInfo.load(id);
  if (userInfo === null) {
    userInfo = new StakingUserInfo(id);
    userInfo.creditStaking = creditStakingData.id;
    userInfo.pendingDividends = BIG_INT_ZERO;
    userInfo.rewardDebt = BIG_INT_ZERO;
    userInfo.pendingDividendsUSD = BIG_DECIMAL_ZERO;
    userInfo.rewardDebtUSD = BIG_DECIMAL_ZERO;
    userInfo.save();
  }
  return userInfo;
}
