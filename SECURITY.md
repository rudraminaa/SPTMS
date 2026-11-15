# Security Policy

## Project status

SPTMS is currently a demonstration/academic application. The supplied implementation has no user authentication, authorization, persistent database, rate limiting, payment processing or production-grade audit controls. The server keeps facility state in process memory. Do not use it to operate a real parking facility or store real personal, vehicle or payment information.

## Supported versions

Security fixes are currently considered for the latest repository version.

## Reporting a vulnerability

Please do not publish exploit details in a public issue. Contact the repository maintainers through the private vulnerability reporting feature on GitHub (if enabled), or use the private contact method listed in the repository profile. Include affected version, impact and reproducible steps. Do not include real personal or vehicle data.

## Deployment hardening checklist

Before any real deployment, implement and independently review at least:

- Authentication, role-based authorization and secure session/token handling.
- Persistent storage, backups, migrations and concurrency-safe state updates.
- Input size limits, schema validation, rate limiting and abuse protection.
- HTTPS/WSS, secure headers, restrictive CORS/origin policy and secret management.
- Privacy controls, retention/deletion policy and redaction of personal/vehicle data.
- Operational logging, monitoring, alerting and incident response.
- Dependency and container scanning, patch management and security testing.
