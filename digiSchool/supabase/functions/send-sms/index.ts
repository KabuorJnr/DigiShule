import "@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default {
  async fetch(req: Request) {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      const { recipients, message } = await req.json();

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No valid recipients provided.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      if (!message) {
        return new Response(
          JSON.stringify({ error: 'Message content is required.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Format recipients to E.164 (+254...)
      const formattedRecipients = recipients
        .map(phone => {
          let cleaned = String(phone).replace(/\D/g, '');
          if (cleaned.startsWith('0')) {
            cleaned = '254' + cleaned.substring(1);
          } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
            cleaned = '254' + cleaned;
          }
          if (!cleaned.startsWith('+')) {
            cleaned = '+' + cleaned;
          }
          return cleaned;
        })
        .filter(phone => phone.length >= 10) // Basic validation
        .join(',');

      if (!formattedRecipients) {
        return new Response(
          JSON.stringify({ error: 'No valid phone numbers found after formatting.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const API_KEY = Deno.env.get('AFRICAS_TALKING_API_KEY');
      const USERNAME = 'sandbox'; // Hardcoded for sandbox

      if (!API_KEY) {
        throw new Error('AFRICAS_TALKING_API_KEY is not set in environment variables.');
      }

      const url = 'https://api.sandbox.africastalking.com/version1/messaging';
      const body = new URLSearchParams({
        username: USERNAME,
        to: formattedRecipients,
        message: message,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'apiKey': API_KEY,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const result = await response.json();

      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  },
};
