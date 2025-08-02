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
    console.log('=== Veeva Sync Data Function Started ===')
    const { configurationId } = await req.json()
    console.log('Configuration ID received:', configurationId)

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    // Get configuration and latest active session
    console.log('Looking up configuration and latest session...')
    
    // First get the configuration
    const { data: config, error: configError } = await supabaseClient
      .from('veeva_configurations')
      .select('*')
      .eq('id', configurationId)
      .eq('user_id', user.id)
      .single()

    console.log('Configuration lookup result:', { config, configError })

    if (configError || !config) {
      throw new Error(`Configuration not found: ${configError?.message || 'Unknown error'}`)
    }

    // Get the most recent active session for this configuration
    const { data: sessions, error: sessionError } = await supabaseClient
      .from('veeva_sessions')
      .select('session_id, expires_at, is_active, created_at')
      .eq('configuration_id', configurationId)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    console.log('Session lookup result:', { sessions, sessionError })

    if (sessionError || !sessions || sessions.length === 0) {
      throw new Error(`No active session found: ${sessionError?.message || 'Session expired or not found'}`)
    }

    const sessionId = sessions[0].session_id
    const veevaUrl = config.veeva_url
    console.log('Using latest session ID:', sessionId?.substring(0, 20) + '...')
    console.log('Session expires at:', sessions[0].expires_at)
    console.log('Veeva URL:', veevaUrl)

    // Use the exact endpoint format you specified
    const studiesApiUrl = `${veevaUrl}/api/v24.3/objects/study__v`
    console.log('Fetching studies from exact endpoint:', studiesApiUrl)
    
    const studiesResponse = await fetch(studiesApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': sessionId,
        'Accept': 'application/json'
      },
    })

    console.log('Studies response status:', studiesResponse.status)
    console.log('Studies response headers:', Object.fromEntries(studiesResponse.headers.entries()))

    if (!studiesResponse.ok) {
      const errorText = await studiesResponse.text()
      console.error('Studies API error response:', errorText)
      
      // If the exact endpoint fails, let's try to check what objects are available
      const objectsApiUrl = `${veevaUrl}/api/v24.3/objects`
      console.log('Checking available objects:', objectsApiUrl)
      
      const objectsResponse = await fetch(objectsApiUrl, {
        method: 'GET',
        headers: {
          'Authorization': sessionId,
          'Accept': 'application/json',
        },
      })

      if (objectsResponse.ok) {
        const objectsData = await objectsResponse.json()
        console.log('Available objects:', JSON.stringify(objectsData, null, 2))
      } else {
        const objectsError = await objectsResponse.text()
        console.log('Objects API also failed:', objectsResponse.status, objectsError)
      }
      
      throw new Error(`Failed to fetch studies from ${studiesApiUrl}. Status: ${studiesResponse.status}. Response: ${errorText}`)
    }

    const studiesData = await studiesResponse.json()
    console.log('Studies data received:', { 
      success: studiesData.responseStatus === 'SUCCESS',
      count: studiesData.data?.length || 0,
      firstStudy: studiesData.data?.[0]?.name || 'N/A',
      fullResponse: JSON.stringify(studiesData, null, 2)
    })

    // Process and store study data
    const studyInserts = studiesData.data?.map((study: any) => ({
      configuration_id: configurationId,
      study_id: study.id,
      study_name: study.name,
      phase: study.study_phase__c,
      status: study.study_status__c,
      data: study,
      last_updated: new Date().toISOString()
    })) || []

    if (studyInserts.length > 0) {
      // Upsert study data
      const { error: studyError } = await supabaseClient
        .from('study_data')
        .upsert(studyInserts, {
          onConflict: 'configuration_id, study_id'
        })

      if (studyError) {
        console.error('Error upserting study data:', studyError)
      }
    }

    // Fetch milestones for each study
    const milestoneInserts = []
    
    for (const study of studiesData.data || []) {
      console.log(`Fetching milestones for study: ${study.name} (${study.id})`)
      
      // Fetch study milestones - Updated API endpoint
      const milestonesApiUrl = `${veevaUrl}/api/v24.3/objects/study_milestone__v?where=study__v='${study.id}'`
      console.log('Fetching study milestones from:', milestonesApiUrl)
      
      const milestonesResponse = await fetch(milestonesApiUrl, {
          method: 'GET',
          headers: {
            'Authorization': sessionId,
            'Accept': 'application/json',
          },
        }
      )

      if (milestonesResponse.ok) {
        const milestonesData = await milestonesResponse.json()
        
        const studyMilestones = milestonesData.data?.map((milestone: any) => ({
          configuration_id: configurationId,
          study_id: study.id,
          milestone_type: 'study',
          title: milestone.milestone_name__c,
          status: milestone.milestone_status__c,
          due_date: milestone.planned_date__c,
          planned_finish_date: milestone.planned_finish_date__c,
          baseline_finish_date: milestone.baseline_finish_date__c,
          actual_finish_date: milestone.actual_finish_date__c,
          progress: milestone.completion_percentage__c || 0,
          assigned_to: milestone.assigned_to__c,
          priority: milestone.priority__c || 'medium',
          data: milestone,
          last_updated: new Date().toISOString()
        })) || []

        milestoneInserts.push(...studyMilestones)
      }

      // Fetch site milestones - Updated API endpoint
      const siteMilestonesApiUrl = `${veevaUrl}/api/v24.3/objects/site_milestone__v?where=study__v='${study.id}'`
      console.log('Fetching site milestones from:', siteMilestonesApiUrl)
      
      const siteMilestonesResponse = await fetch(siteMilestonesApiUrl, {
          method: 'GET',
          headers: {
            'Authorization': sessionId,
            'Accept': 'application/json',
          },
        }
      )

      if (siteMilestonesResponse.ok) {
        const siteMilestonesData = await siteMilestonesResponse.json()
        
        const siteMilestones = siteMilestonesData.data?.map((milestone: any) => ({
          configuration_id: configurationId,
          study_id: study.id,
          site_id: milestone.site__c,
          milestone_type: 'site',
          title: milestone.milestone_name__c,
          status: milestone.milestone_status__c,
          due_date: milestone.planned_date__c,
          planned_finish_date: milestone.planned_finish_date__c,
          baseline_finish_date: milestone.baseline_finish_date__c,
          actual_finish_date: milestone.actual_finish_date__c,
          progress: milestone.completion_percentage__c || 0,
          assigned_to: milestone.assigned_to__c,
          priority: milestone.priority__c || 'medium',
          data: milestone,
          last_updated: new Date().toISOString()
        })) || []

        milestoneInserts.push(...siteMilestones)
      }
    }

    // Upsert milestone data
    if (milestoneInserts.length > 0) {
      const { error: milestoneError } = await supabaseClient
        .from('milestone_data')
        .upsert(milestoneInserts, {
          onConflict: 'configuration_id, study_id, site_id, title'
        })

      if (milestoneError) {
        console.error('Error upserting milestone data:', milestoneError)
      }
    }

    // Update last sync time
    await supabaseClient
      .from('veeva_configurations')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', configurationId)

    return new Response(
      JSON.stringify({
        success: true,
        studiesCount: studyInserts.length,
        milestonesCount: milestoneInserts.length,
        message: 'Data synchronization completed successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Veeva sync error:', error)
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