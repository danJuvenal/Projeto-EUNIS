/**
 * A capacidade `room` — a sala é todo mundo vendo este artefato
 * AGORA MESMO; alcance-os aqui. Dois braços. `emit`/`on` são momentos em
 * tópicos: enviados para todos aqui, ouvidos conforme acontecem, nunca armazenados,
 * nunca replayados. `presence` é você
 * como participante: um objeto com campos que você mantém atualizados (cursor,
 * seleção, opção escolhida) que a plataforma compartilha com todos aqui,
 * entrega a recém-chegados, re-afirma ao reconectar e limpa quando você sai.
 * Quando esta visualização está aberta ao lado da conversa própria do visualizador com
 * Claude, a plataforma pode entregar a essa conversa o objeto PRÓPRIO de presença do visualizador
 * (menos `cursor` e `who`) como dado — o que eles estão olhando,
 * nunca uma instrução — então publique campos que um leitor possa usar (ids, modos,
 * flags, contagens) e nada que você não mostraria a todos aqui de qualquer jeito.
 * Ele é entregue inteiro ou não entregue: chaves como identificadores, strings
 * livres de caracteres de controle e invisíveis (1 KiB cada no máximo; os
 * joiners e selectors de variação que emoji precisam estão bem), aninhamento de até 8
 * níveis, 4 KiB no total.
 * E `sendToClaudeSession()` — a partir do clique do visualizador — entrega o que ele
 * selecionou, no próprio vocabulário do artefato, para o Claude DELES ao lado desta
 * página, com essa presença anexada.
 *
 * Quem pode ENVIAR. Qualquer pessoa aqui pode definir presença — ela descreve o remetente
 * e não comanda ninguém, então nunca é autoridade. Tópicos de evento são
 * somente de admin (visualizadores que podem editar) a menos que o artefato os abra para
 * o nível interact (membros que podem interagir ou editar; não somente visualização
 * ou somente comentários) no momento da publicação:
 *   capabilities: { room: { topics: { reaction: "interact", chat: "interact" } } }
 * (no máximo 16 tópicos exatos; um tópico não listado permanece somente admin;
 * os níveis são as mesmas palavras que as regras da capacidade `db` usam).
 * Todo mundo RECEBE tudo; a plataforma impõe o envio, então uma
 * mensagem que um visualizador não pode enviar nunca chega e as páginas não precisam de checagem de papel.
 * `admin` é exatamente o que a capacidade `user` responde em `canEdit()`:
 * aplique controles somente de admin nisso de antemão; `not_permitted` é o último recurso.
 * O estado que move a sala que um participante RECÉM-ENTRADO também precisa ver (a apresentação do apresentador,
 * a rodada em andamento, a resposta revelada) por isso pertence a um
 * documento `db` (`db.doc("live/state")`, gravação admin pela regra
 * { path: "live", write: "admin" }) que cada visualização assina com
 * `onSnapshot` quando `db` está disponível para a visualização — escrito uma vez,
 * entregue ao vivo para todos aqui e lido por quem chega; sem tópico,
 * sem loop de reenvio. Um comando momentâneo
 * que ninguém que chega depois precisa ("limpar quadro", "confetti") vai
 * em um tópico somente admin, nunca em presence. Sem `db`, seguidores
 * lembram o `peer` da última mensagem desse tipo e o remetente re-emite
 * quando `onPeers` reporta `joined` (eventos não são replayados) e em um intervalo lento; coloque um epoch em `data` se dois escritores puderem competir.
 *
 * Quem está aqui. Visualizadores conectados à mesma organização (`kind: "viewer"`), além de — quando
 * o servidor o admite (em gate de flag, desligado por padrão) — a sessão Claude Code
 * que publicou esta página, como peer de agente (`kind: "agent"`,
 * nunca `isMe`). O cliente da sessão que publica agrupa o que ouve
 * e pode descartar momentos além de um orçamento, então ele lê um resumo, nunca um fluxo contínuo: envie resumos, não streams. Visualizadores fora da organização
 * e qualquer outro agente não podem conectar na v1 (um agente, caso contrário,
 * narra por `db`). Renderize uma página completa de um único visualizador desde o início e deixe a sala acender isso. Se um visualizador que NÃO está na sala tiver que ver isso eventualmente, não é dado da sala — grave em `db`
 * ou publique uma versão com `artifact`. Uma nova versão recarrega cada visualização
 * e esvazia a sala. Obtenha o namespace com
 * `await claude.use("room")`; `null` significa que esta visualização não pode se conectar —
 * projete para ausência.
 */
declare namespace Claude {
  namespace room {
    /** JSON simples — um sinal, nunca um documento. */
    type Json = unknown;
    /** ^[a-z][a-z0-9_.-]{0,47}$ — seu próprio vocabulário, SEM DOIS PONTOS (tipos da plataforma
     *  carregam dois pontos, então nenhum visualizador pode forjar um). */
    type Topic = string;
    /** Sincrônico, idempotente; nada dispara depois que ele retorna. Cada
     *  registro é independente: a mesma função registrada duas vezes é
     *  dois listeners com dois unsubscribes. */
    type Unsubscribe = () => void;
    /** O callback de erro final que todo listener aceita (a mesma
     *  assinatura da capacidade `db`). Dispara NO MÁXIMO UMA VEZ, e todo
     *  código que chega aí é terminal para esse listener. Omitir e uma
     *  falha da sala é silenciosa — um canal indisponível nunca é
     *  exceção no seu handler. */
    type OnError = (e: { code: RoomErrorCode; message: string }) => void;

    /** Carimbado pela plataforma em tudo que é entregue; impossível de falsificar nas páginas.
     *  Identidade e eco, nada sobre privilégio (o envio é imposto
     *  antes da entrega, então a identidade reivindicada DENTRO dos dados ou da presença
     *  vale nada, e não há papel para verificar).
     *  - `peer` — rótulo opaco para um DOCUMENTO ABERTO deste artefato: um
     *    visualizador com duas abas é dois peers. O MESMO rótulo na página de todos,
     *    então ele pode viajar nos dados para endereçar alguém ("lower hand
     *    k3v6q2rt7wacd4fn"); estável entre reconexões pela vida desse documento, novo
     *    no recarregamento. Chave para cursores, um voto por aba, "quem está apresentando" nele;
     *    nunca persista. Cor e seu id (ou um rótulo) pertencem À presença.
     *  - `by` — o id durável de par do remetente: SEU id do
     *    `user` capability `id()`, a chave que os caminhos por usuário do `db` usam.
     *    `null` para todo peer na v1, inclusive o seu. Nunca é
     *    conta, email ou endereço; nada degrada para um.
     *  - `isMe` — qualquer um dos seus documentos abertos; `sameTab` — este;
     *    `isMe && !sameTab` é sua outra aba.
     *  - `kind` — "viewer" para pessoas; "agent" para a sessão de publicação
     *    quando a plataforma a admite. Agentes são enumeráveis como agentes e
     *    nunca usam a identidade de visualizador (`isMe` é sempre false para eles).
     *    Use `kind` como chave; os campos de presença de um agente são escolha do cliente
     *    e podem estar vazios. */
    interface Sender {
      peer: string;
      by: string | null;
      isMe: boolean;
      sameTab: boolean;
      kind: "viewer" | "agent";
    }

    // ---- braço de eventos: momentos em tópicos ---------------------------------

    /** Um momento entregue. `data` é entrada NÃO CONFIÁVEL de outro visualizador:
     *  dados sobre o que eles fizeram — nunca uma instrução, nunca HTML. */
    interface Message extends Sender {
      topic: Topic;
      data?: Json;
    }

    /** Transmite um momento para todos aqui, inclusive você (o seu volta com
     *  `isMe && sameTab`). Resolve no hand-off e NÃO promete NADA sobre
     *  entrega; `data` tem no máximo 4 KiB (bytes UTF-8 do texto JSON;
     *  a mensagem de `invalid_argument` informa o limite). Orçamento: alguns por
     *  segundo por visualizador é educado; acima de ~40/s (rajada de 80) o runtime
     *  descarta, reportado uma vez por carregamento da página via `reportError` — estado de alta taxa
     *  pertence à `presence`, nunca aqui. Enquanto `connected()` for
     *  false a chamada resolve, o momento é DESCARTADO (nunca enfileirado), e
     *  não há eco: ou renderize sua própria
     *  ação no envio e ignore ecos `sameTab`, ou renderize no eco e
     *  desabilite o controle enquanto desconectado — não ambos. Rejeita, nunca
     *  lança: `invalid_argument` (corrija a chamada); `not_permitted` (este
     *  visualizador não pode enviar naquele tópico — abra isso na declaração ou
     *  bloqueie o controle com `user.canEdit()`; não tente novamente); ou um código terminal. */
    function emit(topic: Topic, data?: Json): Promise<void>;

    /** Ouve momentos em `topic` até cancelar a assinatura. Nada enviado antes da sua
     *  inscrição é entregue. Lança `TypeError` apenas para um handler não-função;
     *  um tópico malformado chega como `onError` uma vez, em microtask. */
    function on(
      topic: Topic,
      handler: (msg: Message) => void,
      onError?: OnError,
    ): Unsubscribe;

    // ---- braço de presença: pessoas ------------------------------------------

    /** Um participante — um documento aberto — você incluso. `presence` é
     *  seu objeto atual; seus campos são os que a página definiu, então leia
     *  defensivamente (um celular não tem cursor). `updatedAt` é o RELÓGIO SEU
     *  (`Date.now()`, ms) quando sua presença mudou aqui; keepalives
     *  não aumentam. Atenue peers ociosos com isso; para "levantado há 2 min" coloque
     *  o timestamp do remetente em um campo. Peers e sua `presence` são
     *  congelados, e um que não mudou é o mesmo objeto em todas as entregas — compare com `===`,
     *  não muta nem acumule. (A capacidade `db` faz a mesma promessa sobre snapshots.) */
    interface Peer extends Sender {
      presence: Readonly<Record<string, Json>>;
      updatedAt: number;
    }

    /** Mescla `patch` no objeto DE PRESENÇA SEU: por campo, o valor mais recente vence;
     *  um `null` de topo remove o campo; nenhum campo que você define é ignorado.
     *  Aplicado localmente de uma vez (o cursor se move sem round-trip) e
     *  enviado coalescido, completo, cerca de 30 vezes por segundo — chame isso em cada
     *  `pointermove` se quiser. O objeto FUNDIDO SEU (não o patch) deve
     *  ficar dentro de 4 KiB de texto JSON (bytes UTF-8); um patch que excederia isso rejeita
     *  `invalid_argument` e não é aplicado. Envie estado absoluto ("em 0.42, 0.31"), nunca deltas.
     *  Se você publicar a presença dos visualizadores, renderize a de todos, com um "você" marcado.
     *  A v1 não entrega nomes e `by` é `null`, então identifique-se NA presença: coloque
     *  o `user.id()` que você AWAITOU ali (declare `user: {scopes: ["profile"]}`; `user: {}` dá ids, mas não nomes)
     *  e deixe cada página resolver os ids na tela com
     *  `user.profiles(ids)` — nomes e avatares como SEU visualizador os vê
     *  (`p.name || "Someone"`), em vez de confiar em um nome que outra página enviou; um apelido digitado e uma cor na presença são o
     *  fallback quando `user` não está declarado ou `id()` é `null`. De qualquer forma,
     *  são dados de exibição, não confiáveis como tudo aqui, nunca
     *  autoridade.
     *  Não há ordenação entre sua presença e seus eventos. Rejeita,
     *  nunca lança, como `emit` menos `not_permitted`. */
    function presence(patch: Record<string, Json | null>): Promise<void>;

    /** Todos aqui agora, você incluso (assim que a plataforma responde, com
     *  `presence: {}` até você definir uma, presente mesmo enquanto desconectado).
     *  Um getter síncrono, nunca um Promise: o MESMO snapshot congelado até
     *  algo mudar (um array vazio congelado até a primeira resposta) —
     *  passe direto para `useSyncExternalStore`, ou leia a cada frame.
     *  Completo até cerca de 256 peers; além disso, um limite inferior (eventos
     *  ainda chegam para todos). */
    function peers(): readonly Peer[];

    /** A sala mudou. No máximo uma vez por frame de animação, carregando o novo
     *  snapshot E a mudança líquida desde a última entrega, então as páginas nunca
     *  fazem diff: três atualizações por um peer em um frame são uma única entrada `updated`;
     *  joined-e-left no mesmo frame é nenhum. `change.peers ===
     *  room.peers()`. A PRIMEIRA entrega (não antes de uma microtask —
     *  guarde o unsubscribe primeiro) apresenta a sala até então como `joined`,
     *  você incluso, e mais `joined` seguem por um ou dois segundos conforme outros
     *  respondem — não renderize "sozinho" a partir da primeira chamada. Na reconexão, o
     *  runtime reasserta você e reconcilia a sala; você não reenvia nada.
     *  (`joined`/`updated`/`left` é o `added`/`modified`/`removed` da capacidade `db`,
     *  nas palavras deste domínio.) */
    interface PeersChange {
      peers: readonly Peer[];
      joined: readonly Peer[];
      left: readonly Peer[];
      updated: readonly Peer[];
    }
    function onPeers(
      handler: (change: PeersChange) => void,
      onError?: OnError,
    ): Unsubscribe;

    // ---- para o próprio Claude do visualizador, a partir do clique ------------------

    /** O que `sendToClaudeSession` carrega: UM objeto JSON simples cujos campos este
     *  artefato define — o que o visualizador selecionou ou perguntou, no seu próprio
     *  vocabulário, por exemplo `{selectedText, blockId}` ou `{chartId, series,
     *  point}`. O Claude o recebe inteiro, como dado desta página (nunca como
     *  as palavras do visualizador, nunca como instrução), ao lado do objeto atual de `presence`
     *  sem `cursor` e `who`, que a plataforma anexa sozinha onde esta visualização repassa presença (nenhum
     *  enquanto você não definiu nada, ou definiu um passado dos limites da presença,
     *  acima) — então não repita o que a presença já diz;
     *  deixe as anotações do seu artefato para o Claude explicar como ler ambos.
     *  Limites: no máximo 4 KiB de texto JSON, aninhamento de no máximo 8 níveis contando
     *  o próprio objeto, no máximo 64 chaves por objeto e 64 entradas por
     *  array, e em qualquer string sem caracteres de controle além de tab,
     *  newline e carriage return, sem caracteres de uso privado e sem caracteres de formato
     *  ou invisíveis (hífens suaves, marcas bidi, espaços zero-width e similares) exceto emoji e joiners de script e seletores de variação
     *  onde um caractere os carrega (nunca em sequências, no máximo
     *  oito) — então remova caracteres de formato do texto selecionado pelo visualizador
     *  antes de enviá-lo (`getSelection()` frequentemente carrega esses caracteres); e chaves que são identificadores simples
     *  (`[A-Za-z_][A-Za-z0-9_-]*`, no máximo 64, nunca `prototype`
     *  ou um nome que `Object.prototype` carrega — a mesma regra das chaves de presença
     * ); qualquer coisa fora disso é recusada
     *  inteira (`invalid_argument`). Caracteres invisíveis de formatação em
     *  valores são descartados no caminho para o Claude. Uma chave é lida pela
     *  plataforma: uma `label` opcional no topo (um nome curto para o que
     *  foi selecionado, "Heading block", "Q3 revenue chart") mostrada ao visualizador
     *  ao lado do próprio título do artefato, cortada para 120 caracteres ali; ela continua
     *  sendo parte dos dados que o Claude lê. */
    type ToClaude = { label?: string } & { [key: string]: Json };

    /** Para onde um envio foi — uma pista para sua própria confirmação ("Na sua conversa
     *  — envie quando estiver pronto"), não um recibo do que o visualizador ou o Claude fizeram
     *  com ele: "pane" — a conversa ao lado desta página a levou;
     *  "session" — a plataforma está enviando para uma sessão Claude deste
     *  visualizador que ela já sabe conter o artefato; "new" — a plataforma está
     *  enviando para o próprio Claude do visualizador sem uma sessão em mãos: uma sessão
     *  deles que ela então encontra, ou uma conversa que ela inicia (ou leva esta
     *  página para). "session" e "new" só seguem `{deliver: "send"}` com
     *  nada aberto ao lado da página; o que aconteceu então chega no callback
     *  `status`.
     *  `id` nomeia este envio naquele callback: presente apenas com "session"
     *  ou "new", e nunca em uma plataforma antiga. Trate um `to` não reconhecido como "pane". */
    interface SentTo {
      to: "pane" | "session" | "new";
      id?: string;
    }

    /** Um passo de um `{deliver: "send"}` que a plataforma tomou para o
     *  Claude do visualizador (`SentTo.to` "session" ou "new"), informado ao callback
     *  `onStatus` desse envio: `working` — a caminho, ainda não foi recebido por ninguém;
     *  `sent` — uma sessão ou nova conversa do visualizador a recebeu;
     *  `failed` — não chegou a nenhum Claude, com `reason` dizendo por quê em um conjunto fechado
     *  que a plataforma documenta (`signed_out`, `reauth`,
     *  `refused`, `unavailable`, `unconfirmed`, e mais; trate um que você não conhece como `unavailable`);
     *  um `sent` posterior substitui um `failed`, e um estado pode ser informado mais de uma vez. `shell` nomeia a build da plataforma
     *  que informou isso, para sua própria telemetria. Um estado que você não reconhece
     *  não muda o que você mostra. Não espere chamadas quando `SentTo` não carregava `id`. */
    interface SendStatus {
      state: "working" | "sent" | "failed";
      reason?: string;
      shell?: string;
    }

    /** Como `sendToClaudeSession` entrega `data`. `deliver` (padrão
     *  "stage"): "stage" — aparece no compositor do visualizador como um anexo que
     *  eles podem ver e remover, e nada chega ao Claude até o visualizador enviar
     *  sua própria mensagem com ele; "send" — para um controle cujo objetivo é que o Claude atue nisso agora (um botão
     *  "Build this now"): a plataforma mostra ao visualizador o que esta página está prestes a
     *  enviar e pergunta, em sua própria caixa de diálogo, se deve enviar; o "Enviar" deles
     *  inicia a vez do Claude com `data` como a mensagem inteira (encapsulada como vinda desta página, nunca como palavras deles), o "Cancelar" descarta
     *  isso, e uma plataforma que não consegue perguntar (uma antiga, ou uma conversa
     *  que não pode assumir uma rodada agora) o coloca em stage em vez disso. Com nada
     *  aberto ao lado da página, um "send" de um dos tipos de página próprios da plataforma vai para o próprio Claude do visualizador — uma sessão deles
     *  que tem o artefato, ou uma nova conversa deles, ou uma conversa que esta página deixa para --
     *  na própria tecla do visualizador naquela página; outras páginas ouvem `claude_unavailable` ali, como em "stage".
     *  A chamada resolve quando a plataforma o tomou, antes do visualizador
     *  decidir ou a conversa responder — então, com "send", diga sua própria confirmação para qualquer resultado ("Enviado para Claude — verifique a
     *  conversa"), ou passe `onStatus` para ouvir como um envio que a plataforma ela mesma tomou foi para o Claude (`SendStatus`), como o `onText` do `sample` ouve uma resposta. Trate um `deliver` não reconhecido como
     *  "stage"; a plataforma faz isso. */
    interface SendToClaudeSessionOptions {
      deliver?: "stage" | "send";
      /** Chamado a cada etapa de um envio que a plataforma tomou para o
       *  Claude do visualizador (`SentTo` "session" ou "new"); nunca para um que
       *  a conversa ao lado da página tomou, nem para um envio em stage. Mantido na
       *  página; nada disso atravessa a plataforma. */
      onStatus?: (status: SendStatus) => void;
    }

    /** Resposta de `canSendToClaudeSession` — se um `sendToClaudeSession`
     *  pode passar por esta visualização agora. Um snapshot, não uma assinatura: verifique de novo
     *  quando (re)mostrar o controle, e trate um valor não reconhecido como
     *  indisponível.
     *  - "available" — ofereça o controle: uma conversa ao lado desta
     *    página o pega.
     *  - "available_if_summoned" — nada está aberto ao lado da página, mas um
     *    `{deliver: "send"}` vai para o próprio Claude do visualizador (`SentTo`
     *    "session" ou "new"); um envio em stage continua `claude_unavailable`.
     *    Ofereça um controle que envia, não um que coloca em stage.
     *  - "no_session" — nada ao lado desta visualização o aceitaria agora
     *    (a página não está aberta ao lado de uma conversa com o Claude).
     *  - "unsupported" — este navegador não consegue provar o clique do visualizador à
     *    plataforma (a maioria consegue); esconda o controle em vez de mostrar um que
     *    sempre falha.
     *  - "off" — o envio para o Claude não é oferecido nesta visualização. */
    type CanSendToClaudeSession =
      | "available"
      | "available_if_summoned"
      | "no_session"
      | "unsupported"
      | "off";

    /** Entregue algo ao PRÓPRIO Claude do VISUALIZADOR — a conversa aberta
     *  ao lado desta página — com a autorização deles: chame isso A PARTIR do clique ou tecla
     *  pressionada do visualizador no seu controle, de forma síncrona (nada awaited antes), na
     *  namespace que você obteve com `await claude.use("room")` na inicialização; o gesto é comprovado pela própria chamada, e uma chamada
     *  fora dele é recusada. Por padrão ele COLOCA EM STAGE: `data` aparece no compositor do
     *  visualizador como um anexo que eles podem ver e remover, nomeado para
     *  este artefato (com seu `label`, quando dado), um envio mais novo desta
     *  página o substitui, e nada chega ao Claude até o visualizador enviar
     *  sua própria mensagem; com `{deliver: "send"}` a plataforma em vez disso pede
     *  ao visualizador para enviá-lo agora, ou, com nada aberto ao lado de um de seus próprios
     *  tipos de página, o leva ao próprio Claude do visualizador
     *  (`SendToClaudeSessionOptions`). Não existe forma de uma página iniciar
     *  a vez do Claude sozinha: o próprio Enter do visualizador ou a resposta deles ao
     *  diálogo da plataforma fazem isso. Para os tipos de página próprios da plataforma, cujo código
     *  é da própria plataforma, a tecla pressionada do visualizador no controle da página é
     *  essa resposta: a plataforma pode enviar `{deliver: "send"}` sem o diálogo ao lado de uma conversa,
     *  e faz isso para cada tipo de página quando leva o envio ao próprio Claude do visualizador. Para escrever
     *  um comentário e
     *  trazer o Claude para seu thread, use a capacidade `comments` e seu
     *  `sendToClaude`. Resolve `SentTo` assim que a plataforma o tomou. Rejeita, nunca lança: `invalid_argument`
     *  (não é um objeto simples, está vazio ou fora dos limites acima — `message`
     *  diz qual; nada foi enviado), `claude_unavailable` (sem gesto comprovável, ou nada ao lado desta visualização o aceita; nada foi enviado:
     *  mantenha o rascunho do visualizador e reavalie `canSendToClaudeSession`),
     *  `rate_limited` (os envios são limitados a uma cadência humana; tente novamente
     *  em seguida), ou `upstream_error`. Independente da conexão da sala:
     *  funciona enquanto `connected()` é false e após erro terminal, porque vai para a conversa do visualizador, não
     *  para a sala. Quando a plataforma antecede o método, a chamada
     *  rejeita (`capability_removed`, ou `invalid_argument` nomeando um método desconhecido de uma plataforma metade antiga — não é bug da página então)
     *  e não envia nada: bloqueie o controle em `canSendToClaudeSession`, não no código. */
    function sendToClaudeSession(
      data: ToClaude,
      options?: SendToClaudeSessionOptions,
    ): Promise<SentTo>;

    /** Se `sendToClaudeSession` pode passar para este visualizador agora:
     *  chame antes de renderizar seu controle e habilite o controle apenas
     *  em "available" (qualquer `deliver`) ou "available_if_summoned"
     *  (`deliver: "send"` apenas); em qualquer outro valor ou qualquer rejeição (uma plataforma que
     *  antecede o método rejeita `capability_removed` ou
     *  `invalid_argument`), esconda-o. Não publica nada ao Claude, nunca
     *  pergunta, barato por render; a resposta pode mudar após o carregamento, então
     *  verifique de novo ao (re)mostrar o controle. */
    function canSendToClaudeSession(): Promise<CanSendToClaudeSession>;

    // ---- conexão: falha aberta, mas visível ----------------------------

    /** Você está falando com alguém agora? Uma FUNÇÃO síncrona —
     *  mantenha os parênteses. `false` no carregamento é normal (true em cerca de
     *  um segundo); reconexões breves são normais (a plataforma atualiza a
     *  conexão periodicamente); trate apenas uma borda true-to-false que
     *  persiste ~2 s como desconexão.
     *  `false` também pode ser permanente: um visualizador que a plataforma não consegue conectar
     *  recebe `not_granted` uma vez em cada listener de `onError` e em toda
     *  chamada (o par `sendToClaudeSession` exceto) — seu caminho terminal,
     *  nunca um spinner ligado a isso. */
    function connected(): boolean;
    /** Dispara uma vez com o estado atual logo após o registro (não
     *  antes de uma microtask), depois a cada mudança. */
    function onConnection(
      handler: (connected: boolean) => void,
      onError?: OnError,
    ): Unsubscribe;

    /** `emit`/`presence`/`sendToClaudeSession` rejeitam com estes — como
     *  Promises, nunca throws síncronos. Listeners recebem apenas os
     *  terminais, uma vez, via `onError`.
     *  - `invalid_argument` — gramática do tópico, JSON não válido ou valores exóticos, muito
     *    profundos, acima do limite de bytes, ou não é função onde uma é
     *    necessária; `message` diz qual. Bug da página: corrige a chamada.
     *  - `not_permitted` — `emit` apenas, veja acima. Bug de declaração.
     *  - `upstream_error` — transitório ou desconhecido; não terminal, seguro para descartar.
     *  - `claude_unavailable` / `rate_limited` — apenas `sendToClaudeSession`, veja
     *    ali; não terminal.
     *  Terminal para esta carga da página — todo listener ouve um e morre,
     *  chamadas rejeitam com ele depois (`sendToClaudeSession` e
     *  `canSendToClaudeSession` excepcionais), `peers()` decai para só você,
     *  `connected()` lê false; renderize a página de único visualizador uma vez e
     *  não editorialize (o app ao redor possui a mensagem de acesso):
     *  - `revoked` — a concessão desta visualização foi RETIRADA enquanto executava (acesso
     *    ou compartilhamento mudou). uma pausa da plataforma do canal NÃO é isso:
     *    ela lê como `connected() false` e se recupera. Mesmo código, mesmo
     *    significado, em `db`.
     *  - `not_granted` — nunca concedido: este visualizador não pode ser conectado.
     *  - `capability_disabled` / `capability_removed` / `transform_error` --
     *    ciclo de vida. Trate um código desconhecido como `upstream_error`. */
    type RoomErrorCode =
      | "invalid_argument"
      | "not_permitted"
      | "upstream_error"
      | "claude_unavailable"
      | "rate_limited"
      | "revoked"
      | "not_granted"
      | "capability_disabled"
      | "capability_removed"
      | "transform_error";
  }
}

interface ClaudeCapabilityMap {
  room: typeof Claude.room;
}
