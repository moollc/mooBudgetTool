import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    const url = new URL(req.url)
    const regionFilter = url.searchParams.get('region')
    const currencyFilter = url.searchParams.get('currency')

    let query = supabaseClient.from('og_rate_averages').select('*')
    
    if (regionFilter) {
      query = query.eq('region', regionFilter)
    }
    if (currencyFilter) {
      query = query.eq('currency', currencyFilter)
    }

    const { data, error } = await query

    if (error) throw error

    return new Response(JSON.stringify({ rates: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
