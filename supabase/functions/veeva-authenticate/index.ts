import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { veevaUrl, username, password } = await req.json()

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Authenticate with Veeva CTMS API
    const authResponse = await fetch(`${veevaUrl}/api/v1/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: username,
        password: password,
      }),
    })

    if (!authResponse.ok) {
      throw new Error(`Veeva authentication failed: ${authResponse.statusText}`)
    }

    const authData = await authResponse.json()
    
    if (!authData.sessionId) {
      throw new Error('No session ID received from Veeva CTMS')
    }

    // Get the configuration ID from the request headers or body
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    // Find the configuration for this user
    const { data: config, error: configError } = await supabaseClient
      .from('veeva_configurations')
      .select('id')
      .eq('user_id', user.id)
      .eq('veeva_url', veevaUrl)
      .eq('username', username)
      .single()

    if (configError || !config) {
      throw new Error('Configuration not found')
    }

    // Store the session
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 8) // 8 hour session

    const { error: sessionError } = await supabaseClient
      .from('veeva_sessions')
      .insert({
        configuration_id: config.id,
        session_id: authData.sessionId,
        expires_at: expiresAt.toISOString(),
        is_active: true,
      })

    if (sessionError) {
      throw new Error('Failed to store session')
    }

    // Update configuration as active
    await supabaseClient
      .from('veeva_configurations')
      .update({ 
        is_active: true,
        last_sync: new Date().toISOString()
      })
      .eq('id', config.id)

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: authData.sessionId,
        expiresAt: expiresAt.toISOString(),
        message: 'Successfully authenticated with Veeva CTMS'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Veeva authentication error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})