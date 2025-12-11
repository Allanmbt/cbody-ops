import { NextResponse } from 'next/server'

const API_DOCS = `
# CBODY Girls API Documentation

## Base URL
\`\`\`
https://api.cbody.vip/api/v1
\`\`\`

## Authentication

All API requests require an API key. Include it in one of the following ways:

### Option 1: Authorization Header (Recommended)
\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

### Option 2: Query Parameter
\`\`\`
?api_key=YOUR_API_KEY
\`\`\`

## Rate Limits

- **Per Minute**: 100 requests
- **Per Hour**: 1000 requests

Rate limit headers are included in every response:
- \`X-RateLimit-Limit\`: Maximum requests allowed
- \`X-RateLimit-Remaining\`: Remaining requests in current window
- \`X-RateLimit-Reset\`: When the rate limit resets (ISO 8601 timestamp)

When rate limit is exceeded, API returns \`429 Too Many Requests\` with a \`Retry-After\` header.

## Endpoints

### GET /api/v1/girls

Get list of all available girls.

**Request Example:**
\`\`\`bash
curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://api.cbody.vip/api/v1/girls
\`\`\`

**Response Example:**
\`\`\`json
{
  "ok": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "girl_number": 101,
      "city_id": "bangkok",
      "username": "Alice",
      "avatar_url": "https://example.com/avatar.jpg",
      "lat": 13.7563,
      "lng": 100.5018,
      "status": "available",
      "next_available_time": null
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "girl_number": 102,
      "city_id": "phuket",
      "username": "Bella",
      "avatar_url": "https://example.com/avatar2.jpg",
      "lat": 7.8804,
      "lng": 98.3923,
      "status": "busy",
      "next_available_time": "2024-12-09T15:30:00Z"
    }
  ],
  "meta": {
    "total": 2,
    "timestamp": "2024-12-09T10:00:00Z"
  }
}
\`\`\`

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | Unique girl identifier (UUID) |
| \`girl_number\` | number | Girl's display number |
| \`city_id\` | string | City identifier |
| \`username\` | string | Display name |
| \`avatar_url\` | string \\| null | Avatar image URL |
| \`lat\` | number \\| null | Current latitude |
| \`lng\` | number \\| null | Current longitude |
| \`status\` | string | Status: "available", "busy", or "offline" |
| \`next_available_time\` | string \\| null | Next available time (ISO 8601) |

**Filters:**
- Only returns girls where \`is_blocked = false\` and \`is_verified = true\`

## Error Responses

### 401 Unauthorized
\`\`\`json
{
  "ok": false,
  "error": "Invalid API key"
}
\`\`\`

### 429 Too Many Requests
\`\`\`json
{
  "ok": false,
  "error": "Rate limit exceeded",
  "retryAfter": 30
}
\`\`\`

### 500 Internal Server Error
\`\`\`json
{
  "ok": false,
  "error": "Internal server error"
}
\`\`\`

## Best Practices

1. **Cache responses**: Data doesn't change frequently, cache for 1-5 minutes
2. **Handle rate limits**: Implement exponential backoff when receiving 429 errors
3. **Secure your API key**: Never expose it in client-side code or public repositories
4. **Monitor usage**: Track your API calls to stay within rate limits

## Support

For API key requests or technical support, contact: support@cbody.vip

---
*Last updated: 2024-12-09*
`

/**
 * GET /api/v1/docs
 * 返回 API 文档
 */
export async function GET() {
  return new NextResponse(API_DOCS, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
