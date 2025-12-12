package com.example.nftmonitoring.bootstrap;

import com.example.nftmonitoring.user.User;
import com.example.nftmonitoring.user.UserRepository;
import com.example.nftmonitoring.user.UserRole;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class SuperAdminSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminSeeder.class);
    private static final int MIN_PASSWORD_LENGTH = 12;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SuperAdminProperties properties;

    public SuperAdminSeeder(UserRepository userRepository,
                            PasswordEncoder passwordEncoder,
                            SuperAdminProperties properties) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.properties = properties;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.existsByRole(UserRole.SUPER_ADMIN)) {
            log.info("SUPER_ADMIN already present; skipping seed");
            return;
        }

        String email = normalizeEmail(properties.getEmail());
        String password = properties.getPassword();

        if (!StringUtils.hasText(email) || !StringUtils.hasText(password)) {
            log.warn("SUPER_ADMIN seed skipped: email or password not configured");
            return;
        }

        if (password.length() < MIN_PASSWORD_LENGTH) {
            log.warn("SUPER_ADMIN seed skipped: password must be at least {} characters", MIN_PASSWORD_LENGTH);
            return;
        }

        User user = new User();
        user.setEmail(email);
        user.setDisplayName(StringUtils.hasText(properties.getDisplayName())
            ? properties.getDisplayName()
            : "Super Admin");
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(UserRole.SUPER_ADMIN);
        user.setActive(properties.getActive() == null || properties.getActive());

        userRepository.save(user);
        log.info("Seeded initial SUPER_ADMIN with email {}", email);
    }

    private String normalizeEmail(String rawEmail) {
        if (!StringUtils.hasText(rawEmail)) {
            return null;
        }
        return rawEmail.trim().toLowerCase();
    }
}
