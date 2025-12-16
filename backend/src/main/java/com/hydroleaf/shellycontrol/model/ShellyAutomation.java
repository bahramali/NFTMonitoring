package com.hydroleaf.shellycontrol.model;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public class ShellyAutomation {
    private final String id;
    private final String socketId;
    private final AutomationType type;
    private final LocalTime startTime;
    private final LocalTime endTime;
    private final List<DayOfWeek> daysOfWeek;
    private final Integer intervalMinutes;
    private final Integer autoOffMinutes;

    public ShellyAutomation(String socketId, AutomationType type, LocalTime startTime, LocalTime endTime,
                            List<DayOfWeek> daysOfWeek, Integer intervalMinutes, Integer autoOffMinutes) {
        this(UUID.randomUUID().toString(), socketId, type, startTime, endTime, daysOfWeek, intervalMinutes, autoOffMinutes);
    }

    public ShellyAutomation(String id, String socketId, AutomationType type, LocalTime startTime, LocalTime endTime,
                            List<DayOfWeek> daysOfWeek, Integer intervalMinutes, Integer autoOffMinutes) {
        this.id = id;
        this.socketId = socketId;
        this.type = type;
        this.startTime = startTime;
        this.endTime = endTime;
        this.daysOfWeek = daysOfWeek;
        this.intervalMinutes = intervalMinutes;
        this.autoOffMinutes = autoOffMinutes;
    }

    public String getId() {
        return id;
    }

    public String getSocketId() {
        return socketId;
    }

    public AutomationType getType() {
        return type;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public List<DayOfWeek> getDaysOfWeek() {
        return daysOfWeek;
    }

    public Integer getIntervalMinutes() {
        return intervalMinutes;
    }

    public Integer getAutoOffMinutes() {
        return autoOffMinutes;
    }
}
