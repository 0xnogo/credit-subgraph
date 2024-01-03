import { Address, BigDecimal, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { LPFarmPosition } from "../../generated/schema";
import { getOrCreateUser } from "../utils/helpers";
import { BIG_DECIMAL_ZERO, BIG_INT_ZERO } from "const";

export function getFarmPosition(
  pid: Bytes,
  address: Address,
  creditPositionId: BigDecimal,
  block: ethereum.Block
): LPFarmPosition {
  const uid = address.toHexString();
  const id = pid
    .toHexString()
    .concat("-")
    .concat(uid)
    .concat("-")
    .concat(creditPositionId.toString());

  let farmPosition = LPFarmPosition.load(id);

  if (farmPosition === null) {
    const user = getOrCreateUser(address);
    farmPosition = new LPFarmPosition(id);
    farmPosition.pool = pid.toHexString();
    farmPosition.user = user.id;
    farmPosition.amount = BIG_INT_ZERO;
    farmPosition.rewardDebt = BIG_INT_ZERO;
    farmPosition.tokensHarvested = BIG_DECIMAL_ZERO;
    farmPosition.timestamp = block.timestamp;
    farmPosition.block = block.number;
    farmPosition.creditPositionId = creditPositionId;
    farmPosition.rewardDebtUSD = BIG_DECIMAL_ZERO;
    farmPosition.tokensHarvestedUSD = BIG_DECIMAL_ZERO;
    farmPosition.save();
  }

  return farmPosition;
}
