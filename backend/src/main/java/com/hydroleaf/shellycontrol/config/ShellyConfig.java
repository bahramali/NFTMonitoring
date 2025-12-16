package com.hydroleaf.shellycontrol.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ShellyRegistryProperties.class)
public class ShellyConfig {
}
