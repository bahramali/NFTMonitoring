package com.hydroleaf.shellycontrol.service;

import com.hydroleaf.shellycontrol.model.ShellySocket;
import com.hydroleaf.shellycontrol.model.ShellyStatus;
import com.hydroleaf.shellycontrol.shelly.ShellyClient;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class ShellyService {

    private final ShellyRegistry registry;
    private final ShellyClient client;
    private final Map<String, ShellyStatus> lastKnownStatus = new ConcurrentHashMap<>();

    public ShellyService(ShellyRegistry registry, ShellyClient client) {
        this.registry = registry;
        this.client = client;
    }

    public Map<String, ShellyStatus> fetchStatuses(List<String> socketIds) {
        List<ShellySocket> sockets = socketIds == null || socketIds.isEmpty()
                ? registry.getRooms().stream().flatMap(room -> room.racks().stream()).flatMap(rack -> rack.sockets().stream()).toList()
                : socketIds.stream().map(registry::getSocket).toList();

        Map<String, ShellyStatus> statuses = sockets.stream()
                .collect(Collectors.toMap(ShellySocket::id, client::fetchStatus));
        lastKnownStatus.putAll(statuses);
        return statuses;
    }

    public ShellyStatus toggle(String socketId) {
        ShellySocket socket = registry.getSocket(socketId);
        ShellyStatus status = client.toggle(socket);
        lastKnownStatus.put(socketId, status);
        return status;
    }

    public ShellyStatus setState(String socketId, boolean on) {
        ShellySocket socket = registry.getSocket(socketId);
        ShellyStatus status = client.setState(socket, on);
        lastKnownStatus.put(socketId, status);
        return status;
    }

    public ShellyStatus getCachedStatus(String socketId) {
        return lastKnownStatus.get(socketId);
    }

    public List<ShellySocket> listSockets() {
        return registry.getRooms().stream().flatMap(room -> room.racks().stream()).flatMap(rack -> rack.sockets().stream()).toList();
    }

    public List<com.hydroleaf.shellycontrol.model.Room> rooms() {
        return registry.getRooms();
    }
}
