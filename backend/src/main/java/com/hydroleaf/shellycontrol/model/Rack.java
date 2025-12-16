package com.hydroleaf.shellycontrol.model;

import java.util.List;

public record Rack(String id, String name, String roomId, List<ShellySocket> sockets) {}
