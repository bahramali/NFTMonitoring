package com.hydroleaf.shellycontrol.controller.dto;

import jakarta.validation.constraints.NotNull;

public record SetStateRequest(@NotNull Boolean on) {}
