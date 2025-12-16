package com.hydroleaf.shellycontrol.controller.dto;

import com.hydroleaf.shellycontrol.model.AutomationType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;

public record CreateAutomationRequest(
        @NotBlank String socketId,
        @NotNull AutomationType type,
        LocalTime startTime,
        LocalTime endTime,
        List<DayOfWeek> daysOfWeek,
        @Min(1) Integer intervalMinutes,
        @Min(1) Integer autoOffMinutes
) {}
