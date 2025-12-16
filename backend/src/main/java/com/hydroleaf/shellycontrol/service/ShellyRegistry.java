package com.hydroleaf.shellycontrol.service;

import com.hydroleaf.shellycontrol.config.ShellyRegistryProperties;
import com.hydroleaf.shellycontrol.exception.NotFoundException;
import com.hydroleaf.shellycontrol.model.Rack;
import com.hydroleaf.shellycontrol.model.Room;
import com.hydroleaf.shellycontrol.model.ShellySocket;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class ShellyRegistry {

    private final List<Room> rooms;
    private final Map<String, ShellySocket> socketIndex;

    public ShellyRegistry(ShellyRegistryProperties properties) {
        this.rooms = properties.toRooms();
        this.socketIndex = rooms.stream()
                .flatMap(room -> room.racks().stream())
                .flatMap(rack -> rack.sockets().stream())
                .collect(Collectors.toUnmodifiableMap(ShellySocket::id, Function.identity()));
    }

    public List<Room> getRooms() {
        return Collections.unmodifiableList(rooms);
    }

    public ShellySocket getSocket(String socketId) {
        return Optional.ofNullable(socketIndex.get(socketId))
                .orElseThrow(() -> new NotFoundException("Socket " + socketId + " not found"));
    }
}
