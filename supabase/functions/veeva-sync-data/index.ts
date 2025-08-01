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
    const { configurationId } = await req.json()

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

    // Get configuration and active session
    const { data: config, error: configError } = await supabaseClient
      .from('veeva_configurations')
      .select(`
        *,
        veeva_sessions!inner(session_id, expires_at, is_active)
      `)
      .eq('id', configurationId)
      .eq('user_id', user.id)
      .eq('veeva_sessions.is_active', true)
      .gte('veeva_sessions.expires_at', new Date().toISOString())
      .single()

    if (configError || !config) {
      throw new Error('No active session found for this configuration')
    }

    const sessionId = config.veeva_sessions[0].session_id
    const veevaUrl = config.veeva_url

    // Fetch studies from Veeva CTMS
    const studiesResponse = await fetch(`${veevaUrl}/api/v1/objects/clinical_study__c`, {
      method: 'GET',
      headers: {
        'Authorization': sessionId,
        'Accept': 'application/json',
      },
    })

    if (!studiesResponse.ok) {
      throw new Error(`Failed to fetch studies: ${studiesResponse.statusText}`)
    }

    const studiesData = await studiesResponse.json()

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
      // Fetch study milestones
      const milestonesResponse = await fetch(
        `${veevaUrl}/api/v1/objects/study_milestone__c?where=study__c='${study.id}'`,
        {
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

      // Fetch site milestones
      const siteMilestonesResponse = await fetch(
        `${veevaUrl}/api/v1/objects/site_milestone__c?where=study__c='${study.id}'`,
        {
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