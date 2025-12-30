import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ContactsTable } from "@/components/admin/ContactsTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Users, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  segment: string;
  challenge: string;
  model: string;
  message: string | null;
}

const Dashboard = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contact_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar contatos",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      title: "Total de Contatos",
      value: contacts.length,
      icon: Mail,
      color: "text-primary",
    },
    {
      title: "Este Mês",
      value: contacts.filter((c) => {
        const date = new Date(c.created_at);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }).length,
      icon: TrendingUp,
      color: "text-secondary",
    },
    {
      title: "Segmentos Únicos",
      value: new Set(contacts.map((c) => c.segment)).size,
      icon: Users,
      color: "text-accent",
    },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
          <p className="text-muted-foreground">
            Visualize e gerencie os contatos recebidos pelo formulário
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contatos Recebidos</CardTitle>
            <CardDescription>
              Lista completa de todos os contatos enviados pelo formulário
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContactsTable contacts={contacts} />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
