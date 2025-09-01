import React, {useMemo} from "react";
import DeviceCard from "./DeviceCard.jsx";
import Stat from "./Stat.jsx";
import useLayerCompositeCards from "./useLayerCompositeCards.js";
import idealRangeConfig from "../../../idealRangeConfig.js";
import { fmt, aggregateFromCards, sensorLabel, isWaterDevice } from "../utils";
import styles from "./LayerCard.module.css";

function LayerCard({layer, systemId}) {
  const deviceCards = useLayerCompositeCards(systemId, layer.id).filter(card => !isWaterDevice(card.compId));
  const agg = useMemo(() => aggregateFromCards(deviceCards), [deviceCards]);

  return (
    <div className={`${styles.card} ${styles.layer}`}>
      <div className={styles.headerRow}>
        <h4>
          {layer.id} <span className={`${styles.dot} ${styles[layer.health]}`}/>
        </h4>
      </div>

      <div className={styles.stats}>
        {agg.counts.light > 0 && (
          <Stat
            label={`Light (${agg.counts.light} sensors)`}
            value={`${fmt(agg.avg.light)} lux`}
            range={idealRangeConfig.lux?.idealRange}
          />
        )}
        {agg.counts.temperature > 0 && (
          <Stat
            label={`Temp (${agg.counts.temperature} sensors)`}
            value={`${fmt(agg.avg.temperature)} °C`}
            range={idealRangeConfig.temperature?.idealRange}
          />
        )}
        {agg.counts.humidity > 0 && (
          <Stat
            label={`Humidity (${agg.counts.humidity} sensors)`}
            value={`${fmt(agg.avg.humidity)} %`}
            range={idealRangeConfig.humidity?.idealRange}
          />
        )}
        {agg.counts.pH > 0 && (
          <Stat
            label={`pH (${agg.counts.pH} sensors)`}
            value={`${fmt(agg.avg.pH)}`}
            range={idealRangeConfig.ph?.idealRange}
          />
        )}
        {agg.counts.co2 > 0 && (
          <Stat
            label={`CO₂ (${agg.counts.co2} sensors)`}
            value={`${fmt(agg.avg.co2, 0)} ppm`}
          />
        )}
      </div>

      <div className={styles.details}>
        <div className={styles.devCards}>
          {deviceCards.length ? (
            deviceCards.map((card) => (
              <DeviceCard
                key={card.compId}
                compositeId={card.compId}
                sensors={Object.entries(card.sensors).map(([k, v]) => ({
                  sensorType: sensorLabel(k),
                  value: fmt(v?.value),
                  unit: v?.unit || "",
                }))}
              />
            ))
          ) : (
            <div className={styles.muted}>No device cards</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(LayerCard);
