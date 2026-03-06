-- Commercial Module: Phases, Items, and Per-Contact Tracking

-- Phases (the 7 main sections)
CREATE TABLE IF NOT EXISTS public.commercial_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'target',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on commercial_phases" ON public.commercial_phases FOR ALL USING (true) WITH CHECK (true);

-- Items (deliverables within each phase, supports hierarchy via parent_item_id)
CREATE TABLE IF NOT EXISTS public.commercial_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phase_id UUID NOT NULL REFERENCES public.commercial_phases(id) ON DELETE CASCADE,
  parent_item_id UUID REFERENCES public.commercial_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on commercial_items" ON public.commercial_items FOR ALL USING (true) WITH CHECK (true);

-- Per-contact tracking of each item
CREATE TABLE IF NOT EXISTS public.contact_commercial_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.commercial_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started',
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contact_id, item_id)
);

ALTER TABLE public.contact_commercial_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on contact_commercial_tracking" ON public.contact_commercial_tracking FOR ALL USING (true) WITH CHECK (true);

-- Seed the 7 phases
INSERT INTO public.commercial_phases (title, description, icon, order_index) VALUES
  ('Design da Oferta', 'Desenho da proposta de valor, posicionamento e estrutura da oferta', 'palette', 0),
  ('Suporte ao Discovery', 'Scripts, formulários, análise de dados e relatórios de discovery', 'search', 1),
  ('Processo Comercial Essencial', 'Etapas de qualificação, CRM, cadência, pitch e scripts', 'handshake', 2),
  ('Sistema de Aquisição CAC 0', 'Sales Led Growth, Inbound + FLG, PLG', 'rocket', 3),
  ('Plano de Conteúdo Cascata', 'Estratégia mínima de conteúdo para autoridade e conversas de nicho', 'file-text', 4),
  ('Fundação Digital Mínima', 'Revisão de página/site, trackeamento e presença digital', 'globe', 5),
  ('Trackeamento', 'GA4, PostHog e métricas de acompanhamento', 'bar-chart', 6);

-- Seed items for Phase 1: Design da Oferta
WITH phase AS (SELECT id FROM public.commercial_phases WHERE order_index = 0)
INSERT INTO public.commercial_items (phase_id, title, order_index) VALUES
  ((SELECT id FROM phase), 'Radar de Mercado', 0),
  ((SELECT id FROM phase), 'Diagnóstico Origem', 1),
  ((SELECT id FROM phase), 'Desenho da Proposta de Valor', 2),
  ((SELECT id FROM phase), 'Posicionamento Mínimo Viável', 3),
  ((SELECT id FROM phase), 'Golden Circle', 4),
  ((SELECT id FROM phase), 'Estrutura da Oferta', 5);

-- Sub-items for "Desenho da Proposta de Valor"
WITH parent AS (
  SELECT ci.id FROM public.commercial_items ci
  JOIN public.commercial_phases cp ON ci.phase_id = cp.id
  WHERE cp.order_index = 0 AND ci.title = 'Desenho da Proposta de Valor'
)
INSERT INTO public.commercial_items (phase_id, parent_item_id, title, order_index)
SELECT cp.id, p.id, t.title, t.idx
FROM parent p, public.commercial_phases cp,
(VALUES ('Customer Profiles', 0), ('Problem Statement', 1), ('Value Map', 2)) AS t(title, idx)
WHERE cp.order_index = 0;

-- Seed items for Phase 2: Suporte ao Discovery
WITH phase AS (SELECT id FROM public.commercial_phases WHERE order_index = 1)
INSERT INTO public.commercial_items (phase_id, title, order_index) VALUES
  ((SELECT id FROM phase), 'Script de Discovery', 0),
  ((SELECT id FROM phase), 'Formulários de Captação', 1),
  ((SELECT id FROM phase), 'Análise dos Dados', 2),
  ((SELECT id FROM phase), 'Relatório', 3);

-- Seed items for Phase 3: Processo Comercial Essencial
WITH phase AS (SELECT id FROM public.commercial_phases WHERE order_index = 2)
INSERT INTO public.commercial_items (phase_id, title, order_index) VALUES
  ((SELECT id FROM phase), 'Etapas, critérios de qualificação, rotina e padrões de follow-up', 0),
  ((SELECT id FROM phase), 'Estruturação do CRM (mínima e replicável)', 1),
  ((SELECT id FROM phase), 'Fluxo de Cadência', 2),
  ((SELECT id FROM phase), 'Pitch Modelo (roteiro + narrativa de reunião + apresentação)', 3),
  ((SELECT id FROM phase), 'Scripts prontos (mensagens, convite, follow-up, pedido de indicação)', 4),
  ((SELECT id FROM phase), 'Script de Pré Qualificação', 5),
  ((SELECT id FROM phase), 'Script de Apresentação', 6),
  ((SELECT id FROM phase), 'Script de Venda', 7),
  ((SELECT id FROM phase), 'Acompanhamento Quinzenal de Métricas e KPIs', 8);

-- Seed items for Phase 4: Sistema de Aquisição CAC 0
WITH phase AS (SELECT id FROM public.commercial_phases WHERE order_index = 3)
INSERT INTO public.commercial_items (phase_id, title, order_index) VALUES
  ((SELECT id FROM phase), 'Sales Led Growth', 0),
  ((SELECT id FROM phase), 'Inbound + FLG', 1),
  ((SELECT id FROM phase), 'PLG', 2);

-- Sub-items for Sales Led Growth
WITH parent AS (
  SELECT ci.id FROM public.commercial_items ci
  JOIN public.commercial_phases cp ON ci.phase_id = cp.id
  WHERE cp.order_index = 3 AND ci.title = 'Sales Led Growth'
)
INSERT INTO public.commercial_items (phase_id, parent_item_id, title, order_index)
SELECT cp.id, p.id, t.title, t.idx
FROM parent p, public.commercial_phases cp,
(VALUES ('Prospecção de Rede com Indicações - Funil de Discovery', 0), ('Cold Outreach Automation (LinkedIn + Email)', 1)) AS t(title, idx)
WHERE cp.order_index = 3;

-- Sub-items for Inbound + FLG
WITH parent AS (
  SELECT ci.id FROM public.commercial_items ci
  JOIN public.commercial_phases cp ON ci.phase_id = cp.id
  WHERE cp.order_index = 3 AND ci.title = 'Inbound + FLG'
)
INSERT INTO public.commercial_items (phase_id, parent_item_id, title, order_index)
SELECT cp.id, p.id, t.title, t.idx
FROM parent p, public.commercial_phases cp,
(VALUES ('LinkedIn (publicações, comentários de nicho, comunidades)', 0), ('Search Engine (SEO)', 1), ('Comunidades (Se aplicável)', 2), ('Instagram', 3)) AS t(title, idx)
WHERE cp.order_index = 3;

-- Sub-items for PLG
WITH parent AS (
  SELECT ci.id FROM public.commercial_items ci
  JOIN public.commercial_phases cp ON ci.phase_id = cp.id
  WHERE cp.order_index = 3 AND ci.title = 'PLG'
)
INSERT INTO public.commercial_items (phase_id, parent_item_id, title, order_index)
SELECT cp.id, p.id, t.title, t.idx
FROM parent p, public.commercial_phases cp,
(VALUES ('Estrutura e Fluxo de Onboarding para retenção', 0)) AS t(title, idx)
WHERE cp.order_index = 3;

-- Seed items for Phase 5: Plano de Conteúdo Cascata
WITH phase AS (SELECT id FROM public.commercial_phases WHERE order_index = 4)
INSERT INTO public.commercial_items (phase_id, title, description, order_index) VALUES
  ((SELECT id FROM phase), 'Estratégia mínima de conteúdo', 'Para reforçar autoridade e destravar conversas de nicho (incluso redação, produção gráfica e vídeos)', 0);

-- Seed items for Phase 6: Fundação Digital Mínima
WITH phase AS (SELECT id FROM public.commercial_phases WHERE order_index = 5)
INSERT INTO public.commercial_items (phase_id, title, order_index) VALUES
  ((SELECT id FROM phase), 'Revisão da página/site mínimo alinhado à nova oferta', 0),
  ((SELECT id FROM phase), 'Estrutura de Trackeamento Google Analytics', 1),
  ((SELECT id FROM phase), 'Setup básico de presença e rastreio', 2);

-- Seed items for Phase 7: Trackeamento
WITH phase AS (SELECT id FROM public.commercial_phases WHERE order_index = 6)
INSERT INTO public.commercial_items (phase_id, title, order_index) VALUES
  ((SELECT id FROM phase), 'GA4 - Site', 0),
  ((SELECT id FROM phase), 'PostHog - Produto', 1);
