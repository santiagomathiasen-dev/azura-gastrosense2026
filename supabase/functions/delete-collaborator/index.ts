import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RequestBody = {
  collaboratorId: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!url || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Backend não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the token
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: gestorUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !gestorUser) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gestorId = gestorUser.id;
    const admin = createClient(url, serviceRoleKey);

    const body = (await req.json().catch(() => null)) as RequestBody | null;
    if (!body?.collaboratorId) {
      return new Response(JSON.stringify({ error: "ID do colaborador é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Find the collaborator and verify ownership
    const { data: profile, error: findError } = await admin
      .from("profiles")
      .select("id, gestor_id, role")
      .eq("id", body.collaboratorId)
      .eq("role", "colaborador")
      .single();

    if (findError || !profile) {
      return new Response(JSON.stringify({ error: "Colaborador não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.gestor_id !== gestorId) {
      return new Response(JSON.stringify({ error: "Sem permissão para deletar este colaborador" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Delete from collaborators table first
    const { error: collabDeleteError } = await admin
      .from("collaborators")
      .delete()
      .eq("id", body.collaboratorId);

    if (collabDeleteError) {
      console.error("Error deleting collaborator record:", collabDeleteError);
      return new Response(JSON.stringify({ error: "Erro ao deletar registro de colaborador" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Delete the auth user (this will cascade to profiles)
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(profile.id);
    if (deleteUserError) {
      console.error("Error deleting auth user:", deleteUserError);
      // We don't return error here if the record was already deleted from collaborators table
      // as the main goal of the UI was achieved.
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("delete-collaborator error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
