# Design — MontaFácil (App para Montador de Móveis)

## Identidade Visual

Inspirado no SimpleS Agenda: limpo, direto, funcional. Sem excessos.

- **Cor primária**: #1A73E8 (azul confiança)
- **Cor de destaque**: #34A853 (verde ação/confirmado)
- **Fundo**: #F8F9FA (cinza muito claro)
- **Superfície (cards)**: #FFFFFF (branco)
- **Texto principal**: #202124
- **Texto secundário**: #5F6368
- **Borda/divisor**: #E8EAED
- **Erro**: #EA4335
- **Aviso**: #FBBC04

## Telas do App

### 1. Home (Hoje)
- Resumo do dia: quantos serviços agendados, valor total previsto
- Lista de agendamentos do dia (cards compactos: hora, cliente, tipo de serviço)
- Botão flutuante (+) para novo agendamento rápido

### 2. Agenda
- Calendário mensal no topo (compacto, dias com pontos indicando serviços)
- Lista de agendamentos do dia selecionado abaixo
- Card de agendamento: hora, cliente, endereço, tipo de móvel, valor, status

### 3. Clientes
- Lista de clientes com busca
- Card: nome, telefone, último serviço
- Botão importar contatos do celular
- Tela de detalhe: histórico de serviços, endereço, notas

### 4. Serviços / Preços
- Tabela de preços por tipo de móvel/serviço
- Categorias: Guarda-roupa, Cozinha, Escritório, Sala, Quarto, Desmontagem
- Referência de mercado (baseada em pesquisa de preços)
- Edição livre de valores

### 5. Orçamentos
- Lista de orçamentos (pendente, aprovado, recusado)
- Criação: seleciona cliente + serviços + data + valor
- Compartilhar via WhatsApp

### 6. Mais / Configurações
- Meus dados (nome, telefone)
- Sobre o app

## Fluxos Principais

**Novo agendamento:**
Home (+) → Selecionar cliente (ou criar) → Tipo de serviço → Data/hora → Endereço → Valor → Salvar

**Importar contato:**
Clientes → Importar → Permissão → Lista de contatos do celular → Selecionar → Salvar como cliente

**Criar orçamento:**
Orçamentos (+) → Selecionar cliente → Adicionar serviços → Valor total → Compartilhar WhatsApp

## Navegação

Tab bar inferior com 4 abas:
1. Hoje (ícone: calendar-today)
2. Agenda (ícone: event)
3. Clientes (ícone: people)
4. Mais (ícone: menu)

Serviços/Preços e Orçamentos acessados pelo "Mais".
