import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, amount, invoiceId, studentId } = await req.json()
    if (!phone || !amount) {
      throw new Error('Phone and amount are required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace('Bearer ', '').trim()

    if (!jwt) {
      throw new Error('Authentication failed: Missing Authorization header in request.')
    }

    // 1. Resolve school_id from the authenticated user's profile
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !authUser) {
      console.error('Auth error:', authErr)
      throw new Error(`Authentication failed: ${authErr?.message || 'Invalid user session'}. JWT Length: ${jwt.length}`)
    }

    // Try profile first (staff/parents)
    let schoolId = null

    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', authUser.id)
      .maybeSingle()
    
    schoolId = profile?.school_id

    // Try students table if not found in profiles (students login)
    if (!schoolId) {
      const { data: student } = await supabase
        .from('students')
        .select('school_id')
        .eq('id', authUser.id)
        .maybeSingle()
      schoolId = student?.school_id
    }

    if (!schoolId) {
      // Fallback: try app_config
      const { data: config } = await supabase
        .from('app_config')
        .select('school_id')
        .limit(1)
        .maybeSingle()
      schoolId = config?.school_id
    }
    
    if (!schoolId) {
      throw new Error('Could not identify your school. Please contact the administrator.')
    }

    // 2. Fetch M-Pesa credentials using service role (bypasses RLS)
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: gateway, error: gatewayErr } = await adminSupabase
      .from('school_payment_gateways')
      .select('mpesa_consumer_key, mpesa_consumer_secret, mpesa_shortcode, mpesa_passkey')
      .eq('school_id', schoolId)
      .single()

    if (gatewayErr || !gateway) {
      console.error('Gateway lookup error:', gatewayErr)
      throw new Error('M-Pesa payment gateway is not configured for this school. Please ask your Bursar to set up credentials in System Settings.')
    }

    const consumerKey = gateway.mpesa_consumer_key.trim()
    const consumerSecret = gateway.mpesa_consumer_secret.trim()
    const shortcode = gateway.mpesa_shortcode.trim()
    const passkey = gateway.mpesa_passkey.trim()
    
    // 3. Format phone: 07XXXXXXXX -> 2547XXXXXXXX
    let formattedPhone = phone.replace(/[^0-9]/g, '')
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1)
    } else if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1)
    }

    // 4. Get Access Token from Safaricom
    const auth = btoa(`${consumerKey}:${consumerSecret}`)
    const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` }
    })
    
    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('M-Pesa Token Error:', err)
      throw new Error('Failed to authenticate with M-Pesa. Please check your API credentials.')
    }
    const { access_token } = await tokenRes.json()

    // 5. Prepare STK Push
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
    const password = btoa(`${shortcode}${passkey}${timestamp}`)
    
    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(Number(amount)),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${supabaseUrl}/functions/v1/mpesa-callback`,
      AccountReference: invoiceId ? invoiceId.substring(0, 12) : 'Fees Payment',
      TransactionDesc: 'Payment for School Fees'
    }

    const stkRes = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stkPayload)
    })

    const stkData = await stkRes.json()
    if (stkData.errorMessage) {
      throw new Error(stkData.errorMessage)
    }

    // 6. Save to database
    if (stkData.ResponseCode === "0") {
      const { error: dbError } = await supabase
        .from('mpesa_transactions')
        .insert({
          checkout_request_id: stkData.CheckoutRequestID,
          merchant_request_id: stkData.MerchantRequestID,
          amount: stkPayload.Amount,
          phone_number: formattedPhone,
          invoice_id: invoiceId || null,
          student_id: studentId || null,
          school_id: schoolId,
          status: 'Pending'
        })
        
      if (dbError) {
        console.error('Database Error:', dbError)
        // Still return success — STK push was sent
      }
    }

    return new Response(JSON.stringify(stkData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('mpesa-stk error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

