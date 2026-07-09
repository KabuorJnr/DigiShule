import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html, text } = await req.json();

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: 'to' and 'subject'" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const user = Deno.env.get("GMAIL_USER");
    const pass = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!user || !pass) {
      throw new Error("Gmail credentials not configured in environment variables.");
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from: `"School Administration" <${user}>`,
      to,
      subject,
      text: text || "Please view this email in an HTML compatible client.",
      html,
    });

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
