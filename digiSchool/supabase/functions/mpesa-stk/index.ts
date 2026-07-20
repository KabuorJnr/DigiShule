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
    const { phone, amount, invoiceId } = await req.json()
    if (!phone || !amount) {
      throw new Error('Phone and amount are required')
    }

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || process?.env?.SUPABASE_URL || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || process?.env?.SUPABASE_ANON_KEY || ''
    
    // We use the service role key to insert into mpesa_transactions securely if needed, but anon works if RLS allows
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })

    // Fetch school config for the shortcode/phone if needed
    // The user requested to extract the number from finance settings.
    const { data: config } = await supabase.from('app_config').select('phone, id').single()
    const schoolId = config?.id
    
    // Sandbox Credentials
    const consumerKey = Deno.env.get('consumer_key') || Deno.env.get('MPESA_CONSUMER_KEY')
    const consumerSecret = Deno.env.get('consumer_secret') || Deno.env.get('MPESA_CONSUMER_SECRET')
    const shortcode = "174379" // Sandbox Paybill
    const passkey = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"
    
    // Format phone: 07XXXXXXXX -> 2547XXXXXXXX
    let formattedPhone = phone.replace(/[^0-9]/g, '')
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1)
    } else if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1)
    }

    // 1. Get Access Token
    const auth = btoa(`${consumerKey}:${consumerSecret}`)
    const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` }
    })
    
    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('M-Pesa Token Error:', err)
      throw new Error('Failed to authenticate with M-Pesa')
    }
    const { access_token } = await tokenRes.json()

    // 2. Prepare STK Push
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
    const password = btoa(`${shortcode}${passkey}${timestamp}`)
    
    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(Number(amount)), // Safaricom requires integer amounts
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

    // 3. Save to database
    if (stkData.ResponseCode === "0") {
      const { error: dbError } = await supabase
        .from('mpesa_transactions')
        .insert({
          checkout_request_id: stkData.CheckoutRequestID,
          merchant_request_id: stkData.MerchantRequestID,
          amount: stkPayload.Amount,
          phone_number: formattedPhone,
          invoice_id: invoiceId || null,
          school_id: schoolId,
          status: 'Pending'
        })
        
      if (dbError) {
        console.error('Database Error:', dbError)
        // We still return success to frontend because STK push was sent
      }
    }

    return new Response(JSON.stringify(stkData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
