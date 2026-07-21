import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

serve(async (req) => {
  try {
    const payload = await req.json()
    console.log('M-Pesa Callback Received:', JSON.stringify(payload, null, 2))

    const result = payload?.Body?.stkCallback
    if (!result) {
      return new Response('Invalid payload', { status: 400 })
    }

    const checkoutRequestId = result.CheckoutRequestID
    const resultCode = result.ResultCode
    const resultDesc = result.ResultDesc
    
    // Extract metadata from callback
    let receiptNumber = null
    let paidAmount = 0
    let transactionDate = null
    let phoneNumber = null

    if (resultCode === 0 && result.CallbackMetadata?.Item) {
      for (const item of result.CallbackMetadata.Item) {
        if (item.Name === 'MpesaReceiptNumber') receiptNumber = item.Value
        if (item.Name === 'Amount') paidAmount = item.Value
        if (item.Name === 'TransactionDate') transactionDate = String(item.Value)
        if (item.Name === 'PhoneNumber') phoneNumber = String(item.Value)
      }
    }

    // Initialize Supabase Admin Client to bypass RLS for webhook
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const status = resultCode === 0 ? 'Completed' : 'Failed'

    // 1. Update the mpesa_transactions record
    const { data: tx, error: updateError } = await supabase
      .from('mpesa_transactions')
      .update({ 
        status, 
        result_desc: resultDesc,
        mpesa_receipt_number: receiptNumber,
        updated_at: new Date().toISOString()
      })
      .eq('checkout_request_id', checkoutRequestId)
      .select('*')
      .single()

    if (updateError) {
      console.error('Failed to update transaction:', updateError)
      return new Response('OK', { status: 200 })
    }

    // 2. If payment was successful, auto-confirm it immediately (STK pushes are automated, no manual verification needed)
    if (resultCode === 0 && tx) {
      const paymentDate = new Date().toISOString()

      // Insert into financePayments as already Verified (STK push = automated confirmation)
      const paymentRecord = {
        id: `mpesa_${Date.now()}`,
        date: paymentDate.slice(0, 10),
        method: 'M-Pesa',
        ref: receiptNumber || checkoutRequestId,
        amount: paidAmount || tx.amount,
        status: 'Verified',
        student_id: tx.student_id || null,
        invoice_id: tx.invoice_id || null,
        school_id: tx.school_id || null,
        adm: null,
        created_at: paymentDate
      }

      // Try to get student adm number if student_id exists
      if (tx.student_id) {
        const { data: student } = await supabase
          .from('students')
          .select('adm')
          .eq('id', tx.student_id)
          .single()
        if (student) paymentRecord.adm = student.adm
      }

      const { error: payInsertErr } = await supabase
        .from('finance_payments')
        .insert(paymentRecord)

      if (payInsertErr) {
        console.error('Failed to insert payment:', payInsertErr)
      }

      // 3. If linked to an invoice, deduct from the invoice balance immediately
      if (tx.invoice_id) {
        const { data: invoice } = await supabase
          .from('invoices')
          .select('amount, balance, status')
          .eq('id', tx.invoice_id)
          .single()

        if (invoice) {
          const newBalance = Math.max(0, (invoice.balance ?? invoice.amount) - (paidAmount || tx.amount))
          const newStatus = newBalance === 0 ? 'paid' : 'partial'
          await supabase
            .from('invoices')
            .update({ balance: newBalance, status: newStatus })
            .eq('id', tx.invoice_id)
        }
      }

      // 4. Trigger receipt generation and SMS notification
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-receipt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            payment_id: paymentRecord.id,
            receipt_number: receiptNumber,
            amount: paidAmount || tx.amount,
            phone_number: phoneNumber || tx.phone_number,
            student_id: tx.student_id,
            invoice_id: tx.invoice_id,
            school_id: tx.school_id,
            date: paymentDate
          })
        })
      } catch (receiptErr) {
        // Don't fail the callback if receipt sending fails
        console.error('Receipt sending error (non-fatal):', receiptErr)
      }
    }

    // Return success to Safaricom
    return new Response(JSON.stringify({
      ResultCode: 0,
      ResultDesc: "Callback processing successful"
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Callback error:', error)
    return new Response('Error processing callback', { status: 500 })
  }
})
