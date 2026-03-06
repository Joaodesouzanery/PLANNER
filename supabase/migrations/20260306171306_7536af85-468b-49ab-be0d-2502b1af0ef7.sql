
-- Commercial phases table
CREATE TABLE public.commercial_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'target',
  order_index integer NOT NULL DEFAULT 0,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on commercial_phases" ON public.commercial_phases FOR ALL USING (true) WITH CHECK (true);

-- Commercial items table (checklist items within phases)
CREATE TABLE public.commercial_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES public.commercial_phases(id) ON DELETE CASCADE,
  parent_item_id uuid REFERENCES public.commercial_items(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on commercial_items" ON public.commercial_items FOR ALL USING (true) WITH CHECK (true);

-- Tracking table (per contact, per item)
CREATE TABLE public.contact_commercial_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.commercial_items(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started',
  notes text,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contact_id, item_id)
);

ALTER TABLE public.contact_commercial_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on contact_commercial_tracking" ON public.contact_commercial_tracking FOR ALL USING (true) WITH CHECK (true);

-- Seed default commercial phases
INSERT INTO public.commercial_phases (title, description, icon, order_index) VALUES
  ('Prospecção & Qualificação', 'Identificar e qualificar potenciais clientes', 'search', 0),
  ('Apresentação & Proposta', 'Apresentar soluções e elaborar propostas', 'palette', 1),
  ('Negociação', 'Negociar termos, prazos e valores', 'handshake', 2),
  ('Fechamento', 'Finalizar contrato e iniciar onboarding', 'rocket', 3),
  ('Documentação', 'Preparar documentação e contratos', 'file-text', 4),
  ('Go-Live & Suporte', 'Entrega, lançamento e suporte inicial', 'globe', 5),
  ('Acompanhamento', 'Métricas, resultados e expansão', 'bar-chart', 6);

-- Seed items for each phase
-- Phase 1: Prospecção
INSERT INTO public.commercial_items (phase_id, title, description, order_index)
SELECT p.id, i.title, i.description, i.idx
FROM public.commercial_phases p,
(VALUES
  ('Pesquisa de mercado e ICP', 'Identificar perfil de cliente ideal', 0),
  ('Primeiro contato realizado', 'Email, ligação ou indicação', 1),
  ('Necessidades mapeadas', 'Entender dores e objetivos do cliente', 2),
  ('Lead qualificado (BANT)', 'Budget, Authority, Need, Timeline', 3)
) AS i(title, description, idx)
WHERE p.order_index = 0;

-- Phase 2: Apresentação
INSERT INTO public.commercial_items (phase_id, title, description, order_index)
SELECT p.id, i.title, i.description, i.idx
FROM public.commercial_phases p,
(VALUES
  ('Reunião de apresentação agendada', NULL, 0),
  ('Demonstração realizada', 'Demo do produto/serviço', 1),
  ('Proposta comercial enviada', 'Documento com escopo e valores', 2),
  ('Follow-up pós-proposta', 'Acompanhamento após envio', 3)
) AS i(title, description, idx)
WHERE p.order_index = 1;

-- Phase 3: Negociação
INSERT INTO public.commercial_items (phase_id, title, description, order_index)
SELECT p.id, i.title, i.description, i.idx
FROM public.commercial_phases p,
(VALUES
  ('Objeções mapeadas e respondidas', NULL, 0),
  ('Ajustes na proposta', 'Adequação de escopo ou valores', 1),
  ('Aprovação interna do cliente', NULL, 2),
  ('Termos acordados', 'Prazo, valor e condições definidos', 3)
) AS i(title, description, idx)
WHERE p.order_index = 2;

-- Phase 4: Fechamento
INSERT INTO public.commercial_items (phase_id, title, description, order_index)
SELECT p.id, i.title, i.description, i.idx
FROM public.commercial_phases p,
(VALUES
  ('Contrato assinado', NULL, 0),
  ('Pagamento inicial recebido', NULL, 1),
  ('Kickoff agendado', 'Reunião de início do projeto', 2)
) AS i(title, description, idx)
WHERE p.order_index = 3;

-- Phase 5: Documentação
INSERT INTO public.commercial_items (phase_id, title, description, order_index)
SELECT p.id, i.title, i.description, i.idx
FROM public.commercial_phases p,
(VALUES
  ('Briefing detalhado', 'Documento com requisitos completos', 0),
  ('Cronograma definido', 'Marcos e entregas planejadas', 1),
  ('Acessos e materiais recebidos', NULL, 2)
) AS i(title, description, idx)
WHERE p.order_index = 4;

-- Phase 6: Go-Live
INSERT INTO public.commercial_items (phase_id, title, description, order_index)
SELECT p.id, i.title, i.description, i.idx
FROM public.commercial_phases p,
(VALUES
  ('Entrega realizada', NULL, 0),
  ('Treinamento do cliente', NULL, 1),
  ('Suporte pós-entrega', 'Período de acompanhamento', 2)
) AS i(title, description, idx)
WHERE p.order_index = 5;

-- Phase 7: Acompanhamento
INSERT INTO public.commercial_items (phase_id, title, description, order_index)
SELECT p.id, i.title, i.description, i.idx
FROM public.commercial_phases p,
(VALUES
  ('Métricas de resultado apresentadas', NULL, 0),
  ('Feedback coletado', NULL, 1),
  ('Oportunidade de upsell/cross-sell', 'Expansão de escopo', 2),
  ('Depoimento ou case solicitado', NULL, 3)
) AS i(title, description, idx)
WHERE p.order_index = 6;
