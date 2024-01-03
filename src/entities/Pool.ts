import { Bytes, ethereum } from "@graphprotocol/graph-ts";
import { LPFarmPool } from "../../generated/schema";
import { getLPFarm } from "./LPFarm";
import { LPFarming as LPFarmingContract } from "../../generated/LPFarming/LPFarming";
import { BIG_INT_ZERO, LP_FARMING_ADDRESS } from "const";

export function getPool(id: Bytes, block: ethereum.Block): LPFarmPool {
  let pool = LPFarmPool.load(id.toHexString());

  if (pool === null) {
    const lpFarm = getLPFarm(block);

    const lpFarmingContract = LPFarmingContract.bind(LP_FARMING_ADDRESS);

    // Create new pool.
    pool = new LPFarmPool(id.toHexString());

    // Set relation
    pool.owner = lpFarm.id;

    const poolInfo = lpFarmingContract.poolInfo(id);

    pool.maturity = poolInfo.getMaturity();
    pool.allocPoint = poolInfo.getAllocPoint();
    pool.lastRewardTime = poolInfo.getLastRewardTime();
    pool.accTokenPerShare = poolInfo.getAccCreditPerShare();

    // Total supply of LP tokens
    pool.balance = BIG_INT_ZERO;
    pool.positionCount = BIG_INT_ZERO;

    pool.timestamp = block.timestamp;
    pool.block = block.number;

    pool.hasExpired = false;
    

    pool.save();
  }

  return pool;
}
