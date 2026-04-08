import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Validate the token and check admin role
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !callerUser) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = callerUser.id;
    const admin = createClient(url, serviceRoleKey);

    // Verify caller is admin
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas administradores." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const urlObj = new URL(req.url);
    const action = urlObj.searchParams.get("action");

    // LIST gestors
    if (req.method === "GET" || action === "list") {
      const { data: profiles, error: profileError } = await admin
        .from("profiles")
        .select("id, email, full_name, role, status_pagamento, created_at")
        .eq("role", "gestor")
        .is("gestor_id", null)
        .order("created_at", { ascending: false });

      if (profileError) {
        console.error("Error listing profiles:", profileError);
        return new Response(JSON.stringify({ error: "Erro ao listar gestores" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch last_sign_in_at for these users from auth.users
      // Since we are using service role, we can do this
      const gestors = await Promise.all((profiles || []).map(async (profile) => {
        const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
        return {
          ...profile,
          last_sign_in_at: userData?.user?.last_sign_in_at || null,
        };
      }));

      return new Response(JSON.stringify({ gestors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST actions
    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body || !body.action) {
        return new Response(JSON.stringify({ error: "Ação inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // CREATE gestor
      if (body.action === "create") {
        const { email, name, password, permissions } = body;

        if (!email || !name || !password) {
          return new Response(JSON.stringify({ error: "Email, nome e senha são obrigatórios" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create auth user
        console.log("Creating auth user for:", email);
        const { data: newUser, error: createError } = await admin.auth.admin.createUser({
          email: email.trim(),
          password,
          email_confirm: true,
          user_metadata: { name: name.trim(), full_name: name.trim() },
        });

        if (createError || !newUser?.user) {
          console.error("Error creating user:", createError);
          const msg = createError?.message?.includes("already been registered")
            ? "Este email já está cadastrado"
            : `Erro ao criar conta: ${createError?.message || 'Erro desconhecido'}`;
          return new Response(JSON.stringify({ error: msg }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log("User created successfully:", newUser.user.id);

        // Update or Insert profile (upsert is safer here in case trigger is slow or absent)
        const { role, ...otherPerms } = permissions || {};
        console.log("Updating profile with permissions:", { role, ...otherPerms });

        const { error: profileError } = await admin
          .from("profiles")
          .upsert({
            id: newUser.user.id,
            email: email.trim(),
            role: role || "gestor",
            status_pagamento: true,
            full_name: name.trim(),
            status: 'ativo',
            ...otherPerms
          });

        if (profileError) {
          console.error("Error updating/upserting profile:", profileError);
          // We don't necessarily want to fail the whole request if only profile update fails,
          // but for a manager it's critical.
          return new Response(JSON.stringify({
            error: "Usuário criado, mas erro ao configurar perfil: " + profileError.message
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: "Gestor criado com sucesso.",
          userId: newUser.user.id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // UPDATE permissions
      if (body.action === "update_permissions") {
        const { gestorId, permissions } = body;
        if (!gestorId || !permissions) {
          return new Response(JSON.stringify({ error: "ID do gestor e permissões são obrigatórios" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await admin
          .from("profiles")
          .update(permissions)
          .eq("id", gestorId);

        if (error) {
          console.error("Error updating permissions:", error);
          return new Response(JSON.stringify({ error: "Erro ao atualizar permissões" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // TOGGLE status (activate/deactivate)
      if (body.action === "toggle_status") {
        const { gestorId, active } = body;
        if (!gestorId) {
          return new Response(JSON.stringify({ error: "ID do gestor é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await admin
          .from("profiles")
          .update({ status: active ? 'ativo' : 'inativo' } as any)
          .eq("id", gestorId);

        if (error) {
          return new Response(JSON.stringify({ error: "Erro ao atualizar status" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // DELETE gestor
      if (body.action === "delete") {
        const { gestorId } = body;
        if (!gestorId) {
          return new Response(JSON.stringify({ error: "ID do gestor é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Don't allow deleting yourself
        if (gestorId === callerId) {
          return new Response(JSON.stringify({ error: "Não é possível excluir sua própria conta" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await admin.auth.admin.deleteUser(gestorId);
        if (error) {
          console.error("Error deleting user:", error);
          return new Response(JSON.stringify({ error: "Erro ao excluir gestor" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("manage-gestors error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
