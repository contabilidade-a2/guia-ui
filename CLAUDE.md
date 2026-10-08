# Guias — front-end

Interface web do Sistema de Lançamento e Conferência de Guias. O back-end fica no repositório `guia-service` (pasta irmã); o `CLAUDE.md` de lá é a fonte dos requisitos, das permissões e do contrato da API. Leia-o antes de mudar algo aqui.

## Stack

- React 19 + TypeScript, Vite, `react-router-dom` com `HashRouter` (o GitHub Pages não tem fallback de SPA).
- Sem biblioteca de componentes: CSS próprio em `src/styles.css`.
- Hospedagem: GitHub Pages (repositório público), publicado pelo workflow `.github/workflows/deploy.yml` a cada push na `main`.

## Como rodar

```
npm install
npm run dev        # http://localhost:5173
npm run build      # checagem de tipos + build de produção em dist/
npm run lint
```

- O back-end precisa estar no ar: em `guia-service`, `./gradlew bootRun` (perfil `local`; o login de desenvolvimento está no README de lá).
- A URL da API vem de `VITE_API_URL` (padrão `http://localhost:8080`). Para mudar localmente, copie `.env.example` para `.env`.
- Em produção, `VITE_API_URL` é uma *variável* do repositório no GitHub (não um segredo: ela vai para o JavaScript público), e o back-end precisa ter a origem do Pages em `CORS_ORIGINS` e `FRONTEND_URL`.

## Agendamentos

Não há workflows agendados neste repositório (só o `deploy.yml`). O keep-alive (`GET /health`) e a rotina diária (`POST /internal/jobs/daily`) são chamados pelo cron-job.org, configurado à mão; veja o `CLAUDE.md` e o README do `guia-service`. Motivo: a conta anterior no GitHub foi suspensa em 08/10/2026, provavelmente pelo ping de 5 em 5 minutos via Actions, e por isso nada agendado fica mais no GitHub.

## Convenções

- **Este repositório é público** (exigência do GitHub Pages gratuito); o `guia-service` é privado. Nada de credenciais, URLs reais de produção, nomes de empresas ou de pessoas em código, documentação, exemplos ou mensagens de commit.

- **Código em inglês, textos da tela em português**, igual ao back-end. Rotas em inglês: `/slips/:id` precisa continuar existindo, porque os e-mails apontam para `/#/slips/{id}`.
- Rótulos em português para os enums (`PENDING` → "Pendente" etc.) ficam em `src/lib/format.ts`.
- As mensagens de erro vêm prontas da API (`ProblemDetail.detail` e `errors` por campo); `src/api/client.ts` as transforma em `ApiError`. Não reescrever essas mensagens no front.
- As permissões por perfil em `AuthContext` só escondem o que o usuário não pode fazer; quem garante a regra é o servidor.
- Datas `yyyy-MM-dd` são formatadas como texto, sem passar por `Date`, para não mudar de dia por fuso. "Hoje" é sempre o dia em `America/Sao_Paulo`.
- O token JWT fica no `localStorage`; um 401 da API encerra a sessão.

## Estrutura

```
src/api         cliente HTTP, tipos e endpoints
src/auth        sessão e permissões
src/components  layout e peças reutilizadas (Field, Modal, badges)
src/lib         formatação e o hook useLoad
src/pages       uma tela por arquivo
```

## Pendências

- Arquivos: hoje a guia e o comprovante são links `https` colados pelo usuário (fase 1 do back-end). A fase 2 (upload pelo sistema via Microsoft Graph) ainda depende da decisão descrita no `guia-service`.
- Não há testes automatizados; a validação foi manual, num navegador, contra o back-end local.
