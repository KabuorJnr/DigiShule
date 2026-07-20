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
    
    // Extract receipt number from metadata if successful
    let receiptNumber = null
    if (resultCode === 0 && result.CallbackMetadata?.Item) {
      const receiptItem = result.CallbackMetadata.Item.find((i: any) => i.Name === 'MpesaReceiptNumber')
      if (receiptItem) {
        receiptNumber = receiptItem.Value
      }
    }

    // Initialize Supabase Admin Client to bypass RLS for webhook
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const status = resultCode === 0 ? 'Completed' : 'Failed'

    // 1. Update the transaction record
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
      return new Response('OK', { status: 200 }) // Return OK to Safaricom anyway
    }

    // 2. If successful, record the payment and update the invoice
    if (resultCode === 0 && tx && tx.invoice_id) {
      // Create payment record
      await supabase.from('financePayments').insert({
        invoice_id: tx.invoice_id,
        amount: tx.amount,
        method: 'M-Pesa',
        reference: receiptNumber || checkoutRequestId,
        status: 'completed',
        school_id: tx.school_id,
        student_id: tx.student_id,
        date: new Date().toISOString()
      })

      // Fetch current invoice balance
      const { data: invoice } = await supabase.from('invoices').select('amount, balance, status').eq('id', tx.invoice_id).single()
      if (invoice) {
        const newBalance = Math.max(0, invoice.balance - tx.amount)
        const newStatus = newBalance === 0 ? 'paid' : 'partial'
        await supabase.from('invoices').update({ balance: newBalance, status: newStatus }).eq('id', tx.invoice_id)
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
