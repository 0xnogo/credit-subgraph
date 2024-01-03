import { ethereum } from "@graphprotocol/graph-ts";
import { LPFarm } from "../../generated/schema";
import { BIG_INT_ZERO, LP_FARMING_ADDRESS } from "const";
import { LPFarming as LPFarmingContract } from "../../generated/LPFarming/LPFarming";

export function getLPFarm(block: ethereum.Block): LPFarm {
  let lpFarm = LPFarm.load(LP_FARMING_ADDRESS.toHex());

  if (lpFarm === null) {
    const contract = LPFarmingContract.bind(LP_FARMING_ADDRESS);
    lpFarm = new LPFarm(LP_FARMING_ADDRESS.toHex());
    lpFarm.owner = contract.owner();
    lpFarm.startBlock = block.timestamp;
    lpFarm.token = contract.creditToken();
    lpFarm.emissionRate = contract.emissionRate();
    lpFarm.totalAllocPoint = contract.totalAllocPoint();
    lpFarm.poolCount = BIG_INT_ZERO;
    lpFarm.save();
  }

  return lpFarm;
}
