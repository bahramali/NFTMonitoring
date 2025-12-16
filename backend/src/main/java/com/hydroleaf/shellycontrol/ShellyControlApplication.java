package com.hydroleaf.shellycontrol;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ShellyControlApplication {
    public static void main(String[] args) {
        SpringApplication.run(ShellyControlApplication.class, args);
    }
}
