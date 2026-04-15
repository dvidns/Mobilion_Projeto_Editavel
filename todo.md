# TODO — MontaFácil

## Setup e Configuração
- [x] Configurar tema de cores (azul + verde)
- [x] Gerar logo do app (chave inglesa + guarda-roupa)
- [x] Configurar nome do app (MontaFácil)
- [x] Configurar ícones da tab bar
- [x] Instalar expo-contacts

## Telas
- [x] Home (Hoje) — resumo do dia + lista de agendamentos
- [x] Agenda — calendário + lista por dia
- [x] Clientes — lista, busca, detalhe
- [x] Serviços/Preços — tabela editável por tipo de móvel
- [x] Orçamentos — lista, criação, compartilhar WhatsApp
- [x] Configurações — dados pessoais
- [x] Novo Agendamento — formulário completo
- [x] Detalhe Agendamento — status, ligar, WhatsApp
- [x] Novo Cliente — formulário
- [x] Detalhe Cliente — histórico e contato

## Funcionalidades
- [x] Importar contatos do celular (expo-contacts)
- [x] Criar/editar/excluir agendamentos
- [x] Criar/editar/excluir clientes
- [x] Tabela de preços de referência (GetNinja/Habitissimo) — 20 serviços
- [x] Criar orçamento com múltiplos serviços
- [x] Compartilhar orçamento via WhatsApp
- [x] Persistência local com AsyncStorage
- [x] Ligar para cliente diretamente
- [x] Enviar WhatsApp de confirmação de serviço

## Entrega
- [x] Gerar logo e salvar checkpoint
- [ ] Publicar APK para Android (via botão Publish)

## Melhorias
- [x] Seleção de contato único do celular direto na tela de Novo Agendamento (sem importar tudo)
- [x] Seletor de data com calendário inline no Novo Agendamento (sem sair da tela)
- [x] Pergunta na primeira vez que clicar no WhatsApp: normal ou Business (salvar preferência)
- [x] Mensagem de WhatsApp diferente conforme status: confirmação ou avaliação com link
- [x] Tela de configurações com campo para editar link de avaliação (Google Maps ou outro)
- [x] Notificação de lembrete automática 1 hora antes de cada serviço agendado
- [x] Tela de relatório de faturamento com gráfico do total recebido no mês

## Backup na Nuvem
- [x] Serviço de backup automático na nuvem com sincronização
- [x] Tela de status de backup e restauração manual

## Foto e Calendário
- [x] Captura de foto do móvel no agendamento
- [ ] Integração com Google Calendar
- [x] Importar endereço do cliente no agendamento
- [x] Ícone de Google Maps na tela de Hoje para navegação rápida
- [x] Finalizar integração com Google Calendar

## Painel de Controle
- [x] Painel de controle visual com resumo da semana

## Atualização Automática
- [x] Sistema de verificação de atualizações
- [x] Botão flutuante para atualizar app

## Notificação e Offline
- [x] Notificação push de atualização disponível
- [x] Modo offline com sincronização automática

## Melhorias Críticas
- [x] Edição de agendamento existente (dia, hora, dados)
- [x] Tabela de preços com cálculo automático (valor/hora)
- [x] Relatório de faturamento em PDF/Excel
- [x] Sincronização com Google Calendar (corrigir)
- [x] Envio de documentos financeiros (orçamento, ordem de serviço)
- [x] Corrigir WhatsApp Business


## Endereço de Retorno (Sessão Anterior)
- [x] Adicionar campo `enderecoRetorno` à interface Agendamento
- [x] Adicionar campo de input para endereço de retorno na tela de novo agendamento
- [x] Adicionar campo de edição para endereço de retorno na tela de detalhe
- [x] Exibir endereço de retorno no calendário com link para Google Maps
- [x] Testes unitários para agendamento com retorno e endereço de retorno
- [x] Testar fluxo completo no app (criar agendamento, verificar calendário, editar)
- [x] Salvar checkpoint final

## Correções de Lógica de Retorno (Sessão Atual)
- [x] Corrigir cálculo de valor do retorno (não dividir novamente por 2)
- [x] Adicionar nome do serviço no label de retorno ("🔄 Retorno - Nome do Serviço")
- [x] Testes para validar exibição correta de retorno no calendário
- [ ] Integração com GitHub para controle de versão
- [ ] Botão de nuvem para atualização manual do app


## Correção de Fluxo de Salvamento com Retorno (Sessão Anterior)
- [x] Remover limpeza de serviço e valor ao adicionar móvel
- [x] Permitir salvamento com 1 serviço sem clicar em "Adicionar outro"
- [x] Validar que tipo de serviço não fica em branco ao ativar retorno
- [x] Salvar checkpoint com correção

## Simplificação de Fluxo de Novo Agendamento (Sessão Atual)
- [x] Permitir salvamento automático com 1 serviço sem clicar em "Adicionar"
- [x] Ocultar botão "Adicionar móvel/serviço" quando há apenas 1 serviço
- [x] Testar fluxo com 1 serviço e retorno
- [ ] Salvar checkpoint final
