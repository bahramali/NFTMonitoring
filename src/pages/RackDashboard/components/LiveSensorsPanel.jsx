import React, { useMemo } from "react";
import GerminationLiveSensorsPanel from "../../Germination/components/LiveSensorsPanel.jsx";
import { useLiveTelemetry } from "../../Germination/hooks/useLiveTelemetry.js";
import { deviceMatchesRack, normalizeRackId } from "../rackTelemetry.js";

export default function LiveSensorsPanel({ rackId }) {
    const normalizedRackId = normalizeRackId(rackId);

    const filterDevice = useMemo(() => {
        return (device) => deviceMatchesRack(device, normalizedRackId);
    }, [normalizedRackId]);

    const { metricReports } = useLiveTelemetry({ filterDevice });

    return <GerminationLiveSensorsPanel metricReports={metricReports} />;
}
