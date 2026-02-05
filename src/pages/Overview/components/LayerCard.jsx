import React, {useMemo} from "react";
import DeviceCard from "./DeviceCard.jsx";
import Stat from "./Stat.jsx";
import useLayerCompositeCards from "./useLayerCompositeCards.js";
import { useSensorConfig } from "../../../context/SensorConfigContext.jsx";
import { aggregateFromCards, isWaterDevice, buildAggregatedEntries } from "../utils";
import styles from "./LayerCard.module.css";

function LayerCard({layer, systemId}) {
  const deviceCards = useLayerCompositeCards(systemId, layer.id).filter(card => !isWaterDevice(card.deviceId));
  const agg = useMemo(() => aggregateFromCards(deviceCards), [deviceCards]);
  const { findRange } = useSensorConfig();
  const stats = useMemo(
    () => buildAggregatedEntries(agg, { topic: '/topic/growSensors', findRange }),
    [agg, findRange]
  );

  return (
    <div className={`${styles.card} ${styles.layer}`}>
      <div className={styles.headerRow}>
        <h4>
          {layer.id} <span className={`${styles.dot} ${styles[layer.health]}`}/>
        </h4>
      </div>

      <div className={styles.stats}>
        {stats.map((stat) => (
          <Stat
            key={stat.key}
            label={`${stat.label}=`}
            value={`${stat.value} (${stat.countLabel})`}
            range={stat.range}
          />
        ))}
      </div>

      <div className={styles.details}>
        <div className={styles.devCards}>
          {deviceCards.length ? (
            deviceCards.map((card) => (
              <DeviceCard
                key={card.deviceKey}
                id={card.deviceId}
                sensors={(card.rawSensors || []).map((reading) => ({
                  sensorType:
                    reading?.sensorType ??
                    reading?.valueType ??
                    reading?.type ??
                    reading?.name ??
                    "",
                  value: reading?.value,
                  unit: reading?.unit || "",
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
