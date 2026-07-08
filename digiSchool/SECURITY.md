# Security Policy

## Supported Versions
Use the latest version available on the `main` branch.

## Known Exceptions / Accepted Risks

### xlsx Prototype Pollution & ReDoS (CVEs related to `xlsx` npm package)
The `xlsx` package is currently flagged in `npm audit` for prototype pollution and ReDoS vulnerabilities.

**Risk Assessment:**
- **Status**: Accepted Risk
- **Exposure**: Low. The library is used *exclusively* for outbound data generation (exporting tables to Excel CSVs in `src/utils/exporters.js`).
- **Mitigating Factors**: We do NOT use this library to parse untrusted user uploads. Because it only writes structured data that we generate from our database, the exploitation paths for ReDoS or prototype pollution are not exposed to external threat actors.

## Reporting a Vulnerability
If you discover a security vulnerability, please report it via private email or by creating a GitHub Draft Security Advisory. Please do not open a public issue.
