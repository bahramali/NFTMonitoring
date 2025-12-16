package com.hydroleaf.shellycontrol.shelly;

import com.hydroleaf.shellycontrol.model.ShellySocket;
import com.hydroleaf.shellycontrol.model.ShellyStatus;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.net.URI;
import java.util.Map;

@Component
public class ShellyClient {

    private final RestTemplate restTemplate;

    public ShellyClient() {
        this.restTemplate = new RestTemplate();
    }

    public ShellyStatus fetchStatus(ShellySocket socket) {
        try {
            URI uri = URI.create("http://" + socket.ipAddress() + "/rpc/Switch.GetStatus?id=0");
            Map response = restTemplate.getForObject(uri, Map.class);
            boolean output = Boolean.TRUE.equals(response.get("output"));
            BigDecimal power = toDecimal(response.get("apower"));
            BigDecimal voltage = toDecimal(response.get("voltage"));
            return new ShellyStatus(socket.id(), true, output, power, voltage);
        } catch (RestClientException ex) {
            return new ShellyStatus(socket.id(), false, false, null, null);
        }
    }

    public ShellyStatus setState(ShellySocket socket, boolean turnOn) {
        try {
            URI uri = URI.create("http://" + socket.ipAddress() + "/rpc/Switch.Set");
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, Object> body = Map.of("id", 0, "on", turnOn);
            restTemplate.postForEntity(uri, new HttpEntity<>(body, headers), Map.class);
            return fetchStatus(socket);
        } catch (RestClientException ex) {
            return new ShellyStatus(socket.id(), false, turnOn, null, null);
        }
    }

    public ShellyStatus toggle(ShellySocket socket) {
        try {
            URI uri = URI.create("http://" + socket.ipAddress() + "/rpc/Switch.Toggle");
            restTemplate.postForEntity(uri, null, Map.class);
            return fetchStatus(socket);
        } catch (RestClientException ex) {
            return new ShellyStatus(socket.id(), false, false, null, null);
        }
    }

    private BigDecimal toDecimal(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
