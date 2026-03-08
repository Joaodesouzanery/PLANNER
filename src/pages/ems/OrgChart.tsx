import { useState, useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Mail,
  Phone,
  ChevronDown,
  ChevronRight,
  Building,
  User,
  UserCircle,
  Briefcase,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface OrgChartNode {
  id: string;
  name: string;
  position: string;
  department: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  parent_id: string | null;
  order_index: number;
  color: string;
  created_at: string;
  children?: OrgChartNode[];
}

const colorOptions = [
  { value: "primary", label: "Azul", class: "bg-primary" },
  { value: "emerald", label: "Verde", class: "bg-emerald-500" },
  { value: "amber", label: "Amarelo", class: "bg-amber-500" },
  { value: "purple", label: "Roxo", class: "bg-purple-500" },
  { value: "rose", label: "Rosa", class: "bg-rose-500" },
  { value: "cyan", label: "Ciano", class: "bg-cyan-500" },
];

const departmentOptions = [
  "Diretoria",
  "Tecnologia",
  "Comercial",
  "Financeiro",
  "Marketing",
  "RH",
  "Operações",
  "Produto",
  "Suporte",
  "Jurídico",
];

const OrgChart = () => {
  const { toast } = useToast();
  const { selectedCompanyId } = useCompany();
  const [nodes, setNodes] = useState<OrgChartNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNode, setEditingNode] = useState<OrgChartNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"tree" | "grid">("tree");

  const [nodeForm, setNodeForm] = useState({
    name: "",
    position: "",
    department: "",
    email: "",
    phone: "",
    parent_id: "",
    color: "primary",
  });

  useEffect(() => {
    fetchNodes();
  }, [selectedCompanyId]);

  const fetchNodes = async () => {
    let query = supabase.from("org_chart_nodes").select("*").order("order_index");
    if (selectedCompanyId !== "all") query = query.eq("company_id", selectedCompanyId);
    const { data, error } = await query;
    
    if (data) {
      setNodes(data);
      const rootIds = data.filter((n) => !n.parent_id).map((n) => n.id);
      setExpandedNodes(new Set(rootIds));
    }
    setLoading(false);
  };

  const handleSaveNode = async () => {
    if (!nodeForm.name.trim() || !nodeForm.position.trim()) {
      toast({ title: "Erro", description: "Nome e cargo são obrigatórios", variant: "destructive" });
      return;
    }

    const nodeData = {
      name: nodeForm.name,
      position: nodeForm.position,
      department: nodeForm.department || null,
      email: nodeForm.email || null,
      phone: nodeForm.phone || null,
      parent_id: nodeForm.parent_id || null,
      color: nodeForm.color,
    };

    if (editingNode) {
      await supabase.from("org_chart_nodes").update(nodeData).eq("id", editingNode.id);
      toast({ title: "Membro atualizado!" });
    } else {
      await supabase.from("org_chart_nodes").insert(nodeData);
      toast({ title: "Membro adicionado!" });
    }

    resetForm();
    fetchNodes();
  };

  const handleDeleteNode = async (id: string) => {
    // Check for children
    const children = nodes.filter((n) => n.parent_id === id);
    if (children.length > 0) {
      toast({ 
        title: "Atenção", 
        description: "Remova ou realoque os subordinados antes de excluir este membro",
        variant: "destructive" 
      });
      return;
    }

    await supabase.from("org_chart_nodes").delete().eq("id", id);
    toast({ title: "Membro removido" });
    fetchNodes();
  };

  const resetForm = () => {
    setNodeForm({
      name: "",
      position: "",
      department: "",
      email: "",
      phone: "",
      parent_id: "",
      color: "primary",
    });
    setEditingNode(null);
    setShowModal(false);
  };

  const toggleExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const getRootNodes = () => nodes.filter((n) => !n.parent_id);
  const getChildNodes = (parentId: string) => nodes.filter((n) => n.parent_id === parentId);

  const getColorClass = (color: string) => {
    const colorOption = colorOptions.find((c) => c.value === color);
    return colorOption?.class || "bg-primary";
  };

  const stats = {
    total: nodes.length,
    departments: new Set(nodes.map((n) => n.department).filter(Boolean)).size,
    withEmail: nodes.filter((n) => n.email).length,
  };

  const renderTreeNode = (node: OrgChartNode, depth = 0) => {
    const children = getChildNodes(node.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(node.id);

    return (
      <motion.div
        key={node.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="relative"
      >
        {/* Connection lines */}
        {depth > 0 && (
          <div className="absolute left-0 top-0 w-6 h-full">
            <div className="absolute left-0 top-0 w-6 h-8 border-l-2 border-b-2 border-border rounded-bl-lg" />
          </div>
        )}

        <div className={cn("flex items-start", depth > 0 && "ml-6")}>
          <Card className="flex-1 hover:border-primary/30 transition-all">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Expand button */}
                {hasChildren && (
                  <button
                    onClick={() => toggleExpand(node.id)}
                    className="p-1 hover:bg-muted rounded mt-1 flex-shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                )}
                {!hasChildren && <div className="w-6" />}

                {/* Avatar */}
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                  getColorClass(node.color)
                )}>
                  {node.avatar_url ? (
                    <img src={node.avatar_url} alt={node.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-white">
                      {node.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-foreground">{node.name}</h4>
                      <p className="text-sm text-primary">{node.position}</p>
                    </div>
                    {node.department && (
                      <Badge variant="outline" className="flex-shrink-0">
                        {node.department}
                      </Badge>
                    )}
                  </div>

                  {/* Contact */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    {node.email && (
                      <a href={`mailto:${node.email}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                        <Mail className="h-3 w-3" />
                        {node.email}
                      </a>
                    )}
                    {node.phone && (
                      <a href={`tel:${node.phone}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                        <Phone className="h-3 w-3" />
                        {node.phone}
                      </a>
                    )}
                  </div>

                  {/* Subordinates count */}
                  {hasChildren && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <Users className="h-3 w-3 inline mr-1" />
                      {children.length} subordinado{children.length > 1 ? "s" : ""}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setNodeForm({
                        ...nodeForm,
                        parent_id: node.id,
                      });
                      setShowModal(true);
                    }}
                    title="Adicionar subordinado"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditingNode(node);
                      setNodeForm({
                        name: node.name,
                        position: node.position,
                        department: node.department || "",
                        email: node.email || "",
                        phone: node.phone || "",
                        parent_id: node.parent_id || "",
                        color: node.color,
                      });
                      setShowModal(true);
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDeleteNode(node.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Children */}
        <AnimatePresence>
          {isExpanded && hasChildren && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="ml-8 mt-2 space-y-2 border-l-2 border-border pl-4"
            >
              {children.map((child) => renderTreeNode(child, depth + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const renderOrgChartVisual = () => {
    const rootNodes = getRootNodes();
    
    const renderVisualNode = (node: OrgChartNode): React.ReactNode => {
      const children = getChildNodes(node.id);
      
      return (
        <div key={node.id} className="flex flex-col items-center">
          {/* Node card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "relative p-4 rounded-xl border-2 border-border bg-card shadow-lg min-w-[160px] text-center cursor-pointer hover:border-primary/50 transition-all",
            )}
            onClick={() => {
              setEditingNode(node);
              setNodeForm({
                name: node.name,
                position: node.position,
                department: node.department || "",
                email: node.email || "",
                phone: node.phone || "",
                parent_id: node.parent_id || "",
                color: node.color,
              });
              setShowModal(true);
            }}
          >
            {/* Color indicator */}
            <div className={cn("absolute top-0 left-0 right-0 h-1 rounded-t-xl", getColorClass(node.color))} />
            
            {/* Avatar */}
            <div className={cn(
              "w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center",
              getColorClass(node.color)
            )}>
              <span className="text-xl font-bold text-white">
                {node.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </span>
            </div>
            
            <h4 className="font-medium text-sm">{node.name}</h4>
            <p className="text-xs text-primary">{node.position}</p>
            {node.department && (
              <Badge variant="outline" className="mt-2 text-xs">
                {node.department}
              </Badge>
            )}
          </motion.div>

          {/* Children connector and nodes */}
          {children.length > 0 && (
            <>
              {/* Vertical line down */}
              <div className="w-0.5 h-6 bg-border" />
              
              {/* Horizontal line */}
              {children.length > 1 && (
                <div className="relative w-full flex justify-center">
                  <div 
                    className="h-0.5 bg-border" 
                    style={{ 
                      width: `${Math.min(children.length * 180, 800)}px` 
                    }} 
                  />
                </div>
              )}
              
              {/* Children */}
              <div className="flex gap-4 mt-0">
                {children.map((child) => (
                  <div key={child.id} className="flex flex-col items-center">
                    {/* Vertical line up to child */}
                    <div className="w-0.5 h-6 bg-border" />
                    {renderVisualNode(child)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      );
    };

    return (
      <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-8 overflow-x-auto pb-8">
        {rootNodes.map((node) => renderVisualNode(node))}
      </div>
    );
  };

  return (
    <EMSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
              Organograma
            </h1>
            <p className="text-muted-foreground mt-1">
              Estrutura organizacional e hierarquia da equipe
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === "tree" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("tree")}
              >
                Lista
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                Visual
              </Button>
            </div>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Membro
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total de Membros</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Building className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.departments}</p>
                  <p className="text-xs text-muted-foreground">Departamentos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Mail className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.withEmail}</p>
                  <p className="text-xs text-muted-foreground">Com E-mail</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-16 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : nodes.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum membro cadastrado</h3>
              <p className="text-muted-foreground mt-1">
                Comece adicionando os membros da sua organização
              </p>
              <Button className="mt-4" onClick={() => setShowModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Membro
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === "tree" ? (
          <div className="space-y-3">
            {getRootNodes().map((node) => renderTreeNode(node))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-4 sm:p-8 overflow-x-auto">
              {renderOrgChartVisual()}
            </CardContent>
          </Card>
        )}

        {/* Node Modal */}
        <Dialog open={showModal} onOpenChange={(open) => !open && resetForm()}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingNode ? "Editar Membro" : "Adicionar Membro"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium">Nome *</label>
                  <Input
                    value={nodeForm.name}
                    onChange={(e) => setNodeForm({ ...nodeForm, name: e.target.value })}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Cargo *</label>
                  <Input
                    value={nodeForm.position}
                    onChange={(e) => setNodeForm({ ...nodeForm, position: e.target.value })}
                    placeholder="Ex: Diretor de Tecnologia"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Departamento</label>
                  <Select
                    value={nodeForm.department}
                    onValueChange={(v) => setNodeForm({ ...nodeForm, department: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentOptions.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">E-mail</label>
                  <Input
                    type="email"
                    value={nodeForm.email}
                    onChange={(e) => setNodeForm({ ...nodeForm, email: e.target.value })}
                    placeholder="email@empresa.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Telefone</label>
                  <Input
                    value={nodeForm.phone}
                    onChange={(e) => setNodeForm({ ...nodeForm, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Superior Direto</label>
                  <Select
                    value={nodeForm.parent_id || "none"}
                    onValueChange={(v) => setNodeForm({ ...nodeForm, parent_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhum (topo da hierarquia)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (topo da hierarquia)</SelectItem>
                      {nodes
                        .filter((n) => n.id !== editingNode?.id)
                        .map((n) => (
                          <SelectItem key={n.id} value={n.id}>
                            {n.name} - {n.position}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Cor</label>
                  <Select
                    value={nodeForm.color}
                    onValueChange={(v) => setNodeForm({ ...nodeForm, color: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {colorOptions.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div className={cn("w-3 h-3 rounded-full", color.class)} />
                            {color.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveNode}>
                  {editingNode ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EMSLayout>
  );
};

export default OrgChart;
