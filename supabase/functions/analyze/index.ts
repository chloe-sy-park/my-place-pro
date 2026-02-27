import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DAILY_LIMIT = 10;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt, installID } = await req.json();
    if (!prompt || !installID) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Connect to Supabase (uses built-in env vars)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check daily usage
    const today = new Date().toISOString().split("T")[0];
    const { count } = await supabase
      .from("usage_log")
      .select("*", { count: "exact", head: true })
      .eq("install_id", installID)
      .gte("created_at", `${today}T00:00:00Z`);

    if ((count ?? 0) >= DAILY_LIMIT) {
      return new Response(JSON.stringify({ error: "limit_reached" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Gemini API
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "server_config_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                summary: { type: "STRING" },
                category: { type: "STRING" },
                tags: { type: "ARRAY", items: { type: "STRING" } },
                board: { type: "STRING" },
              },
            },
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      return new Response(JSON.stringify({ error: "ai_failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiJson = await geminiRes.json();
    const result = JSON.parse(geminiJson.candidates[0].content.parts[0].text);

    // Log usage
    await supabase.from("usage_log").insert({ install_id: installID });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_) {
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
