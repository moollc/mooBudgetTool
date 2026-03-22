# OpenGate REST API (v1)

## Base Endpoint
`GET https://[PROJECT_REF].supabase.co/functions/v1/opengate`

## Access & Authentication
No authentication required. All requests must include an `apikey` header mapping to the Supabase Anon Key.

```http
apikey: YOUR_SUPABASE_ANON_KEY
```

## Endpoints

### Get Average Rates
`GET /opengate`

Returns an aggregated list of community rates from `og_rate_averages`. Rates with a negative community net score (<= -2) are systematically excluded.

#### Query Parameters
- `region` (string): Optional. Filter rates by string match (e.g., `Jamaica`).
- `currency` (string): Optional. Filter rates by ISO currency code (e.g., `JMD`).

#### Response Mapping (200 OK)
```json
{
  "rates": [
    {
      "description": "Director of Photography (DP)",
      "region": "Jamaica",
      "avg_rate": 90000,
      "contributor_count": 5,
      "currency": "JMD"
    }
  ]
}
```

### Rate Limiting
Handled inherently via Supabase Edge Function default API gateway caps.
