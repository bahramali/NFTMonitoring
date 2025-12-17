package com.hydroleaf.shellycontrol.controller;

import com.hydroleaf.shellycontrol.controller.dto.PermissionDefinition;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminPermissionController {

    @GetMapping("/permissions")
    public Map<String, List<PermissionDefinition>> listPermissions() {
        List<PermissionDefinition> permissions = List.of(
                new PermissionDefinition("ADMIN_DASHBOARD", "Admin Overview", "Access the admin dashboard and overview screens.", true),
                new PermissionDefinition("ADMIN_REPORTS", "Reports", "View analytics and admin reports.", false),
                new PermissionDefinition("ADMIN_TEAM", "Team", "Manage admin teammates and permissions.", false)
        );

        return Map.of("permissions", permissions);
    }
}
