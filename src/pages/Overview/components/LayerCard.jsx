import React, {useMemo} from "react";
import DeviceCard from "./DeviceCard.jsx";
import Stat from "./Stat.jsx";
import useLayerCompositeCards from "./useLayerCompositeCards.js";
import { useSensorConfig } from "../../../context/SensorConfigContext.jsx";
import { fmt, aggregateFromCards, sensorLabel, isWaterDevice } from "../utils";
import styles from "./LayerCard.module.css";

function LayerCard({layer, systemId}) {
  const deviceCards = useLayerCompositeCards(systemId, layer.id).filter(card => !isWaterDevice(card.compId));
  const agg = useMemo(() => aggregateFromCards(deviceCards), [deviceCards]);
  const { configs } = useSensorConfig();

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
            label="Light="
            value={`${fmt(agg.avg.light)} lux (${agg.counts.light} sensors)`}
            range={configs.lux?.idealRange}
          />
        )}
        {agg.counts.temperature > 0 && (
          <Stat
            label="Temp="
            value={`${fmt(agg.avg.temperature)} °C (${agg.counts.temperature} sensors)`}
            range={configs.temperature?.idealRange}
          />
        )}
        {agg.counts.humidity > 0 && (
          <Stat
            label="Humidity="
            value={`${fmt(agg.avg.humidity)} % (${agg.counts.humidity} sensors)`}
            range={configs.humidity?.idealRange}
          />
        )}
        {agg.counts.pH > 0 && (
          <Stat
            label="pH="
            value={`${fmt(agg.avg.pH)} (${agg.counts.pH} sensors)`}
            range={configs.ph?.idealRange}
          />
        )}
        {agg.counts.co2 > 0 && (
          <Stat
            label="CO₂="
            value={`${fmt(agg.avg.co2, 0)} ppm (${agg.counts.co2} sensors)`}
            range={configs.co2?.idealRange}
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
                  sensorType: sensorLabel(k, { topic: '/topic/growSensors' }),
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
