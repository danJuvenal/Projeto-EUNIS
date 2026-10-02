/**
 * A capacidade `mcp` — chama as ferramentas MCP conectadas do visualizador a partir de um frame.
 *
 * Uma decisão, dois braços: exibir dados que devem permanecer atualizados é
 * `watchTool`; realizar uma ação uma vez é `callTool`. Use `listTools()`
 * para ver quais servidores o visualizador tem disponíveis, e `server(name)` para um
 * handle cujos métodos são as ferramentas de um servidor. As chamadas rodam com as
 * credenciais do visualizador; seu código nunca vê tokens. Obtenha o
 * namespace com `const mcp = await claude.use("mcp")` — `null` significa
 * que esta visualização não pode executar a capacidade; projete para ausência. Além dos
 * conectores do visualizador, uma visualização pode alcançar os servidores próprios do Claude para este
 * artefato (`kind: "artifact"` em `listTools()`; hoje `artifacts_data`,
 * o armazenamento de documentos deste artefato, em uma página que declarou `db`): então
 * `use("mcp")` resolve o estado do manifesto do conector — nenhum
 * declarado, ou declarado mas não concedido a este visualizador.
 */

declare namespace Claude {
  /**
   * Design de falha — leia antes de escrever qualquer ponto de chamada. Chamadas de conector
   * falham rotineiramente em operação normal (autenticação vencida, um conector que
   * o visualizador não adicionou, um upstream temporariamente indisponível), e cada código
   * em {@link Claude.mcp.McpError} tem uma resposta correta diferente.
   * Projete os estados degradados da página junto com o caminho feliz:
   *
   * - Ramifique a UX no `code` do erro, nunca no texto da mensagem, e
   *   nunca reduza todas as falhas a um único banner genérico. Um único
   *   catch-all ("falha transitória do conector", "algo deu errado")
   *   é o antipadrão nomeado para esta capacidade: ele esconde a única
   *   ação que corrigiria a página (reconectar, adicionar o conector,
   *   escolher um ou simplesmente aguardar) e transforma estados recuperáveis em
   *   becos sem saída. Um ramo padrão com texto genérico é aceitável para códigos
   *   que você não lida individualmente — o antipadrão é colapsar
   *   os códigos que têm correção distinta em um único banner.
   * - Tente novamente apenas erros marcados com `retryable: true` (hoje
   *   `server_unavailable`, `rate_limited` se algum dia disparar, e o
   *   `upstream_error` da primeira chamada quando o consentimento do visualizador para
   *   esse conector não pôde ser solicitado ou ficou sem decisão agora)
   *   — no máximo uma vez por atualização visível ao usuário, após um curto atraso aleatório,
   *   honorando `retryAfterMs` quando presente, e SOMENTE para leituras.
   *   `server_unavailable` (tempo limite de resposta do runtime e 5xx do upstream chegam aqui) e `upstream_error` são resultados AMBIGUOS para
   *   gravações: uma rejeição NÃO prova que a ferramenta não executou. Reenvie uma
   *   gravação apenas com um novo gesto do usuário, e quando o conector
   *   oferecer uma leitura, releia o estado primeiro. Nunca reenvie `needs_reauth` ou
   *   `server_not_connected` sem supervisão — repetir a chamada não pode
   *   ter sucesso por conta própria: `needs_reauth` significa que o refresh de credenciais já foi
   *   esgotado no upstream, e `server_not_connected` significa que não há
   *   conector configurado (para um servidor `host:`, sem ponte local nessa superfície, ou o servidor local não está em execução). Renderize
   *   o texto documentado de reconexão/adicionar ou fallback sem host; uma
   *   ação posterior do visualizador pode trazer um servidor host de volta.
   * - O consentimento é legível e solicitável por conector via os
   *   nomes com escopo da capacidade `permissions`: `"mcp:<server>"`, com
   *   o nome do servidor exatamente como declarado no manifesto (a mesma
   *   string passada para {@link Claude.mcp.callTool}). Uma página de vários conectores
   *   deve bloquear cada seção pelo estado do seu servidor
   *   (`state("mcp:<server>")`) e pedir por seção
   *   (`request(["mcp:<server>"])`) em vez de pedir tudo
   *   de uma vez; `"mcp"` isolado continua sendo o agregado de todo manifesto —
   *   "granted" somente quando todo servidor declarado estiver coberto, e pedir
   *   isso solicita todos. `use("mcp")` resolvendo algo diferente de `null` é
   *   o gate de disponibilidade. Qualquer estado diferente de
   *   `"unavailable"` em uma leitura de permissões significa presente, e
   *   `"prompt"` significa prosseguir (a primeira chamada pergunta) — nunca bloqueie
   *   renderização em `=== "granted"`, e tolera rejeição em qualquer
   *   leitura de permissões (`.catch(() => "unavailable")`). Trate os
   *   códigos de rejeição de ciclo de vida em toda chamada — a disponibilidade é
   *   por visualização e pode mudar em um reinício.
   * - Uma falha de ferramenta REJEITA com `tool_error` (o conector estava
   *   acessível e respondeu, mas reportou falha) — o envelope completo do resultado
   *   vai no campo `result` da rejeição para o raro inspetor. Uma retry imediata com os mesmos argumentos rara vez
   *   ajuda; exponha a mensagem reportada na seção afetada.
   * - Servidores host (`host:<name>`): uma entrada do manifesto cujo `server`
   *   começa com `host:` nomeia um servidor MCP em execução no DISPOSITIVO DO VISUALIZADOR,
   *   alcançado pelo app Claude que exibe a página (o app desktop primeiro). `<name>` é o nome do servidor local com
   *   qualquer coisa fora de `[A-Za-z0-9_-]` substituída por `_`. A API é a
   *   mesma — `callTool("host:filesystem", "read_file", {...})`, consentimento
   *   por servidor via `"mcp:host:filesystem"` — com três diferenças:
   *   fora do app (uma aba do navegador, um drawer embutido) toda chamada
   *   falha — `server_not_connected` quando o shell roteia chamadas `host:`
   *   para o app; o serviço em si nunca executa uma ferramenta `host:` —
   *   e ali `listTools()` então omite o servidor, então sempre renderize um
   *   fallback sem host; o app pode pedir ao visualizador para confirmar uma chamada
   *   que não esteja anotada como somente leitura, o que pode demorar ou voltar
   *   `cancelled`; e somente o dono do Artefato pode usar servidores host
   *   por enquanto. Quando o shell roteia chamadas `host:` para o app,
   *   a entrada da ferramenta vai para o dispositivo em vez do serviço, que então
   *   vê qual ferramenta executou, nunca seus argumentos.
   * - Páginas que fazem várias chamadas por atualização (dashboards,
   *   relatórios de várias seções) colocam cada falha na seção que a afeta: uma chamada falhada anota ou cinza sua própria seção
   *   enquanto o restante renderiza normalmente. Mantenha os dados anteriores bem-sucedidos
   *   visíveis com um indicador de desatualizado/última atualização (gere-o a partir de `cache.storedAt`, nunca `Date.now()`), e prefira
   *   {@link Claude.mcp.watchTool} para tais seções — ele replaya,
   *   atualiza e coalesce para você. Quando todas as seções falham ao mesmo tempo com o mesmo código, trate como condição da página:
   *   mostre uma mensagem com um affordance de recarregar em vez de repetir
   *   o mesmo erro em cada seção.
   * - Em um handler {@link Claude.mcp.watchTool}: erros transitórios mantêm
   *   os últimos dados bons; negações de autorização (`needs_reauth`,
   *   `server_not_connected`, `blocked_by_policy`, `approval_required`)
   *   RETRAEM dados renderizados; falhas de registro significam que atualizações em tempo real
   *   nunca chegarão — doutrina completa em {@link Claude.mcp.watchTool}.
   */
  namespace mcp {
    /**
     * Forma de rejeição para {@link callTool} e {@link listTools}, e
     * o payload de erro de {@link watchTool}. Ramifique em `.code`
     * para UX; `.message` é legível para humanos, mas não localizado. `.server`
     * ecoa o nome de exibição do conector quando a falha é específica de
     * um conector.
     *
     * Para um dos servidores próprios do Claude (`kind: "artifact"`) os códigos mantêm
     * seu significado com estas leituras: `not_in_manifest` — estes
     * dados do artefato não são acessíveis para este visualizador mais (ou a
     * chamada nomeou outro artefato); `bad_request` — uma ferramenta que a página não pode
     * chamar, ou entrada malformada; `capability_disabled` — esta visualização perdeu a conexão com o servidor; `server_unavailable` (retryable) —
     * o servidor não respondeu no tempo ou está pausado; `tool_error` — o
     * armazenamento recusou a operação, `.message` carregando seu envelope de erro
     * como texto JSON (`{"error":{"code", ...}}`) e `.result` o resultado completo.
     * `needs_reauth`, `selection_required` e
     * `blocked_by_policy` não surgem para eles.
     */
    interface McpError {
      code: McpErrorCode;
      /** Nome de exibição do conector (por exemplo `"Google Calendar"`), quando aplicável. */
      server?: string;
      message: string;
      /**
       * Marcado SOMENTE como `true`, pela camada que produziu o erro,
       * quando repetir a chamada sem supervisão (sem ação do visualizador) pode
       * ter sucesso — correto mesmo para códigos mais novos que este contrato.
       * Ausente = não reenvie automaticamente. Autoriza no MÁXIMO uma retry por
       * atualização visível ao usuário, após um curto atraso aleatório; respeite
       * `retryAfterMs`. Nunca faça loop.
       */
      retryable?: boolean;
      /** Primeira retry sensata, em ms a partir do recebimento (limitado pelo shell em 60 s). */
      retryAfterMs?: number;
      /** Presente em `tool_error`: o envelope completo do resultado que a ferramenta
       * retornou, para o raro inspetor que precisa de mais que
       * `.message`. */
      result?: unknown;
    }

    /**
     * Códigos de erro estáveis. Trate códigos desconhecidos como `"upstream_error"`.
     *
     * - `needs_reauth` — o token do conector expirou/foi revogado. O shell
     *   normalmente antecipa isso no carregamento com seu próprio prompt de reconexão,
     *   então não construa um banner sempre visível de reconexão; mantenha um fallback leve
     *   no frame ("Reconectar {server} em claude.ai Settings →
     *   Connectors") para lapsos no meio da sessão e prompts descartados/suprimidos.
     * - `server_not_connected` — não há conector executável com este nome de exibição
     *   para o visualizador atual. Também costuma ser antecipado pelo prompt
     *   do shell no carregamento; fallback no frame: "Adicionar {server} em
     *   claude.ai Settings → Connectors". Para um servidor `host:` isso também
     *   significa que esta superfície não tem ponte host (não está dentro do app Claude)
     *   ou o servidor local não está em execução — renderize o fallback sem host;
     *   o shell nunca pede isso.
     * - `selection_required` — o visualizador tem mais de um conector executável
     *   com esse nome de exibição e ainda não escolheu um. O shell
     *   pergunta ao visualizador para escolher no máximo uma vez por versão carregada
     *   do artefato (uma atualização ao vivo pode rearmar um prompt); se
     *   eles dispensarem o prompt, o erro pode persistir. Reduza ou recorra a uma vista degradada,
     *   como em `server_not_connected`.
     * - `server_not_found` — o servidor resolvido não existe mais no upstream.
     * - `server_unavailable` — servidor MCP upstream inacessível/5xx/timeout;
     *   transitório, marcado com `retryable: true`.
     * - `not_in_manifest` — `(server, tool)` está fora do manifesto publicado do frame
     *   (bug da página), ou fora do escopo que o visualizador consentiu: eles desligaram este conector para a página, ou
     *   o recusaram quando a primeira chamada nele perguntou. Renderize a seção desse conector
     *   como não permitida para esta visualização; não peça de novo em loop.
     * - `blocked_by_policy` — a ferramenta está no manifesto, mas a política da organização a bloqueia
     *   para este visualizador.
     * - `approval_required` — a política da organização exige aprovação por chamada para
     *   esta ferramenta e nenhuma foi dada; a aprovação por chamada ainda não é
     *   suportada em artefatos. Não é retryable sem ação do visualizador;
     *   renderize um estado degradado de "necessita aprovação". (Runtimes antigos
     *   degradam esse código para `upstream_error` pela regra de código desconhecido.)
     * - `tool_error` — a ferramenta executou, mas reportou falha. A chamada
     *   REJEITA com este código; o envelope completo vai no `result` da rejeição.
     *   (Falhas de ferramenta não resolvem mais com sinal `isError`.)
     * - `bad_request` — bug do chamador: `server`/`tool` não são strings, `input`
     *   não é serializável em JSON (ou argumentos não são structured-cloneable),
     *   registro duplicado de watch, limite de watches por visualização (64 —
     *   desinscreva watches não usados), ou método desconhecido em um shell antigo.
     * - `cancelled` — o `AbortSignal` da chamada disparou (resultado upstream
     *   DESCONHECIDO: a ferramenta pode ainda ter executado), ou, apenas para um servidor `host:`,
     *   o visualizador recusou a confirmação do app para uma chamada que não está anotada como somente leitura (essa chamada nunca executou). Sem signal
     *   isso é apenas o último caso.
     * - `rate_limited` — RESERVADO: nunca retornado hoje, mas trate assim mesmo.
     *   O shell recusou a chamada localmente (a página excedeu seu orçamento do conector). Espere `retryAfterMs` (ou alguns
     *   segundos), tente no máximo uma vez, nunca aperte um loop de polling.
     *   O throttling upstream continua em `server_unavailable`.
     * - `upstream_error` — qualquer outra coisa. Também é a forma de chamada sem resposta
     *   quando um shell estabelecido para de responder — após o orçamento de resposta anunciado pelo shell (~130 s por padrão). Também é a primeira
     *   chamada em um conector cuja consentimento o visualizador não pode dar naquele momento (outra prompt estava aberta, ou o prompt fechou antes de uma decisão): marcado como `retryable: true` com `retryAfterMs`, e
     *   essa chamada nunca chegou ao conector, então reemitir depois da espera é seguro mesmo para uma gravação — mas não é distinguível pela forma de outros `upstream_error` retryable, então uma gravação que não pode rodar duas vezes ainda espera uma nova ação do usuário. Em nível superior,
     *   uma página servida pela plataforma no host do artefato tem
     *   `window.claude`, e `use("mcp")` resolve esse mesmo namespace
     *   ali apenas quando a plataforma permite que o artefato atue como
     *   visualizador logado (a plataforma responde suas chamadas com estes mesmos
     *   códigos mais os dois códigos de nível superior abaixo; os servidores próprios do artefato do Claude não são alcançáveis ali) e `null` em caso contrário; qualquer outra cópia de nível superior não tem `window.claude`; um
     *   frame embutido mas não servido resolve `use("mcp")` como `null` em cerca de 10 s. Verifique a resolução de `use("mcp")`, nunca sondando
     *   com uma chamada.
     *
     * Códigos de ciclo de vida (do runtime em si, não do caminho do conector):
     * - `not_granted` — a sessão do visualizador não concedeu MCP a este
     *   frame; renderize a experiência sem MCP.
     * - `capability_disabled` — o MCP foi concedido, mas não é utilizável nesta
     *   visualização (o runtime que serve predatou isso, seu módulo falhou ao carregar,
     *   ou esse boot não tem ponte de conector); renderize a experiência sem MCP.
     * - `capability_removed` — o método chamado não faz parte do
     *   runtime que serve esta visualização; trate como `capability_disabled`.
     * - `transform_error` — os argumentos da chamada não puderam ser preparados;
     *   trate como `bad_request`.
     *
     * Códigos de nível superior (somente em uma página servida no topo no host do artefato;
     * nunca dentro de um visualizador):
     * - `consent_required` — o visualizador não permitiu este conector para
     *   este artefato ali: eles recusaram quando a chamada perguntou, ou a
     *   chamada esperou cerca de dez minutos por uma resposta (sua notificação "Review in Claude"
     *   fica aberta). A chamada nunca chegou ao conector. Renderize
     *   a seção do conector como não permitida com um jeito de tentar de novo,
     *   e chame de novo apenas com um gesto novo do usuário: essa chamada pede
     *   de novo, exceto que logo após uma recusa o runtime espera um silêncio curto
     *   (segundos, mais longo após recusas repetidas) antes de sua notificação subir, enquanto a chamada espera; em um
     *   handler {@link watchTool} trate como negação — o watch pede
     *   de novo por si só assim que o visualizador permite o conector ou volta para
     *   a aba.
     * - `user_changed` — a conta conectada neste host não é mais
     *   a do visualizador para o qual a página foi carregada; o runtime troca a página.
     *   Renderize nada da chamada e não faça mais chamadas.
     */
    type McpErrorCode =
      | "needs_reauth"
      | "server_not_connected"
      | "selection_required"
      | "server_not_found"
      | "server_unavailable"
      | "not_in_manifest"
      | "blocked_by_policy"
      | "approval_required"
      | "tool_error"
      | "bad_request"
      | "cancelled"
      | "rate_limited"
      | "upstream_error"
      | "not_granted"
      | "capability_disabled"
      | "capability_removed"
      | "transform_error"
      | "consent_required"
      | "user_changed";

    /** Um bloco de conteúdo em um {@link CallToolResult}. */
    type ContentBlock =
      | { type: "text"; text: string }
      | { type: "image"; data: string; mimeType: string }
      | { type: string; [k: string]: unknown };

    /** Resolução de {@link callTool} e o payload `data` de
     * eventos {@link watchTool} — o resultado da ferramenta. */
    interface CallToolResult {
      content: ContentBlock[];
      /** Present when the connector emits structured output. */
      structuredContent?: unknown;
      /**
       * Convenience: the JSON payload most connectors return —
       * `structuredContent` when present, else the first text block's
       * text parsed as JSON when it parses, else that text verbatim.
       * Read this instead of digging through `content`; the blocks
       * remain for images and multi-block results. (Text blocks no
       * longer carry a parsed `json` sibling — `payload` is its
       * documented home.)
       */
      payload?: unknown;
      /**
       * Present only when this resolution was served from the call
       * cache — shell-attested: the broker strips any inbound `cache`
       * field from upstream results before store and before delivery.
       * `storedAt` is when the served result was originally produced
       * (epoch ms) — drive "last updated" indicators for CACHED results
       * from it, never `Date.now()`; a result with no `cache` marker
       * executed fresh and may be stamped at receipt. `revalidating` is
       * `true` only on a
       * {@link watchTool} replay whose refresh is already in flight —
       * a newer delivery will follow. Absent = executed fresh (or an
       * older shell — treat as fresh). A result that is not a JSON
       * object (a bare string or array) cannot carry this marker and
       * always reads as fresh.
       */
      cache?: { storedAt: number; revalidating: boolean };
    }

    /** Advisory tool annotations — UNVERIFIED connector
     * self-description. Use to shape UX (labels, refresh affordances,
     * an in-page confirm before a destructive action), never as a
     * safety proof. A hint is present only when the connector
     * explicitly declared it; absent means the server did not say —
     * treat as unknown. */
    interface ToolAnnotations {
      /** The tool declares it does not modify state. Informs the
       * shell's caching policy for reads — see {@link CallToolOptions}. */
      readOnlyHint?: boolean;
      /** The tool may perform destructive (non-additive) updates. */
      destructiveHint?: boolean;
    }

    /** Uma ferramenta exposta por um servidor. */
    interface ToolInfo {
      name: string;
      description: string;
      /** Ausente como um todo em shells antigos, e para ferramentas cujo
       * servidor não declarou nada. */
      annotations?: ToolAnnotations;
    }

    /** Resposta de {@link describeTool}: uma ferramenta com seus JSON Schemas. */
    interface ToolDescription extends ToolInfo {
      /** Schema JSON do argumento `input` da ferramenta. */
      inputSchema: unknown;
      /** Schema JSON do `payload` da chamada, quando o servidor declara um. */
      outputSchema?: unknown;
    }

    /**
     * Um handle por servidor vindo de {@link server}: um método próprio por ferramenta listada
     * (qualquer nome de ferramenta válido — letras, dígitos, `_`, `.`, `-` — exceto
     * `then`, `toJSON` e membros de `Object.prototype`; alcance uma com hífen como `handle["get-doc"](input)`). Cada método recebe o `input` da ferramenta (e
     * {@link CallToolOptions}), resolve para o `payload` da chamada (veja
     * {@link CallToolResult}; o resultado inteiro quando nenhum payload é
     * derivável) e rejeita com o mesmo {@link McpError}
     * que {@link callTool} rejeitaria. O objeto é congelado; qualquer outra ferramenta continua
     * alcançável por {@link callTool}.
     */
    type ServerHandle = Readonly<
      Record<
        string,
        (input?: unknown, options?: CallToolOptions) => Promise<unknown>
      >
    >;

    /**
     * Connector auth posture — a CLOSED set, normalized by the runtime.
     * Treat any unrecognized value as `"unknown"` (an older shell can
     * forward a raw upstream string). A manifest server absent from
     * `servers` has no connector for this viewer — same fix copy as
     * `server_not_connected`.
     * - `"connected"` — no auth action needed (authenticated or
     *   no-auth); individual calls can still reject (e.g.
     *   `selection_required`, `blocked_by_policy`).
     * - `"needs_reauth"` — credentials lapsed; same fix copy as the
     *   `needs_reauth` error branch.
     * - `"unknown"` — status check degraded or newer state; do NOT
     *   render reconnect UI — branch on call-time codes.
     */
    type ServerAuthStatus = "connected" | "needs_reauth" | "unknown";

    /** Um conector que o visualizador conectou, intersectado com o
     * manifesto — ou, antes que o visualizador seja perguntado sobre ele, um que
     * a página declara (`authStatus: "unknown"`).
     *
     * ENDEREÇAMENTO (resolvido): `server` é o NOME DE EXIBIÇÃO do conector e
     * continuará assim — ele nunca aceitará um id de conector (ids são
     * fatos por conta de visualizador; uma página publicada roda para muitos
     * visualizadores). Se alguma vez for adicionada desambiguação assistida por máquina,
     * ela chega aditivamente como uma dica de opções que restringe a associação única
     * por nome por visualização (dicas conflitantes rejeitam `bad_request`) —
     * nunca resolução por chamada, nunca a posição `server`.
     * `ServerInfo` não carrega identificadores de conta do visualizador, URLs de ícone,
     * nem campos de procedência. Deliberado e estável. */
    interface ServerInfo {
      /** Connector display name — the `server` argument to {@link callTool}. */
      server: string;
      /** What kind of server this is: absent or `"connector"` — one of the
       * viewer's claude.ai connectors; `"artifact"` — one of Claude's own
       * servers for this artifact (no manifest entry, no viewer consent,
       * never bars public sharing; its tools act on this artifact only;
       * {@link watchTool}, {@link invalidate} and {@link CallToolOptions}
       * caching do not apply to it — keep live data on `use("db")`).
       * Older shells never list artifact servers. */
      kind?: "connector" | "artifact";
      authStatus: ServerAuthStatus;
      tools: ToolInfo[];
    }

    /** Resolução de {@link listTools}. */
    interface ListToolsResult {
      servers: ServerInfo[];
      /**
       * Present and `true` when a {@link callTool} input may carry a
       * {@link FileArgument} in this view (a full `listTools()` call only,
       * never the one-server form). Absent: an older viewer, or no file
       * route for this viewer and artifact — send the bytes inline
       * (base64 under the 1 MiB input limit) or hide the action.
       */
      fileArgs?: boolean;
    }

    /**
     * Um arquivo dentro do `input` de uma ferramenta: exatamente uma folha cujo objeto tem
     * este único membro, colocado onde a ferramenta quer o base64 do arquivo
     * (por exemplo `{title, base64Content: {$file: {...}}, contentMimeType}`).
     * O visualizador prepara os bytes na plataforma e a ferramenta recebe
     * a string em base64 no lugar da folha, então o limite de entrada de 1 MiB da chamada
     * não conta o arquivo. Limites: `data` no máximo 16 MiB, um
     * tipo de mídia aceito pela plataforma para staging, e `name` um nome de arquivo simples
     * com extensão (a plataforma recusa um que não combine com o tipo). Acima do
     * limite, malformado, ou duas folhas: `bad_request`. Sem rota de arquivo para
     * esta visualização ({@link ListToolsResult.fileArgs} ausente):
     * `capability_disabled`. Verifique `fileArgs` primeiro: um visualizador mais antigo
     * que argumentos de arquivo envia a folha sem seus bytes (ou
     * recusa um grande demais) e a ferramenta falha. Uma chamada com
     * arquivo é uma escrita: nunca em cache, nunca entrada de {@link watchTool}.
     */
    interface FileArgument {
      $file: {
        data: Blob | ArrayBuffer | ArrayBufferView;
        name: string;
        type: string;
      };
    }

    /** Opções para {@link callTool}. */
    interface CallToolOptions {
      /**
       * `false` — never cache this call, including where the read-only
       * default would apply.
       * Omitted — tools with a wire-explicit `readOnlyHint: true`
       * annotation default to `{staleTime: 0, gcTime: 5 min}`: the
       * result is stored (feeding {@link watchTool} replays and
       * coalescing with concurrent identical calls), and a repeat call
       * past `staleTime` executes fresh. Unannotated tools and
       * declared writes are never cached by default.
       * Object — opt in / tune. On tools with a wire-explicit
       * `readOnlyHint: false` annotation the object is ignored and the
       * call runs uncached (policy floor: a declared write can never
       * be cached or re-executed by cache machinery). Tools that do
       * not declare `readOnlyHint` behave as before: uncached unless
       * you opt in. Need confirmed-fresh data after an action?
       * `{cache: {refresh: true}}`.
       *
       * Freshness (fetchQuery semantics): a cached entry is served
       * only when younger than `staleTime` (your declared freshness);
       * older entries EXECUTE and resolve fresh. `callTool` never
       * serves anything past its declared freshness and never
       * revalidates in the background — a promise resolves once, so a
       * background result would have no delivery path. Keep data
       * current instead with {@link watchTool}, whose handler can hear
       * every refresh.
       *
       * Call identity is order-insensitive: `input` objects differing
       * only in property order are the same call, sharing one entry
       * and any in-flight execution. Cached per viewer + artifact;
       * successful results only; best-effort, size-bounded, cleared on
       * logout/account change/denial. Older shells ignore this option
       * (same call, uncached) — no feature detection needed.
       */
      cache?:
        | false
        | {
            /** Serve-without-execution window. Default 0; capped at
             * 300000 ms (5 min) — the cap bounds how long revoked
             * access keeps answering. */
            staleTime?: number;
            /** Entry lifetime. Default 300000 ms (5 min); capped at
             * 86400000 (24 h); zero/negative disables caching. */
            gcTime?: number;
            /** Skip the cache read: execute upstream, overwrite the
             * entry ("invalidate then call" in one flag). Failed
             * results still aren't stored — the previous entry remains
             * unless the failure was a denial. Ignored when not
             * caching. */
            refresh?: boolean;
          };
      /**
       * Aborta esta chamada. Mantida pelo runtime — nunca atravessa para o
       * shell; o abort rejeita rapidamente com `{code: "cancelled"}` e
       * cancela o processamento upstream com melhor esforço. Melhor esforço: a
       * ferramenta AINDA pode ter sido executada — trate uma chamada abortada como resultado desconhecido
       * e nunca passe um signal em uma ação de uma vez que você não pode disparar duas vezes.
       * (Uma chamada `host:` também pode rejeitar `cancelled` sem
       * signal — o visualizador recusou a confirmação do app; essa nunca
       * executou.) Um AbortSignal como `AbortSignal.timeout(ms)`,
       * quando disponível, é o mecanismo de prazo por chamada — deliberadamente não há
       * opção `timeoutMs`. Shells antigos ignoram o cancelamento: a promise ainda rejeita rapidamente.
       */
      signal?: AbortSignal;
    }

    /**
     * Faça isso uma vez, agora — o braço para AÇÕES. Chame uma ferramenta em um dos
     * conectores do visualizador. Serve um resultado em cache apenas quando é mais novo
     * que `staleTime` (sua frescura declarada); caso contrário, executa
     * e resolve fresco. Nunca serve dados obsoletos e nem revalida às suas costas —
     * uma promessa não ouve o refresh. Dados que devem permanecer atualizados?
     * Isso é {@link watchTool}.
     *
     * `server` é o nome de exibição do conector (por exemplo, `"Google
     * Calendar"`), não um UUID — ou `host:<name>` para um servidor local no
     * dispositivo do visualizador (veja a doc da namespace). `(server, tool)`
     * deve estar dentro do escopo que o visualizador consentiu ou a chamada
     * rejeita com `not_in_manifest`.
     *
     * `input` deve ser JSON simples: objetos, arrays, strings, números,
     * booleanos, `null`. `Map`/`Set`/`Date`/arrays tipados/`BigInt` rejeitam
     * com `bad_request`. Omitir para ferramentas sem argumentos. O único
     * valor não-JSON permitido é uma única folha {@link FileArgument}, quando
     * {@link ListToolsResult.fileArgs} é `true`.
     *
     * Resolve com {@link CallToolResult} — leia `result.payload` para
     * a resposta JSON. Uma falha de ferramenta REJEITA com
     * `{code: "tool_error"}`. Rejeita com {@link McpError}; nunca
     * lança sincronamente.
     *
     * @param server  Nome de exibição do conector.
     * @param tool    Nome da ferramenta conforme listado por {@link listTools}.
     * @param input   Objeto de argumentos serializáveis em JSON.
     * @param options Cache + cancelamento — {@link CallToolOptions}.
     */
    function callTool(
      server: string,
      tool: string,
      input?: unknown,
      options?: CallToolOptions,
    ): Promise<CallToolResult>;

    /** One event delivered to a {@link watchTool} handler. */
    type WatchEvent =
      | { type: "data"; result: CallToolResult }
      | { type: "error"; error: McpError };

    /** Returned by {@link watchTool}. Synchronous and idempotent: after
     * it returns, the handler never fires. */
    type Unsubscribe = () => void;

    /**
     * Mantenha estes dados atualizados — o braço para EXIBIÇÃO. Reexecuta a entrada em cache
     * imediatamente (marcada via `result.cache`; `revalidating:
     * true` quando o refresh já está em andamento — o único lugar onde um valor
     * fora de frescura é servido, porque este handler ouve a correção), executa quando a entrada
     * está ausente ou obsoleta, e entrega cada resultado mais novo para a identidade —
     * de suas próprias execuções, de polls `refetchInterval` (limitados a um piso ~30 s,
     * pausados enquanto a página está oculta com um refetch de recuperação
     * ao voltar, coalescidos por identidade para que N seções custem um único
     * voo), de outros chamadores em cache da mesma identidade (chamadas
     * que optam por NÃO cachear não alimentam watchers), e de
     * {@link invalidate}.
     *
     * Watch lê apenas — nunca ações de uma vez; ferramentas com a anotação
     * `readOnlyHint: false` explicitamente na rede rejeitam.
     *
     * Retorna um {@link Unsubscribe} SÍNCRONO. A primeira entrega
     * (incluindo replay) chega no mínimo em uma microtask após o registro — armazene o unsubscribe antes que algo possa disparar.
     * A única exceção síncrona nesta superfície: um `handler` não-função é um
     * `TypeError` (sem handler não há canal de evento para rotear a falha).
     *
     * TODAS as falhas chegam ao handler como eventos `{type: "error"}` —
     * incluindo falhas de registro (um `bad_request` de shell antigo
     * para método desconhecido, `not_granted`, limite de 64 watches por visualização): nenhuma atualização ao vivo chegará, e a página mantém
     * a experiência estática que já renderiza. Erros transitórios mantêm
     * os dados bons recentes visíveis; negações de autorização os retraem (veja as notas de design de falha acima).
     *
     * @param server  Nome de exibição do conector.
     * @param tool    Nome da ferramenta conforme listado por {@link listTools}.
     * @param input   Argumentos serializáveis em JSON (use `null` para
     *                ferramentas sem argumentos).
     * @param handler Recebe {@link WatchEvent}s até ser desinscrito.
     * @param options `cache` como em {@link callTool} (sem `refresh`);
     *                `refetchInterval` declara o polling, em ms.
     */
    function watchTool(
      server: string,
      tool: string,
      input: unknown,
      handler: (ev: WatchEvent) => void,
      options?: {
        cache?: { staleTime?: number; gcTime?: number };
        refetchInterval?: number;
      },
    ): Unsubscribe;

    /**
     * Drop cached {@link callTool} results (this artifact + viewer only).
     * Each argument narrows the scope, and `undefined` is the same as
     * omitting it: `invalidate()` = all; `(server)` = one connector;
     * `(server, tool)` = one tool, any input; a non-`undefined` `input` =
     * one exact argument set, matched by the cache's order-insensitive
     * call identity (`null` and `{}` both mean the input-less call —
     * unlike callTool, where an `undefined` input is also that same
     * call). `input` requires `server` and `tool` (else `bad_request`).
     * Once resolved, a matching callTool re-executes, and matching
     * WATCHED identities re-execute and deliver — call after a write so
     * cached reads refetch.
     *
     * Old shells reject `bad_request` ("unknown method"); old runtimes
     * `capability_removed`. Treat any rejection as nothing-cached and
     * continue.
     */
    function invalidate(
      server?: string,
      tool?: string,
      input?: unknown,
    ): Promise<void>;

    /**
     * Liste os conectores chamáveis a partir deste frame: o manifesto publicado do frame
     * intersectado com os conectores que o visualizador atual
     * realmente conectou. Chame no carregamento para adaptar a UI ao que está disponível
     * antes de chamar {@link callTool}. Um conector sobre o qual o visualizador ainda não foi
     * perguntado aparece apenas a partir do manifesto — `authStatus:
     * "unknown"`, nomes de ferramentas declarados, descrições vazias, sem
     * anotações — e a primeira chamada {@link callTool} ou {@link watchTool}
     * nele pergunta ao visualizador (a chamada espera a resposta); listagem
     * nunca pergunta.
     *
     * Campos de seleção de conector duplicado nunca chegam às páginas, mas o
     * estado pendente é observável: um conector duplicado, ainda não escolhido,
     * aparece aqui com conjunto vazio de ferramentas (como um conector não conectado
     * faz) até que o visualizador escolha, e {@link callTool} rejeita com
     * `selection_required`. Renderize a mesma visão degradada usada para
     * `server_not_connected`.
     *
     * Com `server`, lista esse servidor ou nenhum. Os servidores próprios do Claude
     * para este artefato (`kind: "artifact"`) aparecem primeiro quando presentes; um
     * que o shell não consegue ler agora é omitido da lista (pergunte
     * {@link server} para ver por quê).
     *
     * Rejeita com {@link McpError}; nunca lança sincronamente.
     */
    function listTools(server?: string): Promise<ListToolsResult>;

    /**
     * Um handle para um servidor — um conector do manifesto, ou um dos
     * servidores próprios do Claude para este artefato — cujos métodos são as
     * ferramentas listadas ({@link ServerHandle}):
     *
     *     const data = await mcp.server("artifacts_data");
     *     await data.set({ path: "tasks/t1", data: { title: "Ship it" } });
     *     const { docs } = await data.query({ collection: "tasks" });
     *
     * Rejeita `server_not_connected` quando não há servidor com esse nome
     * alcançável nesta visualização ou ele lista sem ferramentas chamáveis (em um
     * shell antigo isso é todos os servidores de artefato), `needs_reauth` para um
     * conector que lista nesse estado, e em caso contrário com
     * {@link McpError} como {@link listTools} faz.
     */
    function server(name: string): Promise<ServerHandle>;

    /**
     * Descrição de uma ferramenta e seus JSON Schemas. Respondido para os servidores próprios do artefato do Claude; um nome de conector rejeita `bad_request`, e um
     * shell antigo rejeita também um servidor de artefato (`bad_request`, ou
     * `capability_disabled` sem ponte de conector) — trate qualquer
     * rejeição como "nenhum schema disponível".
     */
    function describeTool(
      server: string,
      tool: string,
    ): Promise<ToolDescription>;
  }
}

interface ClaudeCapabilityMap {
  mcp: typeof Claude.mcp;
}
