import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RequestBody = {
  name: string;
  email: string;
  password?: string;
  pin?: string;
  permissions: {
    can_access_dashboard: boolean;
    can_access_estoque: boolean;
    can_access_estoque_producao: boolean;
    can_access_fichas: boolean;
    can_access_producao: boolean;
    can_access_compras: boolean;
    can_access_finalizados: boolean;
    can_access_produtos_venda: boolean;
    can_access_financeiro?: boolean;
    can_access_relatorios?: boolean;
  };
};

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "azura_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generatePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  for (let i = 0; i < 24; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

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
    if (!body) {
      return new Response(JSON.stringify({ error: "Corpo inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, email, password, pin, permissions } = body;

    console.log(`Creating collaborator: ${name} (${email}) for gestor ${gestorId}`);

    if (!name || name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Nome inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Create a Supabase Auth user for the collaborator
    const collabPassword = password || generatePassword();

    const { data: newUser, error: createUserError } = await admin.auth.admin.createUser({
      email: email,
      password: collabPassword,
      email_confirm: true, // Auto-confirm
      user_metadata: {
        full_name: name,
        is_collaborator: true,
        gestor_id: gestorId,
      },
    });

    if (createUserError || !newUser?.user) {
      console.error("Error creating auth user:", createUserError);
      return new Response(JSON.stringify({ error: createUserError?.message || "Erro ao criar usuário" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Auth user created:", newUser.user.id);

    // 2) Update/Upsert the profile
    const hashedPin = pin ? await hashPin(pin) : null;
    const { data: collaborator, error: profileError } = await admin
      .from("profiles")
      .upsert({
        id: newUser.user.id,
        email: email,
        gestor_id: (permissions as any)?.role === 'gestor' || (permissions as any)?.role === 'admin' ? null : gestorId,
        full_name: name,
        role: (permissions as any)?.role || 'colaborador',
        pin_hash: hashedPin,
        ...permissions,
        status: 'ativo'
      })
      .select()
      .single();

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Cleanup: delete the created user
      await admin.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: "Erro ao configurar perfil" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ collaborator }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("create-collaborator error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
