package com.hydroleaf.shellycontrol.config;

import com.hydroleaf.shellycontrol.model.Room;
import com.hydroleaf.shellycontrol.model.ShellySocket;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

@ConfigurationProperties(prefix = "shelly")
@Validated
public class ShellyRegistryProperties {

    private final List<RoomConfig> rooms;

    public ShellyRegistryProperties(@DefaultValue("{}") RoomsWrapper wrapper) {
        this.rooms = wrapper.rooms;
    }

    public List<Room> toRooms() {
        return rooms.stream()
                .map(room -> new Room(room.id, room.name, room.racks.stream()
                        .map(rack -> new Rack(rack.id, rack.name, room.id, rack.sockets.stream()
                                .map(socket -> new ShellySocket(socket.id, socket.name, rack.id, socket.ip))
                                .toList()))
                        .toList()))
                .toList();
    }

    public List<RoomConfig> getRooms() {
        return rooms;
    }

    @Validated
    public record RoomsWrapper(@DefaultValue("#{T(java.util.Collections).emptyList()}") List<RoomConfig> rooms) {}

    @Validated
    public record RoomConfig(@NotBlank String id, @NotBlank String name,
                             @DefaultValue("#{T(java.util.Collections).emptyList()}") List<RackConfig> racks) {}

    @Validated
    public record RackConfig(@NotBlank String id, @NotBlank String name,
                             @DefaultValue("#{T(java.util.Collections).emptyList()}") List<SocketConfig> sockets) {}

    @Validated
    public record SocketConfig(@NotBlank String id, @NotBlank String name, @NotBlank String ip) {}
}
