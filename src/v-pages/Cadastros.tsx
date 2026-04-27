import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { GestaoGestores } from "@/components/GestaoGestores";
import { GestaoColaboradores } from "@/components/GestaoColaboradores";
import { useUserRole } from "@/hooks/shared/useUserRole";
import { useProfile } from "@/hooks/shared/useProfile";
import { ShieldAlert, Users, Shield } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function Cadastros() {
    const { isAdmin, isGestor, isLoading: roleLoading } = useUserRole();
    const { profile, isLoading: profileLoading } = useProfile();

    if (roleLoading || profileLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const hasAccess = isAdmin || isGestor;

    if (!hasAccess) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
                <h2 className="text-xl font-bold">Acesso Restrito</h2>
                <p className="text-muted-foreground">Você não tem permissão para gerenciar cadastros.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Cadastros e Permissões"
                description="Gerencie as contas de acesso e níveis de permissão do sistema"
            />

            <Tabs defaultValue={isAdmin ? "gestores" : "colaboradores"} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    {isAdmin && (
                        <TabsTrigger value="gestores" className="flex items-center gap-2">
                            <Shield className="h-4 w-4" /> Gestores
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="colaboradores" className="flex items-center gap-2">
                        <Users className="h-4 w-4" /> Colaboradores
                    </TabsTrigger>
                </TabsList>

                {isAdmin && (
                    <TabsContent value="gestores" className="mt-6 border-none p-0 shadow-none">
                        <GestaoGestores />
                    </TabsContent>
                )}

                <TabsContent value="colaboradores" className="mt-6 border-none p-0 shadow-none">
                    <GestaoColaboradores />
                </TabsContent>
            </Tabs>
        </div>
    );
}
