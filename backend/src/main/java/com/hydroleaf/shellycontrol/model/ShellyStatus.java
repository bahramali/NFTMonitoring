package com.hydroleaf.shellycontrol.model;

import java.math.BigDecimal;

public record ShellyStatus(String socketId, boolean online, boolean outputOn, BigDecimal powerW, BigDecimal voltageV) {}
