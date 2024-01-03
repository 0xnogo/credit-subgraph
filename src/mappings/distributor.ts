import { UpdateEmissionRate } from "../../generated/Distributor/Distributor";
import { getLPFarm } from "../entities/LPFarm";

export function onEmissionRateUpdated(event: UpdateEmissionRate): void {
  const lpFarm = getLPFarm(event.block);

  lpFarm.emissionRate = event.params.emissionRate;

  lpFarm.save();
}
