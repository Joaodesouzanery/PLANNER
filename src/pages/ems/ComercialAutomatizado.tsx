import { useState, useRef, useEffect } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, User, Bot, Copy, Check, Linkedin, FileText, Loader2, Wand2, Trash2, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PlaybookContent } from "@/components/ems/comercial/PlaybookContent";

type Role = "user" | "assistant";
interface Msg { role: Role; content: string; }

const PRESETS_LINKEDIN = [
  { id: "connection", label: "Pedido de Conexão", icon: "🤝" },
  { id: "followup1", label: "Follow-up 1 (Value)", icon: "💡" },
  { id: "followup2", label: "Follow-up 2 (Case)", icon: "📊" },
  { id: "followup3", label: "Follow-up 3 (Soft CTA)", icon: "🎯" },
];

const PRESETS_POST = [
  { id: "case", label: "Estudo de Caso", icon: "📈" },
  { id: "insight", label: "Insight de Mercado", icon: "🔍" },
  { id: "tutorial", label: "Tutorial", icon: "📚" },
  { id: "opinion", label: "Artigo de Opinião", icon: "💬" },
];

const ComercialAutomatizado = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"linkedin" | "post" | "chat" | "playbook">("playbook");

  // LinkedIn outreach form
  const [msgType, setMsgType] = useState<string>("connection");
  const [leadProfile, setLeadProfile] = useState("");
  const [painPoint, setPainPoint] = useState("");

  // Post form
  const [postTheme, setPostTheme] = useState("");
  const [postFormat, setPostFormat] = useState<string>("case");
  const [postStyle, setPostStyle] = useState("Didático e provocativo");

  // Chat livre
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);

  const [isStreaming, setIsStreaming] = useState(false);
  const [output, setOutput] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const callAI = async (userMessages: Msg[], onDelta: (chunk: string) => void) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-comercial`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: userMessages }),
    });

    if (resp.status === 429) {
      throw new Error("Limite de requisições atingido. Aguarde um momento.");
    }
    if (resp.status === 402) {
      throw new Error("Créditos de IA esgotados. Adicione mais em Settings → Workspace → Usage.");
    }
    if (!resp.ok || !resp.body) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Erro ao conectar com IA: ${txt || resp.status}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done = false;

    while (!done) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") { done = true; break; }
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }
  };

  const handleGenerateLinkedIn = async () => {
    if (!leadProfile.trim()) {
      toast({ title: "Informe o perfil do lead", variant: "destructive" });
      return;
    }
    const typeLabel = PRESETS_LINKEDIN.find(p => p.id === msgType)?.label || msgType;
    const prompt = `Gere uma mensagem de LinkedIn do tipo: **${typeLabel}**.

**Perfil do Lead:**
${leadProfile}

${painPoint.trim() ? `**Ponto de Dor Identificado:**\n${painPoint}` : ""}

Siga rigorosamente o formato em markdown definido no system prompt.`;

    setIsStreaming(true);
    setOutput("");
    try {
      let acc = "";
      await callAI([{ role: "user", content: prompt }], (chunk) => {
        acc += chunk;
        setOutput(acc);
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleGeneratePost = async () => {
    if (!postTheme.trim()) {
      toast({ title: "Informe o tema/dor", variant: "destructive" });
      return;
    }
    const fmtLabel = PRESETS_POST.find(p => p.id === postFormat)?.label || postFormat;
    const prompt = `Gere um post para LinkedIn da Atlântico ConstruData.

**Tema/Dor:** ${postTheme}
**Formato Desejado:** ${fmtLabel}
**Estilo:** ${postStyle}

Siga rigorosamente o formato em markdown definido no system prompt.`;

    setIsStreaming(true);
    setOutput("");
    try {
      let acc = "";
      await callAI([{ role: "user", content: prompt }], (chunk) => {
        acc += chunk;
        setOutput(acc);
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || isStreaming) return;
    const userMsg: Msg = { role: "user", content: chatInput };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setChatInput("");
    setIsStreaming(true);

    try {
      let acc = "";
      setMessages([...newMessages, { role: "assistant", content: "" }]);
      await callAI(newMessages, (chunk) => {
        acc += chunk;
        setMessages([...newMessages, { role: "assistant", content: acc }]);
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
      setMessages(newMessages);
    } finally {
      setIsStreaming(false);
    }
  };

  const copyToClipboard = (text: string, idx: number = -1) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast({ title: "Copiado para a área de transferência!" });
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <EMSLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold">Comercial Automatizado</h1>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">IA</Badge>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              Claude Comercial · SDR & Copywriter para Atlântico ConstruData
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setOutput(""); }}>
          <TabsList className="grid grid-cols-4 w-full md:w-auto">
            <TabsTrigger value="playbook" className="gap-2">
              <BookOpen className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Playbook</span>
            </TabsTrigger>
            <TabsTrigger value="linkedin" className="gap-2">
              <Linkedin className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Outreach</span>
            </TabsTrigger>
            <TabsTrigger value="post" className="gap-2">
              <FileText className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Posts</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2">
              <Bot className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
          </TabsList>

          {/* PLAYBOOK */}
          <TabsContent value="playbook" className="mt-4">
            <PlaybookContent />
          </TabsContent>

          {/* LINKEDIN OUTREACH */}
          <TabsContent value="linkedin" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-primary" /> Gerar Mensagem
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Tipo de Mensagem</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      {PRESETS_LINKEDIN.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setMsgType(p.id)}
                          className={cn(
                            "text-xs p-2 rounded-lg border transition-all text-left",
                            msgType === p.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/40"
                          )}
                        >
                          <span className="mr-1">{p.icon}</span> {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Perfil do Lead *</Label>
                    <Textarea
                      value={leadProfile}
                      onChange={(e) => setLeadProfile(e.target.value)}
                      placeholder="Ex: Nome: João Silva; Cargo: Diretor de Engenharia na Construtora XYZ; Posts recentes sobre BIM 5D; Interesses em tecnologias para infraestrutura..."
                      rows={5}
                      className="mt-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ponto de Dor (opcional)</Label>
                    <Input
                      value={painPoint}
                      onChange={(e) => setPainPoint(e.target.value)}
                      placeholder="Ex: Dificuldade com RDO em papel"
                      className="mt-1.5 text-sm"
                    />
                  </div>
                  <Button
                    onClick={handleGenerateLinkedIn}
                    disabled={isStreaming}
                    className="w-full gap-2"
                  >
                    {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isStreaming ? "Gerando..." : "Gerar com IA"}
                  </Button>
                </CardContent>
              </Card>

              <OutputCard output={output} isStreaming={isStreaming} onCopy={(t) => copyToClipboard(t, 0)} copied={copiedIdx === 0} />
            </div>
          </TabsContent>

          {/* POSTS */}
          <TabsContent value="post" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-primary" /> Gerar Post
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Tema / Dor *</Label>
                    <Textarea
                      value={postTheme}
                      onChange={(e) => setPostTheme(e.target.value)}
                      placeholder="Ex: Como o Three-Way Match elimina divergências entre PO, GRN e Nota Fiscal em obras de infraestrutura"
                      rows={3}
                      className="mt-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Formato</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      {PRESETS_POST.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPostFormat(p.id)}
                          className={cn(
                            "text-xs p-2 rounded-lg border transition-all text-left",
                            postFormat === p.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/40"
                          )}
                        >
                          <span className="mr-1">{p.icon}</span> {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Estilo</Label>
                    <Select value={postStyle} onValueChange={setPostStyle}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Formal e técnico">Formal e técnico</SelectItem>
                        <SelectItem value="Didático e provocativo">Didático e provocativo</SelectItem>
                        <SelectItem value="Inspirador">Inspirador</SelectItem>
                        <SelectItem value="Storytelling">Storytelling</SelectItem>
                        <SelectItem value="Direto e analítico">Direto e analítico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleGeneratePost}
                    disabled={isStreaming}
                    className="w-full gap-2"
                  >
                    {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isStreaming ? "Gerando..." : "Gerar Post"}
                  </Button>
                </CardContent>
              </Card>

              <OutputCard output={output} isStreaming={isStreaming} onCopy={(t) => copyToClipboard(t, 0)} copied={copiedIdx === 0} />
            </div>
          </TabsContent>

          {/* FREE CHAT */}
          <TabsContent value="chat" className="mt-4">
            <Card className="h-[calc(100vh-280px)] min-h-[500px] flex flex-col">
              <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" /> Chat com Claude Comercial
                </CardTitle>
                {messages.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="h-7 text-xs gap-1">
                    <Trash2 className="h-3 w-3" /> Limpar
                  </Button>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {messages.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>Pergunte qualquer coisa sobre estratégia comercial, ICP, copywriting, objeções...</p>
                    </div>
                  )}
                  <AnimatePresence>
                    {messages.map((m, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
                      >
                        {m.role === "assistant" && (
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Bot className="h-3.5 w-3.5 text-primary" />
                          </div>
                        )}
                        <div className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-2 text-sm relative group",
                          m.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}>
                          {m.role === "assistant" ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:my-2">
                              <ReactMarkdown>{m.content || "..."}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          )}
                          {m.role === "assistant" && m.content && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background border"
                              onClick={() => copyToClipboard(m.content, i)}
                            >
                              {copiedIdx === i ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          )}
                        </div>
                        {m.role === "user" && (
                          <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                            <User className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <div ref={chatEndRef} />
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChat();
                      }
                    }}
                    placeholder="Pergunte algo..."
                    rows={2}
                    className="resize-none text-sm"
                    disabled={isStreaming}
                  />
                  <Button
                    onClick={handleSendChat}
                    disabled={isStreaming || !chatInput.trim()}
                    size="icon"
                    className="h-auto"
                  >
                    {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </EMSLayout>
  );
};

const OutputCard = ({ output, isStreaming, onCopy, copied }: { output: string; isStreaming: boolean; onCopy: (t: string) => void; copied: boolean }) => (
  <Card className="border-primary/20">
    <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
      <CardTitle className="text-sm flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" /> Resultado
        {isStreaming && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
      </CardTitle>
      {output && (
        <Button variant="outline" size="sm" onClick={() => onCopy(output)} className="h-7 text-xs gap-1">
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      )}
    </CardHeader>
    <CardContent>
      {!output && !isStreaming && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Preencha o formulário e clique em <strong>Gerar com IA</strong></p>
        </div>
      )}
      {(output || isStreaming) && (
        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-3 prose-headings:mb-1.5 prose-p:my-1.5 prose-blockquote:border-l-primary prose-blockquote:not-italic">
          <ReactMarkdown>{output || "Pensando..."}</ReactMarkdown>
        </div>
      )}
    </CardContent>
  </Card>
);

export default ComercialAutomatizado;
