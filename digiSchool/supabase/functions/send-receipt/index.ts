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
    const {
      payment_id,
      receipt_number,
      amount,
      phone_number,
      student_id,
      invoice_id,
      school_id,
      date
    } = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ── 1. Fetch student details ──
    let studentName = 'Student'
    let studentAdm = 'N/A'
    let studentClass = 'N/A'

    if (student_id) {
      const { data: student } = await supabase
        .from('students')
        .select('name, adm, class')
        .eq('id', student_id)
        .single()

      if (student) {
        studentName = student.name || studentName
        studentAdm = student.adm || studentAdm
        studentClass = student.class || studentClass
      }
    }

    // ── 2. Fetch parent details (linked to the student) ──
    let parentName = 'Parent/Guardian'
    let parentPhone = phone_number || null
    let parentEmail = null

    if (student_id) {
      // Look for parent profile linked to the student
      const { data: parentProfiles } = await supabase
        .from('profiles')
        .select('full_name, username, phone')
        .eq('role', 'parent')

      if (parentProfiles && parentProfiles.length > 0) {
        // Try to find a parent whose linked student matches
        const { data: linkedParents } = await supabase
          .from('parent_students')
          .select('parent_id')
          .eq('student_id', student_id)

        if (linkedParents && linkedParents.length > 0) {
          const parentId = linkedParents[0].parent_id
          const { data: parentProfile } = await supabase
            .from('profiles')
            .select('full_name, username, phone')
            .eq('id', parentId)
            .single()

          if (parentProfile) {
            parentName = parentProfile.full_name || parentName
            parentPhone = parentProfile.phone || parentPhone
            parentEmail = parentProfile.username || null
          }
        }
      }
    }

    // ── 3. Fetch school details ──
    let schoolName = 'DigiShule School'

    if (school_id) {
      const { data: school } = await supabase
        .from('schools')
        .select('name')
        .eq('id', school_id)
        .single()

      if (school) schoolName = school.name || schoolName
    }

    // ── 4. Fetch invoice details if linked ──
    let invoiceNumber = null
    if (invoice_id) {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('id, amount, balance')
        .eq('id', invoice_id)
        .single()

      if (invoice) {
        invoiceNumber = invoice_id
      }
    }

    // ── 5. Format the receipt ──
    const fmtKES = (n: number) => 'KES ' + Number(n || 0).toLocaleString('en-KE')
    const receiptDate = date ? new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : new Date().toLocaleDateString('en-KE')

    const smsMessage = [
      `PAYMENT RECEIPT - ${schoolName}`,
      `Student: ${studentName} (${studentAdm})`,
      `Amount: ${fmtKES(amount)}`,
      `M-Pesa Ref: ${receipt_number || 'N/A'}`,
      invoiceNumber ? `Invoice: ${invoiceNumber}` : null,
      `Date: ${receiptDate}`,
      `Status: CONFIRMED`,
      `Thank you for your payment.`
    ].filter(Boolean).join('\n')

    // ── 6. Send SMS via Africa's Talking ──
    const atUsername = Deno.env.get('AT_USERNAME') || ''
    const atApiKey = Deno.env.get('AT_API_KEY') || ''

    if (parentPhone && atUsername && atApiKey) {
      // Format phone for AT: ensure it starts with +254
      let formattedPhone = parentPhone.replace(/[^0-9]/g, '')
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+254' + formattedPhone.substring(1)
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone
      }

      const atEndpoint = atUsername === 'sandbox'
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging'

      const smsBody = new URLSearchParams({
        username: atUsername,
        to: formattedPhone,
        message: smsMessage,
      })

      try {
        const smsRes = await fetch(atEndpoint, {
          method: 'POST',
          headers: {
            'apiKey': atApiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: smsBody.toString()
        })

        const smsResult = await smsRes.json()
        console.log('Africa\'s Talking SMS result:', JSON.stringify(smsResult))
      } catch (smsErr) {
        console.error('SMS send error:', smsErr)
      }
    } else {
      console.warn('SMS not sent: missing phone or AT credentials. Phone:', parentPhone, 'AT_USERNAME:', atUsername ? 'set' : 'missing')
    }

    // ── 7. Also send email receipt via Resend if available ──
    const resendKey = Deno.env.get('RESEND_API_KEY') || ''

    if (parentEmail && resendKey) {
      try {
        const emailHtml = `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
            <div style="background: linear-gradient(135deg, #047857, #065f46); padding: 32px; border-radius: 12px 12px 0 0; text-align: center; color: white;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px;">Payment Receipt</h1>
              <p style="margin: 0; font-size: 14px; opacity: 0.9;">${schoolName}</p>
            </div>
            <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none;">
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <div style="font-size: 28px; font-weight: 700; color: #047857;">${fmtKES(amount)}</div>
                <div style="font-size: 13px; color: #166534; margin-top: 4px;">Payment Confirmed</div>
              </div>
              
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 10px 0; color: #6b7280;">Student</td>
                  <td style="padding: 10px 0; font-weight: 600; text-align: right;">${studentName} (${studentAdm})</td>
                </tr>
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 10px 0; color: #6b7280;">Class</td>
                  <td style="padding: 10px 0; font-weight: 600; text-align: right;">${studentClass}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 10px 0; color: #6b7280;">M-Pesa Reference</td>
                  <td style="padding: 10px 0; font-weight: 600; text-align: right; font-family: monospace;">${receipt_number || 'N/A'}</td>
                </tr>
                ${invoiceNumber ? `
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 10px 0; color: #6b7280;">Invoice Number</td>
                  <td style="padding: 10px 0; font-weight: 600; text-align: right;">${invoiceNumber}</td>
                </tr>
                ` : ''}
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 10px 0; color: #6b7280;">Date</td>
                  <td style="padding: 10px 0; font-weight: 600; text-align: right;">${receiptDate}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280;">Payment Method</td>
                  <td style="padding: 10px 0; font-weight: 600; text-align: right;">M-Pesa (STK Push)</td>
                </tr>
              </table>
            </div>
            <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">This is an automated receipt from ${schoolName}. Please keep this for your records.</p>
            </div>
          </div>
        `

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: `${schoolName} <onboarding@resend.dev>`,
            to: parentEmail,
            subject: `Payment Receipt - ${fmtKES(amount)} for ${studentName}`,
            html: emailHtml
          })
        })
      } catch (emailErr) {
        console.error('Email send error:', emailErr)
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Receipt sent',
      sms_sent: !!(parentPhone && atUsername && atApiKey),
      email_sent: !!(parentEmail && resendKey)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('send-receipt error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
