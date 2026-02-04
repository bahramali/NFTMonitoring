// tests/DeviceCard.test.jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DeviceCard from "../src/pages/Overview/components/DeviceCard.jsx";

test("renders device id and groups AS7343 readings inside the sensor list", () => {
  const props = {
    // Make sure legacy title has a value even if component expects compositeId
    id: "S01-L01-G03",
    compositeId: "S01-L01-G03",
    sensors: [
      { sensorName: "SHT3x", sensorType: "temperature", value: 22.9, unit: "°C" },
      { sensorName: "SHT3x", sensorType: "humidity", value: 56, unit: "%" },
      { sensorName: "CO₂ Sensor", sensorType: "co2", value: 417, unit: "ppm" },
      { sensorName: "AS7343", sensorType: "405nm", value: 274, unit: "raw" },
      { sensorName: "AS7343", sensorType: "425nm", value: 339, unit: "raw" },
      { sensorName: "AS7343", sensorType: "515nm", value: 493, unit: "raw" },
      { sensorName: "AS7343", sensorType: "555nm", value: 553, unit: "raw" },
      { sensorName: "AS7343", sensorType: "640nm", value: 580, unit: "raw" },
      { sensorName: "AS7343", sensorType: "690nm", value: 654, unit: "raw" },
      { sensorName: "VEML7700", sensorType: "light", value: 3818.189, unit: "lux" },
    ],
  };

  render(<DeviceCard {...props} />);

  // Device ID title/badge
  expect(screen.getByText("S01-L01-G03")).toBeInTheDocument();

  // Old compact summary should not exist
  expect(screen.queryByText("[Temp, Humidity]")).not.toBeInTheDocument();

  // New section heading (matches current component)
  expect(screen.getByText("Readings")).toBeInTheDocument();

  // Individual sensors are rendered
  expect(screen.getAllByText("SHT3x")).toHaveLength(2);
  expect(screen.getByText("417 ppm")).toBeInTheDocument();

  // AS7343 wavelengths are grouped together
  expect(screen.getByText("AS7343 (Blue band)")).toBeInTheDocument();
  expect(screen.getByText(/405nm:\s*274\s*raw/i)).toBeInTheDocument();
  expect(screen.getByText("AS7343 (Red/NIR band)")).toBeInTheDocument();
});
