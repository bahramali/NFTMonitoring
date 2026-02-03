// src/pages/Overview/components/Overview.jsx
import React, { useEffect, useMemo, useState } from "react";
import Header from "../../common/Header";
import DeviceCard from "./DeviceCard.jsx";
import styles from "./Overview.module.css";
import { listFarms, listFarmDevices } from "../../../api/deviceMonitoring.js";

const resolveFarmList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.farms)) return payload.farms;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.farms)) return payload.data.farms;
  return [];
};

const resolveDeviceList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.devices)) return payload.devices;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.devices)) return payload.data.devices;
  return [];
};

const normalizeFarm = (farm) => {
  if (farm == null) return null;
  if (typeof farm === "string") {
    return { id: farm, name: farm };
  }
  const id = farm.id || farm.farmId || farm.farm_id || farm.code || farm.slug;
  const name = farm.name || farm.label || farm.displayName || id || "Farm";
  return id ? { id, name } : null;
};

const normalizeDevice = (device) => {
  const deviceId =
    device?.deviceId ||
    device?.device_id ||
    device?.id ||
    device?.compositeId ||
    device?.composite_id ||
    device?.serial ||
    "";
  return {
    deviceId,
    deviceType:
      device?.deviceType ||
      device?.device_type ||
      device?.type ||
      device?.model ||
      device?.category ||
      "",
    status: device?.status || device?.state || device?.connectionStatus || "",
    farm: device?.farm || device?.farmId || device?.farm_id || "",
    unitType: device?.unitType || device?.unit_type || "",
    unitId: device?.unitId || device?.unit_id || "",
    layerId: device?.layerId || device?.layer_id || "",
    telemetry:
      device?.telemetry ||
      device?.latestTelemetry ||
      device?.telemetrySnapshot ||
      device?.metrics ||
      {},
    health: device?.health || device?.sensorHealth || device?.sensorsHealth || {},
    uptime: device?.uptime || device?.uptime_human || "",
    hasAlarms:
      device?.hasAlarms ||
      device?.hasAlarm ||
      device?.alarm ||
      device?.alarmActive ||
      false,
    alarmLevel:
      device?.alarmLevel ||
      device?.alarm_level ||
      device?.alertLevel ||
      device?.alert_level ||
      "",
  };
};

const resolveHasAlarm = (device) => {
  if (device.hasAlarms) return true;
  const alarmLevel = String(device.alarmLevel || "").toUpperCase();
  return ["WARN", "ERROR", "ALARM", "CRITICAL"].includes(alarmLevel);
};

const buildHierarchy = (devices) => {
  const unitTypeMap = new Map();
  devices.forEach((device) => {
    const unitType = device.unitType || "UNKNOWN";
    const unitId = device.unitId || "UNKNOWN";
    const deviceType = device.deviceType || "DEVICE";
    if (!unitTypeMap.has(unitType)) {
      unitTypeMap.set(unitType, new Map());
    }
    const unitMap = unitTypeMap.get(unitType);
    if (!unitMap.has(unitId)) {
      unitMap.set(unitId, new Map());
    }
    const deviceTypeMap = unitMap.get(unitId);
    if (!deviceTypeMap.has(deviceType)) {
      deviceTypeMap.set(deviceType, []);
    }
    deviceTypeMap.get(deviceType).push(device);
  });

  return Array.from(unitTypeMap.entries()).map(([unitType, unitMap]) => ({
    unitType,
    units: Array.from(unitMap.entries()).map(([unitId, deviceTypeMap]) => ({
      unitId,
      deviceTypes: Array.from(deviceTypeMap.entries()).map(([deviceType, list]) => ({
        deviceType,
        devices: list,
      })),
    })),
  }));
};

const sortDevices = (devices) =>
  [...devices].sort((a, b) => {
    const statusA = String(a.status || "").toLowerCase();
    const statusB = String(b.status || "").toLowerCase();
    if (statusA === "online" && statusB !== "online") return -1;
    if (statusA !== "online" && statusB === "online") return 1;
    return String(a.deviceId || "").localeCompare(String(b.deviceId || ""));
  });

export default function Overview() {
  const [farms, setFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [loadingFarms, setLoadingFarms] = useState(false);
  const [farmError, setFarmError] = useState("");

  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [devicesError, setDevicesError] = useState("");

  const [filters, setFilters] = useState({
    deviceType: "",
    unitId: "",
    hasAlarms: "all",
  });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const loadFarms = async () => {
      setLoadingFarms(true);
      setFarmError("");
      try {
        const payload = await listFarms({ signal: controller.signal });
        if (cancelled) return;
        const resolved = resolveFarmList(payload)
          .map(normalizeFarm)
          .filter(Boolean);
        setFarms(resolved);
        if (!selectedFarmId && resolved.length > 0) {
          setSelectedFarmId(resolved[0].id);
        }
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        console.error("Failed to load farms", error);
        setFarmError("Unable to load farms.");
        setFarms([]);
      } finally {
        if (!cancelled) setLoadingFarms(false);
      }
    };
    loadFarms();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!selectedFarmId) {
      setDevices([]);
      setDevicesError("");
      setLoadingDevices(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const loadDevices = async () => {
      setLoadingDevices(true);
      setDevicesError("");
      try {
        const payload = await listFarmDevices(selectedFarmId, { signal: controller.signal });
        if (cancelled) return;
        const list = resolveDeviceList(payload).map(normalizeDevice);
        setDevices(list);
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        console.error("Failed to load devices", error);
        setDevicesError("Unable to load devices.");
        setDevices([]);
      } finally {
        if (!cancelled) setLoadingDevices(false);
      }
    };
    loadDevices();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedFarmId]);

  const deviceTypeOptions = useMemo(() => {
    const types = new Set();
    devices.forEach((device) => {
      if (device.deviceType) types.add(device.deviceType);
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [devices]);

  const unitIdOptions = useMemo(() => {
    const ids = new Set();
    devices.forEach((device) => {
      if (device.unitId) ids.add(device.unitId);
    });
    return Array.from(ids).sort((a, b) => a.localeCompare(b));
  }, [devices]);

  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      if (filters.deviceType && device.deviceType !== filters.deviceType) return false;
      if (filters.unitId && device.unitId !== filters.unitId) return false;
      if (filters.hasAlarms === "alarms" && !resolveHasAlarm(device)) return false;
      return true;
    });
  }, [devices, filters]);

  const hierarchy = useMemo(() => buildHierarchy(sortDevices(filteredDevices)), [filteredDevices]);

  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId);

  return (
    <div className={styles.page}>
      <Header title="Overview" />
      <section className={styles.card}>
        <div className={styles.headerRow}>
          <div>
            <h2 className={styles.title}>Device Inventory</h2>
            <p className={styles.subtitle}>Backend-driven view of device state.</p>
          </div>
          <div className={styles.farmPicker}>
            <label htmlFor="farm-select">Farm</label>
            <select
              id="farm-select"
              value={selectedFarmId}
              onChange={(event) => setSelectedFarmId(event.target.value)}
              disabled={loadingFarms || farms.length === 0}
            >
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loadingFarms ? <p className={styles.statusMessage}>Loading farms…</p> : null}
        {farmError ? <p className={styles.statusMessage}>{farmError}</p> : null}
        {!loadingFarms && !farmError && farms.length === 0 ? (
          <p className={styles.statusMessage}>No farms available.</p>
        ) : null}
      </section>

      <section className={styles.card}>
        <div className={styles.filtersRow}>
          <div className={styles.filterGroup}>
            <label htmlFor="device-type-filter">Device type</label>
            <select
              id="device-type-filter"
              value={filters.deviceType}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, deviceType: event.target.value }))
              }
            >
              <option value="">All</option>
              {deviceTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="unit-id-filter">Unit ID</label>
            <select
              id="unit-id-filter"
              value={filters.unitId}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, unitId: event.target.value }))
              }
            >
              <option value="">All</option>
              {unitIdOptions.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="alarm-filter">Alarms</label>
            <select
              id="alarm-filter"
              value={filters.hasAlarms}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, hasAlarms: event.target.value }))
              }
            >
              <option value="all">All</option>
              <option value="alarms">Has alarms</option>
            </select>
          </div>
          <div className={styles.filterMeta}>
            <span>{filteredDevices.length} devices</span>
            {selectedFarm ? <span>Farm: {selectedFarm.name}</span> : null}
          </div>
        </div>
        {loadingDevices ? <p className={styles.statusMessage}>Loading devices…</p> : null}
        {devicesError ? <p className={styles.statusMessage}>{devicesError}</p> : null}
        {!loadingDevices && !devicesError && filteredDevices.length === 0 ? (
          <p className={styles.statusMessage}>No devices found.</p>
        ) : null}

        {!loadingDevices && !devicesError && filteredDevices.length > 0 ? (
          <div className={styles.hierarchy}>
            {hierarchy.map((unitTypeGroup) => (
              <div key={unitTypeGroup.unitType} className={styles.unitTypeGroup}>
                <div className={styles.unitTypeHeader}>
                  UnitType: {unitTypeGroup.unitType}
                </div>
                {unitTypeGroup.units.map((unit) => (
                  <div key={unit.unitId} className={styles.unitGroup}>
                    <div className={styles.unitHeader}>Unit: {unit.unitId}</div>
                    {unit.deviceTypes.map((deviceTypeGroup) => (
                      <div key={deviceTypeGroup.deviceType} className={styles.deviceTypeGroup}>
                        <div className={styles.deviceTypeHeader}>
                          DeviceType: {deviceTypeGroup.deviceType}
                        </div>
                        <div className={styles.deviceGrid}>
                          {deviceTypeGroup.devices.map((device, index) => (
                            <DeviceCard
                              key={device.deviceId || `${device.deviceType}-${index}`}
                              device={device}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
