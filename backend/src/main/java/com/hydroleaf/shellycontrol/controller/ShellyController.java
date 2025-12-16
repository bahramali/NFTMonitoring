package com.hydroleaf.shellycontrol.controller;

import com.hydroleaf.shellycontrol.controller.dto.CreateAutomationRequest;
import com.hydroleaf.shellycontrol.controller.dto.SetStateRequest;
import com.hydroleaf.shellycontrol.model.AutomationType;
import com.hydroleaf.shellycontrol.model.ShellyAutomation;
import com.hydroleaf.shellycontrol.model.ShellyStatus;
import com.hydroleaf.shellycontrol.service.AutomationService;
import com.hydroleaf.shellycontrol.service.ShellyService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/shelly")
public class ShellyController {

    private final ShellyService shellyService;
    private final AutomationService automationService;

    public ShellyController(ShellyService shellyService, AutomationService automationService) {
        this.shellyService = shellyService;
        this.automationService = automationService;
    }

    @GetMapping("/rooms")
    public Map<String, Object> listRooms() {
        return Map.of("rooms", shellyService.rooms());
    }

    @GetMapping("/status")
    public Map<String, ShellyStatus> listStatuses(@RequestParam(value = "ids", required = false) List<String> socketIds) {
        return shellyService.fetchStatuses(socketIds);
    }

    @PostMapping("/socket/{socketId}/toggle")
    public ShellyStatus toggle(@PathVariable String socketId) {
        return shellyService.toggle(socketId);
    }

    @PostMapping("/socket/{socketId}/state")
    public ShellyStatus setState(@PathVariable String socketId, @Valid @RequestBody SetStateRequest request) {
        return shellyService.setState(socketId, Boolean.TRUE.equals(request.on()));
    }

    @GetMapping("/automation")
    public List<ShellyAutomation> listAutomations() {
        return automationService.listAutomations();
    }

    @PostMapping("/automation")
    public ShellyAutomation createAutomation(@Valid @RequestBody CreateAutomationRequest request) {
        validateAutomation(request);
        ShellyAutomation automation = new ShellyAutomation(
                request.socketId(),
                request.type(),
                request.startTime(),
                request.endTime(),
                request.daysOfWeek(),
                request.intervalMinutes(),
                request.autoOffMinutes()
        );
        return automationService.createAutomation(automation);
    }

    @DeleteMapping("/automation/{id}")
    public ResponseEntity<Void> deleteAutomation(@PathVariable String id) {
        automationService.deleteAutomation(id);
        return ResponseEntity.noContent().build();
    }

    private void validateAutomation(CreateAutomationRequest request) {
        AutomationType type = request.type();
        if (type == AutomationType.TIME_RANGE && (request.startTime() == null || request.endTime() == null)) {
            throw new IllegalArgumentException("startTime and endTime are required for TIME_RANGE automations");
        }
        if (type == AutomationType.INTERVAL_TOGGLE && (request.intervalMinutes() == null || request.intervalMinutes() < 1)) {
            throw new IllegalArgumentException("intervalMinutes must be provided for INTERVAL_TOGGLE automations");
        }
        if (type == AutomationType.AUTO_OFF && (request.autoOffMinutes() == null || request.autoOffMinutes() < 1)) {
            throw new IllegalArgumentException("autoOffMinutes must be provided for AUTO_OFF automations");
        }
    }
}
