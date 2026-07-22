import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    console.log('KCB Bank Callback Received:', JSON.stringify(payload, null, 2))

    // Example KCB Webhook Payload handling
    // Expected fields based on standard B2B/Biller implementations
    const transactionReference = payload.TransactionReference || payload.receiptNumber || payload.transactionId
    const amount = payload.TransactionAmount || payload.amount || 0
    const billRefNumber = payload.BillRefNumber || payload.accountReference || payload.narrative
    const billerCode = payload.BillerCode || payload.shortCode

    if (!transactionReference || !amount || !billRefNumber) {
      console.warn('Invalid KCB payload structure')
      return new Response('Invalid payload', { status: 400 })
    }

    // Initialize Supabase Admin Client to bypass RLS for webhook
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Verify this school is registered for this Biller Code
    const { data: gateway } = await supabase
      .from('school_payment_gateways')
      .select('school_id')
      .eq('kcb_biller_code', billerCode)
      .single()

    if (!gateway) {
      console.error(`Unrecognized KCB Biller Code: ${billerCode}`)
      return new Response('Unrecognized Biller Code', { status: 404 })
    }

    const schoolId = gateway.school_id

    // 2. Find the student using the BillRefNumber (Admission Number)
    const { data: student } = await supabase
      .from('students')
      .select('id, adm')
      .eq('school_id', schoolId)
      .ilike('adm', billRefNumber)
      .single()

    if (!student) {
      console.error(`No student found for Adm: ${billRefNumber} in school ${schoolId}`)
      // Still return 200 to KCB so they don't retry indefinitely
      return new Response('Student not found, but acknowledged', { status: 200 })
    }

    const paymentDate = new Date().toISOString()

    // 3. Find if the student has an active invoice to offset
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, amount, balance, status')
      .eq('student_id', student.id)
      .eq('status', 'Unpaid')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    // 4. Insert into finance_payments as Verified
    const paymentRecord = {
      id: `kcb_${Date.now()}`,
      date: paymentDate.slice(0, 10),
      method: 'KCB Bank',
      ref: transactionReference,
      amount: amount,
      status: 'Verified',
      student_id: student.id,
      invoice_id: invoice ? invoice.id : null,
      school_id: schoolId,
      adm: student.adm,
      created_at: paymentDate
    }

    const { error: payInsertErr } = await supabase
      .from('finance_payments')
      .insert(paymentRecord)

    if (payInsertErr) {
      console.error('Failed to insert KCB payment:', payInsertErr)
      return new Response('Database error', { status: 500 })
    }

    // 5. Offset Invoice Balance if applicable
    if (invoice) {
      const newBalance = Math.max(0, invoice.balance - amount)
      const newStatus = newBalance === 0 ? 'Paid' : 'Partial'

      const { error: invoiceErr } = await supabase
        .from('invoices')
        .update({ balance: newBalance, status: newStatus })
        .eq('id', invoice.id)

      if (invoiceErr) {
        console.error('Failed to update invoice balance:', invoiceErr)
      }
    }

    return new Response(JSON.stringify({ status: 'Success', message: 'Transaction recorded' }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })

  } catch (error) {
    console.error('KCB Webhook Processing Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
})
