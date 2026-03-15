# Security Policy

This document outlines security practices and procedures for SoussFlow.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in SoussFlow, please report it responsibly:

1. **Do NOT** create a public GitHub issue
2. **Email** the maintainer directly with details
3. **Include** in your report:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

We aim to respond within 48 hours and will keep you updated on progress.

## Security Best Practices

### Authentication

- **JWT tokens** are used for API authentication
- **bcrypt** is used for password hashing
- Tokens expire after configurable duration
- Always use strong, unique JWT secrets in production

### Environment Variables

Never commit sensitive information. Required variables:

```env
# Must be changed in production
JWT_SECRET_KEY=generate-a-strong-random-key

# Keep secret
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Keep secret
OPENAI_API_KEY=your-api-key
```

### Production Deployment

1. **Change default JWT secret** - Generate a strong random key
2. **Enable HTTPS** - Never run in production without TLS
3. **Configure CORS** - Restrict allowed origins
4. **Database security** - Use Supabase RLS policies
5. **API rate limiting** - Consider adding rate limits

### Data Handling

- **Passwords**: Never stored in plain text, always hashed with bcrypt
- **API Keys**: Stored in environment variables only
- **User Data**: Farm-scoped with role-based access control
- **Sensor Data**: Farm-specific, no cross-farm access

### Dependencies

- Keep Python and Node.js updated
- Regularly audit dependencies:
  ```bash
  # Python
  pip list --outdated

  # Node.js
  npm audit
  npm outdated
  ```

## Access Control

### User Roles

| Role | Access Level |
|------|--------------|
| `superadmin` | Backend dashboard only |
| `farm_owner` | Full access to their farm |
| `farm_employee` | Limited, configurable permissions |

### Farm Isolation

- All data is farm-scoped
- RLS policies prevent cross-farm access
- X-Farm-ID header validates farm context

## Incident Response

In case of a security incident:

1. **Contain** - Isolate affected systems
2. **Assess** - Determine scope and impact
3. **Notify** - Inform affected users
4. **Remediate** - Fix vulnerabilities
5. **Review** - Prevent future occurrences

## Security Updates

Security patches will be released as soon as possible. Critical vulnerabilities will trigger immediate patch releases.

## Acknowledgments

Thank you to everyone who helps keep SoussFlow secure by reporting vulnerabilities responsibly.
