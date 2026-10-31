# Guia de Configuração — Integração Google & Firebase (Mobilion Assistente)

Este guia documenta o passo a passo necessário para registrar e autorizar as credenciais do aplicativo **Mobilion Assistente** no Google Cloud Console e Firebase Console para a conta **atendimento.mobilio@gmail.com**.

---

## 1. Google Cloud Console

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) logado com a conta `atendimento.mobilio@gmail.com`.
2. Crie ou selecione o projeto: **Mobilion Assistente**.

### 1.1 Ativação das APIs Google
No menu lateral, vá em **APIs e Serviços > Biblioteca** e ative as seguintes APIs:
- **Google People API** (para consulta e importação de clientes e contatos)
- **Google Calendar API** (para criação e sincronização dos agendamentos no calendário "Mobilion — Atendimentos")
- **Google Drive API** (para envio de backups automáticos e relatórios/PDFs para a pasta "Mobilion Backup")
- **Gmail API** (para envio de orçamentos e comunicações por e-mail quando solicitado)
- **Cloud Firestore API** (para espelhamento e backup em nuvem dos dados)

### 1.2 Tela de Consentimento OAuth (OAuth Consent Screen)
1. Vá em **APIs e Serviços > Tela de consentimento OAuth**.
2. Tipo de usuário: **Externo** (ou Interno caso use Google Workspace).
3. Dados do Aplicativo:
   - Nome do app: `Mobilion Assistente`
   - E-mail de suporte ao usuário: `atendimento.mobilio@gmail.com`
   - E-mail do desenvolvedor: `atendimento.mobilio@gmail.com`
4. **Escopos Adicionados:**
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/contacts.readonly`
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/gmail.send`
5. Em **Usuários de teste**, adicione `atendimento.mobilio@gmail.com` (enquanto o app estiver em modo de teste).

### 1.3 Criação das Credenciais OAuth 2.0
Vá em **APIs e Serviços > Credenciais > Criar Credenciais > ID do cliente OAuth**:

#### Credencial 1: Android
- Tipo de aplicativo: **Android**
- Nome: `Mobilion Android`
- Nome do pacote: `space.manus.montador.moveis.app.t20260415` (conforme configurado em `app.config.ts`)
- Impressão digital do certificado SHA-1:
  - Para obter o SHA-1 do keystore local ou EAS, execute:
    ```bash
    npx eas credentials
    ```
    ou obtenha a chave de debug:
    ```bash
    keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
    ```
- Copie o **ID do cliente** gerado e adicione na variável:
  `EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID`

#### Credencial 2: Aplicativo Web (para Expo / AuthSession)
- Tipo de aplicativo: **Aplicativo da Web**
- Nome: `Mobilion Web / AuthSession`
- URIs de redirecionamento autorizados:
  - `https://auth.expo.io/@seu-usuario/montador_moveis_app`
  - `http://localhost:8081`
- Copie o **ID do cliente** gerado e adicione na variável:
  `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB`

---

## 2. Configuração do Firebase & Cloud Firestore

1. Acesse o [Firebase Console](https://console.firebase.google.com/) com a conta `atendimento.mobilio@gmail.com`.
2. Adicione o projeto Google Cloud criado no passo 1.
3. No menu lateral, acesse **Firestore Database** e clique em **Criar banco de dados**.
4. Selecione o local do servidor: `southamerica-east1` (São Paulo) ou `us-central1`.
5. Em **Regras**, publique as regras contidas no arquivo `firebase.rules` do projeto:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
6. O ID do projeto deve ser preenchido em `EXPO_PUBLIC_FIREBASE_PROJECT_ID`.

---

## 3. Segurança e Boas Práticas Implementadas

- **Nenhum segredo no bundle:** Não são usadas chaves secretas (`client_secret`) no código do app. A autenticação utiliza o protocolo padrão **OAuth 2.0 com PKCE (RFC 7636)**.
- **Armazenamento Seguro:** Tokens de acesso e refresh são mantidos exclusivamente no hardware seguro do dispositivo via `expo-secure-store`.
- **Offline-First:** Todas as operações funcionam offline usando o `AsyncStorage` local. A sincronização com Google Cloud é executada de forma assíncrona sem travar a interface do usuário.
- **Deduplicação e Histórico:** Contatos importados da People API nunca duplicam telefones já cadastrados e preservam o histórico de endereços de atendimentos passados.
- **Calendário Dedicado:** A agenda cria e gerencia o calendário próprio `"Mobilion — Atendimentos"`, mantendo eventos de montagem inicial e retorno vinculados pelo mesmo ID.

