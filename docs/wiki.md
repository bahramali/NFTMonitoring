# NFT Monitoring Frontend

This wiki page summarizes what the HydroLeaf Shop frontend does and how it interacts with the backend services.

## Purpose
The application provides dashboards and customer pages for managing NFT-powered irrigation devices. It connects to backend APIs for authentication, user management, and live telemetry so users can monitor equipment and perform role-based tasks.

## Key Features
- **Authentication and session handling**: Users log in with email and password. The frontend stores only backend-issued session fields (token, userId, role, and permissions) and routes users based on their role.
- **Role-based navigation**: SUPER_ADMIN, ADMIN, WORKER, and CUSTOMER users see different sections. Admin access respects the permissions array returned by the backend. SUPER_ADMIN inherits full access and may also view monitoring dashboards.
- **Monitoring dashboards**: Admins and workers can open dashboards for device health, irrigation performance, and alerts.
- **User pages**: Customers have a dedicated My Page to view their devices and account information.
- **Inviting admins**: Admin management pages (accessible only to SUPER_ADMIN) allow inviting and managing ADMIN users and configuring their permissions; no other role can invite or create admins. Backend email delivery handles credential setup.

## How It Works with the Backend
1. **Login**: The frontend sends email/password to `/api/auth/login` and uses the returned token, userId, role, and permissions as the single source of truth.
2. **Permissions**: For ADMIN users, the backend-provided `permissions` array determines which admin pages and actions are shown; other roles ignore this field.
3. **Access control**: Routes and navigation links check the stored role and, for admin pages, required permissions. Requests never hardcode privileged users; SUPER_ADMIN is treated like any other role supplied by the backend.
4. **Logout**: Clearing session state removes token, userId, role, and permissions from memory and local storage.

## Security Expectations
- No hardcoded credentials exist in the frontend.
- Sensitive values are kept only for the active session and cleared on logout.
- Role elevation or identification is entirely dictated by backend responses.

## User Journey Overview
- **Customer**: Registers or logs in, then reaches `/my-page` for personal data.
- **Worker**: Logs in and is redirected to `/worker/dashboard` for operational tools.
- **Admin**: Logs in and sees only the admin sections their permissions allow; admins cannot invite or create other admins.
- **Super Admin**: Logs in and accesses `/super-admin` and related oversight tools without any preloaded credentials on the frontend. SUPER_ADMIN inherits full access and may also view monitoring dashboards. SUPER_ADMIN accounts are provisioned via an initial seed/migration or an internal server-side process, not through public UI or API endpoints.
