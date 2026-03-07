-- Onboarding Module: steps, documents, and per-contact tracking

-- Onboarding steps (the 5 phases)
CREATE TABLE IF NOT EXISTS public.onboarding_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'file-text',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on onboarding_steps" ON public.onboarding_steps FOR ALL USING (true) WITH CHECK (true);

-- Onboarding documents (linked to steps, placeholders for future uploads)
CREATE TABLE IF NOT EXISTS public.onboarding_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_id UUID NOT NULL REFERENCES public.onboarding_steps(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  document_url TEXT,
  template_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on onboarding_documents" ON public.onboarding_documents FOR ALL USING (true) WITH CHECK (true);

-- Per-contact onboarding tracking
CREATE TABLE IF NOT EXISTS public.contact_onboarding_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.onboarding_steps(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contact_id, step_id)
);

ALTER TABLE public.contact_onboarding_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on contact_onboarding_tracking" ON public.contact_onboarding_tracking FOR ALL USING (true) WITH CHECK (true);

-- Per-contact document tracking (sent/received/signed status per document)
CREATE TABLE IF NOT EXISTS public.contact_onboarding_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.onboarding_documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_sent',
  sent_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  signed_at TIMESTAMP WITH TIME ZONE,
  file_url TEXT,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contact_id, document_id)
);

ALTER TABLE public.contact_onboarding_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on contact_onboarding_documents" ON public.contact_onboarding_documents FOR ALL USING (true) WITH CHECK (true);

-- Seed onboarding steps
INSERT INTO public.onboarding_steps (title, description, icon, order_index) VALUES
  ('Enviar Contrato', 'Nada avança sem assinatura. Escopo claro, entregáveis definidos, timeline e política de revisões. Protege ambos os lados desde o dia 1.', 'file-text', 1),
  ('Enviar Fatura', 'Facilite o pagamento. Envie a fatura com link de pagamento Stripe para tornar o processo simples e rápido.', 'credit-card', 2),
  ('Documento de Boas-Vindas', 'Envie um documento com: visão geral do projeto, próximos passos e detalhes de comunicação.', 'mail', 3),
  ('Agendar Call Estratégica', 'Kickoff call para alinhar objetivos, direção, timeline, logística e tudo que é importante para o projeto.', 'phone', 4),
  ('Remover Remorso do Comprador', 'Logo após o pagamento, crie progresso instantâneo. Mostre o sistema, timeline e próximos passos para eliminar qualquer dúvida.', 'rocket', 5);

-- Seed onboarding documents (placeholders for each step)
-- Step 1: Enviar Contrato
INSERT INTO public.onboarding_documents (step_id, title, description, order_index)
SELECT id, 'Contrato de Prestação de Serviço', 'Contrato principal com escopo, entregáveis e timeline', 1
FROM public.onboarding_steps WHERE order_index = 1;

INSERT INTO public.onboarding_documents (step_id, title, description, order_index)
SELECT id, 'Política de Revisões', 'Documento com regras e limites de revisões', 2
FROM public.onboarding_steps WHERE order_index = 1;

INSERT INTO public.onboarding_documents (step_id, title, description, order_index)
SELECT id, 'NDA / Confidencialidade', 'Acordo de não-divulgação (se aplicável)', 3
FROM public.onboarding_steps WHERE order_index = 1;

-- Step 2: Enviar Fatura
INSERT INTO public.onboarding_documents (step_id, title, description, order_index)
SELECT id, 'Fatura / Invoice', 'Fatura com valores e condições de pagamento', 1
FROM public.onboarding_steps WHERE order_index = 2;

INSERT INTO public.onboarding_documents (step_id, title, description, order_index)
SELECT id, 'Link de Pagamento Stripe', 'Link direto para pagamento via Stripe', 2
FROM public.onboarding_steps WHERE order_index = 2;

-- Step 3: Documento de Boas-Vindas
INSERT INTO public.onboarding_documents (step_id, title, description, order_index)
SELECT id, 'Welcome Document', 'Documento de boas-vindas com visão geral do projeto', 1
FROM public.onboarding_steps WHERE order_index = 3;

INSERT INTO public.onboarding_documents (step_id, title, description, order_index)
SELECT id, 'Guia de Comunicação', 'Canais, horários e expectativas de comunicação', 2
FROM public.onboarding_steps WHERE order_index = 3;

INSERT INTO public.onboarding_documents (step_id, title, description, order_index)
SELECT id, 'Cronograma do Projeto', 'Timeline visual com marcos e entregas', 3
FROM public.onboarding_steps WHERE order_index = 3;

-- Step 4: Agendar Call Estratégica
INSERT INTO public.onboarding_documents (step_id, title, description, order_index)
SELECT id, 'Briefing Pré-Call', 'Documento com perguntas e tópicos para a call estratégica', 1
FROM public.onboarding_steps WHERE order_index = 4;

INSERT INTO public.onboarding_documents (step_id, title, description, order_index)
SELECT id, 'Ata / Resumo da Call', 'Registro das decisões e alinhamentos da kickoff call', 2
FROM public.onboarding_steps WHERE order_index = 4;

-- Step 5: Remover Remorso do Comprador
INSERT INTO public.onboarding_documents (step_id, title, description, order_index)
SELECT id, 'Visão do Sistema', 'Overview visual do que será entregue e como funciona', 1
FROM public.onboarding_steps WHERE order_index = 5;

INSERT INTO public.onboarding_documents (step_id, title, description, order_index)
SELECT id, 'Roadmap de Entregas', 'Timeline com quick wins e entregas iniciais', 2
FROM public.onboarding_steps WHERE order_index = 5;

INSERT INTO public.onboarding_documents (step_id, title, description, order_index)
SELECT id, 'Checklist de Próximos Passos', 'Lista clara do que acontece nas próximas 48h', 3
FROM public.onboarding_steps WHERE order_index = 5;
