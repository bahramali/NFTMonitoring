package com.hydroleaf.shellycontrol.controller.dto;

public record PermissionDefinition(
        String key,
        String label,
        String description,
        boolean defaultSelected
) {}
