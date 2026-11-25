# guia-ui

Interface web do Sistema Contábil, um sistema interno (antes chamado Sistema de Guias): lançamento e conferência de guias de tributos, calendário de vencimentos, registro de pagamento, cadastros de apoio e, em breve, controles contábeis.

É só a camada de apresentação. Os dados, as regras e o controle de acesso ficam em uma API separada, que não faz parte deste repositório.

## Tecnologias

- React 19 + TypeScript
- Vite
- `react-router-dom` com `HashRouter` (o GitHub Pages não tem fallback de SPA)
- CSS próprio, sem biblioteca de componentes

## Rodando localmente

Pré-requisitos: [Node.js](https://nodejs.org) 24 (LTS) e a API rodando.

```
npm install
npm run dev
```

A aplicação abre em http://localhost:5173. As credenciais de acesso são as do ambiente da API que você estiver usando; este repositório não contém nenhuma.

### Endereço da API

A interface lê o endereço da API da variável `VITE_API_URL`. Sem ela, usa `http://localhost:8080`.

Para apontar para outro endereço, copie `.env.example` para `.env` e ajuste. O arquivo `.env` é ignorado pelo git.

> Tudo que começa com `VITE_` é embutido no JavaScript publicado e fica visível para qualquer pessoa. Nunca coloque senha, token ou chave de API em variáveis `VITE_`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com recarga automática |
| `npm run build` | Checagem de tipos e build de produção em `dist/` |
| `npm run preview` | Serve o build de produção localmente |
| `npm run lint` | Análise estática com oxlint |

## Estrutura

```
src/api         cliente HTTP, tipos e endpoints da API
src/auth        sessão do usuário e permissões por perfil
src/components  layout e componentes reutilizados
src/lib         formatação de datas e valores, hook de carregamento
src/pages       uma tela por arquivo
```

## Publicação

Cada push na branch `main` gera o build e publica no GitHub Pages pelo workflow `.github/workflows/deploy.yml`.

Configuração necessária no repositório, uma única vez:

1. **Settings → Pages**: em *Source*, escolha **GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables**: crie a variável `VITE_API_URL` com o endereço público da API, sem barra no final.

A API precisa aceitar a origem do site publicado (CORS); essa configuração é feita no servidor da API.

## Tarefas agendadas

Este repositório **não** tem workflows agendados: só o `deploy.yml` (publicação no Pages). A rotina diária da API é disparada por um script externo e gratuito do Google Apps Script, configurado à mão. Não há ping para manter a API acordada: ela hiberna e acorda sob demanda. O passo a passo está no README do `guia-service`, seção "Rotina diária no Google Apps Script".

## Segurança

- Este repositório é público. Não inclua endereços internos, credenciais, dados de empresas ou de pessoas em código, comentários, exemplos ou capturas de tela.
- As permissões na interface apenas escondem o que o perfil não pode usar. Quem garante as regras é a API.
