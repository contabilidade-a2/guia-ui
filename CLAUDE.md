# Sistema Contábil — front-end (repositório `guia-ui`)

Interface web do **Sistema Contábil** (nome desde 25/11/2026; antes Sistema de Lançamento e Conferência de Guias). O nome aparece no login (sem subtítulo), no topo e no `<title>`; repositório, rotas e URL continuam com "guia" para não quebrar links. O back-end fica no repositório `guia-service` (pasta irmã); o `CLAUDE.md` de lá é a fonte dos requisitos, das permissões e do contrato da API. Leia-o antes de mudar algo aqui.

## Stack

- React 19 + TypeScript, Vite, `react-router-dom` com `HashRouter` (o GitHub Pages não tem fallback de SPA).
- Sem biblioteca de componentes: CSS próprio em `src/styles.css`. Visual "Clean" (escolhido pela usuária em 08/10/2026 entre quatro propostas): superfícies brancas, bordas finas, uma cor de destaque (verde-petróleo `--primary`) e a fonte Manrope, carregada do Google Fonts em `index.html`. As cores ficam como variáveis no `:root` do CSS.
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

Não há workflows agendados neste repositório (só o `deploy.yml`). A rotina diária (`POST /internal/jobs/daily`) é chamada por um script do Google Apps Script, numa conta Google, configurado à mão (código e passo a passo na seção 5 do README do `guia-service`): dois disparos por dia, entre 9h e 10h e, de reserva, entre 10h e 11h. Ele substituiu o cron-job.org (configuração concluída pela usuária em 17/11/2026, com os jobs antigos desativados). O keep-alive foi removido (12/10/2026): não criar pings para manter o back-end acordado. Motivo: a conta anterior no GitHub foi suspensa em 08/10/2026, provavelmente pelo ping de 5 em 5 minutos via Actions, e por isso nada agendado fica mais no GitHub.

## Back-end hibernando

O back-end (Render gratuito) hiberna após 15 minutos sem uso e leva de 2 a 3 minutos para acordar. Tudo isso fica em `src/api/client.ts`:

- Uma chamada sem resposta (ou com 502/503/504) é repetida sozinha a cada 5 s, por até 5 minutos, enquanto o `WakingNotice` (`components/ui.tsx`, montado no `App`) mostra "Iniciando o sistema, isso pode levar alguns instantes…". O aviso também aparece para qualquer chamada pendente há mais de 5 s.
- Só se repete o que é seguro: todo `GET`, e qualquer chamada enquanto o back-end ainda não respondeu nada desde que a página abriu (ele está dormindo, então nada chegou lá). Depois disso, uma escrita que falha não é repetida, para não duplicar o registro.
- Métrica de espera (pedido da usuária em 12/10/2026, para a decisão sobre a hospedagem): o tempo da primeira chamada de cada sessão do navegador (`sessionStorage`), e de qualquer chamada posterior repetida ou com 10 s ou mais, vai para `POST /api/usage/waits` assim que há um usuário logado. O resumo do mês aparece na tela "Uso" (`/usage`, só Administrador). No topo dessa tela, "Limites dos planos gratuitos" (25/11/2026, `LimitsSection` em `UsagePage.tsx`): e-mails de hoje segundo o Brevo e tamanho do banco contra o limite do Neon, de `GET /api/usage/limits`, com barras verde/amarelo (70%)/vermelho (90%), as maiores tabelas com nome em português (`TABLE_LABELS`) e o motivo quando um dado não pode ser lido. São os valores de agora, independentes do mês escolhido.

## Convenções

- **Este repositório é público** (exigência do GitHub Pages gratuito); o `guia-service` é privado. Nada de credenciais, URLs reais de produção, nomes de empresas ou de pessoas em código, documentação, exemplos ou mensagens de commit.

- **Código em inglês, textos da tela em português**, igual ao back-end. Rotas em inglês: `/slips/:id` precisa continuar existindo, porque os e-mails apontam para `/#/slips/{id}`.
- Rótulos em português para os enums (`PENDING` → "Pendente" etc.) ficam em `src/lib/format.ts`.
- As mensagens de erro vêm prontas da API (`ProblemDetail.detail` e `errors` por campo); `src/api/client.ts` as transforma em `ApiError`. Não reescrever essas mensagens no front.
- As permissões por perfil em `AuthContext` só escondem o que o usuário não pode fazer; quem garante a regra é o servidor.
- Menu (layout escolhido pela usuária em 25/11/2026, entre três propostas; `Layout.tsx`): **Calendário** fixo no topo e as demais telas em grupos que abrem uma lista ao clicar (`NavGroup`): **Guias** (Guias, Parcelamentos), **Cadastros** (Empresas, Tipos de guia, Usuários), **Contábil** (Importação contábil, ainda "em breve", só para o Administrador e sem link; e Controle contábil, para o Administrador e para o Contábil quando liberado) e **Administração** (Guias excluídas, Uso). Cada perfil vê só as próprias telas (`menuGroups`); grupo sem tela some, e grupo com uma única tela vira link direto (o Financeiro vê "Calendário · Guias"; Fiscal e Contábil veem "Calendário · Guias ▾ · Empresas", e o Contábil com o Controle contábil liberado vê também "Controle contábil" como link direto). O grupo da tela aberta fica sublinhado. Ao criar uma tela nova, encaixá-la num grupo em `menuGroups`; as telas contábeis entram no grupo Contábil (tirar o "em breve" dando um `to`). `MainNav` e `UserMenu` são remontados a cada rota com chaves **diferentes** (`nav:` + caminho e o caminho): chaves iguais entre irmãos duplicavam o menu.
- Cadastro de empresas: as colunas e os campos **Cód. Cigam** e **Cód. Domínio** (`cigamCode`/`dominioCode`, mapeamento das empresas do grupo; pedido da usuária em 25/11/2026) só aparecem nessa tela. Opcionais, só dígitos, mantêm o zero à esquerda; sem código, a lista mostra "—". A tela tem filtros (pedido da usuária em 25/11/2026): Empresa (parte do nome ou do nome fantasia, sem diferenciar maiúsculas nem acentos), CNPJ (parte, com ou sem pontuação), Cód. Cigam e Cód. Domínio (parte) e Status (Todos/Ativo/Inativo). A lista vem inteira de `GET /api/companies` (poucas empresas), então o filtro é feito no navegador, na hora (`matches` em `CompaniesPage.tsx`), sem parâmetros novos na API. Ordenação por coluna (pedido da usuária em 25/11/2026), com o mesmo `SortableHeader` das guias: Nome, Nome fantasia, CNPJ, Cód. Cigam, Cód. Domínio e Status; também feita no navegador (`sortCompanies`), sobre a lista já filtrada. Códigos comparam como números (texto mais curto primeiro), empresa sem código fica sempre no fim, Status crescente põe as ativas primeiro, e empates (e a ordem padrão) seguem pelo nome. "Usuários notificados" fica sem ordenação.
- Controle contábil (`/closing`, `ClosingPage.tsx`; etapa 1 aprovada pela usuária em 25/11/2026; regras na seção 11 do `CLAUDE.md` do `guia-service`): abas Saldos, Portadores, Empresas e acesso e Importar CSV (só a primeira para o Contábil, que nem vê as abas). O acesso do Contábil vem de `GET /api/closing/access`, perguntado uma vez por login no `AuthContext` (`canUseClosing`; a rota espera a resposta com `closingAccessKnown`). Painel: competência (abre no mês anterior, nunca antes da primeira) e empresa; "Só pendentes e divergentes" marcado por padrão, e a linha editada na tela continua visível até trocar o mês ou a empresa; grupos Contas correntes e Aplicações recolhíveis, com contagem por status. Cada campo grava sozinho (caixas na hora, valores e observação ao sair do campo), mostrando a mudança antes da resposta e voltando atrás se o servidor recusar. Saldos usam `SignedMoneyInput` (aceita negativo, digitado livre e formatado ao sair; o `CurrencyInput` não tem sinal). Cores dos status reaproveitam os badges: OK `badge-paid`, Divergente `badge-overdue` (linha rosada), Pendente `badge-pending`, Sem movimento `badge-archived` (`BALANCE_STATUS_BADGES`).
- Empresa inativa (`Company.active`) continua nas listas e nos filtros, mas sai das opções dos cadastros de guia e de parcelamento; o registro que já a usa continua mostrando-a ao ser editado. O servidor também recusa (422).
- Datas `yyyy-MM-dd` são formatadas como texto, sem passar por `Date`, para não mudar de dia por fuso. "Hoje" é sempre o dia em `America/Sao_Paulo`.
- O token JWT fica no `localStorage`; um 401 da API encerra a sessão.
- Ordenação das listas de guias e de parcelamentos (pedido da usuária em 11/11/2026): o `SortableHeader` (`components/ui.tsx`) torna o cabeçalho clicável; cada clique alterna crescente, decrescente e a ordem padrão (`lib/sort.ts`). Quem ordena é o servidor (`sort`/`direction`), porque as listas são paginadas; trocar a ordem volta para a primeira página. Só algumas colunas são ordenáveis (veja o `CLAUDE.md` do `guia-service`).
- Filtros da lista de guias (layout escolhido pela usuária em 17/11/2026, entre três propostas): **Empresa, Assunto e Status ficam sempre visíveis** (são os prioritários), ao lado do botão "Filtros avançados", que mostra **+** fechado e **−** aberto (sem número de filtros, pedido da usuária) e fica verde quando há filtro avançado em uso com o painel fechado. As datas (`DateRangeChips`: Competência, Vencimento, Enviada em) ficam sempre visíveis numa linha logo abaixo, fora do painel (pedido da usuária em 18/11/2026; só a visibilidade mudou, o filtro de data é o mesmo). O painel tem Tipo, CNPJ, Valor, Nº do parcelamento e Origem. Com ele fechado, cada filtro avançado em uso vira uma etiqueta com ×, na linha das datas, depois de um separador; data em uso não acende o botão, porque já está à vista. Detalhes:
  - Assunto (`subject`), CNPJ e Nº do parcelamento (`planNumber`, 16/11/2026) são aplicados após uma pausa na digitação; Origem vai como `origin`.
  - Valor: dois `CurrencyInput` ("de" e "até") numa caixa só. O "até" copia o "de" enquanto não for editado (um valor = busca exata; para faixa, edita-se o "até"; apagá-lo volta a copiar). Vai como `amountFrom`/`amountTo`.
  - A tela de guias excluídas não tem esses filtros novos (a cópia não guarda o parcelamento; assunto e valor não foram pedidos lá).

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
