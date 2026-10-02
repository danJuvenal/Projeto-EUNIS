/**
 * A capacidade `comments` — escreve threads de comentários neste artefato a partir
 * da própria interface da página, como o visualizador atual.
 *
 * Uma página que oferece seus próprios controles de comentário (um botão "Adicionar comentário"
 * em um cartão, um controle de nota marginal) declara
 * `capabilities: {comments: {}}` e chama esses verbos; cada thread que ela
 * grava cai no único armazenamento compartilhado de comentários do artefato — o armazenamento
 * que o modo de comentários do shell `claude.ai` renderiza — rotulado como escrito via
 * o artefato. Um artefato declarante é interno à organização e não pode
 * ser compartilhado publicamente — exceto na forma somente compositor,
 * `capabilities: {comments: {"composer_only": true}}`, que concede
 * SOMENTE {@link Claude.Comments.openComposer} e
 * {@link Claude.Comments.anchorFor} (os verbos de escrita rejeitam
 * `not_granted` e {@link Claude.Comments.canSendToClaude} resolve
 * `"off"`), nunca solicita consentimento e mantém o artefato
 * compartilhável publicamente. Qualquer uma das formas pode adicionar `"customAnchors": true`,
 * o que concede {@link Claude.Comments.customAnchors}: a página posiciona
 * os pinos de comentário por si mesma, para conteúdo que o shell não consegue ancorar.
 * A página nunca detém uma credencial: o shell
 * executa cada gravação com a conta do próprio visualizador, e a atribuição é
 * marcada pela plataforma, nunca tomada da página.
 *
 * SOMENTE LEITURA por design: não existe verbo para listar, ler, editar ou observar
 * threads — o modo de comentários do shell já mostra todas as threads para
 * todos que podem comentar neste artefato e atualiza após cada gravação bem-sucedida a partir desta página, e
 * o texto postado é final (ninguém pode editá-lo depois, inclusive o visualizador).
 * Não construa a própria lista de threads da página em cima dessas chamadas; ofereça
 * o recurso de escrita, confirme no local e deixe o shell exibir o thread.
 * (Uma página {@link Claude.Comments.customAnchors} recebe apenas âncoras de thread, para posicionar os pinos.) Mantenha um `threadId` retornado
 * somente se a página for agir novamente sobre esse thread nesta visita
 * — nada o devolve mais tarde.
 *
 * O consentimento é do visualizador, por artefato, solicitado na PRIMEIRA gravação: o
 * shell segura essa chamada e mostra ao visualizador uma solicitação, então ela pode ficar
 * pendente enquanto eles decidirem. Chame os verbos de escrita,
 * openComposer e compose apenas a partir de um gesto deliberado do visualizador,
 * nunca no carregamento ou em um temporizador (registrar
 * {@link Claude.Comments.customAnchors} no carregamento está bem: ele não grava
 * nada). Obtenha o namespace com
 * `await claude.use("comments")` — `null` significa que esta visualização não pode executar
 * a capacidade; projete para ausência.
 */

declare namespace Claude {
  /**
   * Design de falha — leia antes de escrever qualquer ponto de chamada. Duas falhas são
   * ROTINEIRAS:
   *
   * - `consent_required` — o visualizador ainda não permitiu que esta página
   *   comente em seu nome. Um prompt descartado não é mostrado novamente durante este
   *   carregamento da página — chamadas repetidas resolvem `consent_required` em silêncio — então
   *   mantenha o texto do rascunho na própria interface da página, diga que o comentário não foi
   *   postado e nunca faça loop ou re-chame em um temporizador.
   * - `forbidden` — este visualizador não pode comentar pela página: ele
   *   optou por não permitir, não tem acesso ou o artefato não declara mais
   *   a capacidade. PERMANENTE para esta visualização — permitir novamente
   *   só acontece no próprio painel de comentários do visualizador em claude.ai,
   *   nunca na página: esconda ou desabilite os recursos de escrita a partir de então,
   *   com texto que diga que a comentário pela página está desativado aqui
   *   em vez de dizer que algo falhou. Em `resolve`/`delete` pode significar também
   *   que o visualizador não tem alcance de moderação sobre esse único
   *   thread (só seu criador ou um editor do artefato tem acesso) —
   *   desabilite o controle desse thread, não o comentário como um todo.
   *
   * O restante é excepcional: ramifique a UX no código do erro `code`, nunca no
   * texto da mensagem; retente apenas `unavailable` e `upstream_error`, no máximo
   * uma vez após um pequeno atraso aleatório e somente a partir de um gesto novo do visualizador
   * — uma gravação rejeitada NÃO prova que nada foi escrito, então nunca
   * a reenvie sem supervisão; trate `rate_limited` como sinal para desacelerar
   * a própria cadência da página, nunca como retry-loop.
   */
  namespace comments {
    /**
     * Forma de rejeição para todo método. Ramifique em `.code`; `.message`
     * é legível para humanos, mas não localizado.
     */
    interface CommentsError {
      code: CommentsErrorCode;
      message: string;
    }

    /**
     * Códigos de erro estáveis. Trate códigos desconhecidos como `"upstream_error"` —
     * mas note que os códigos de ciclo de vida abaixo são PERMANENTES para a visualização:
     * nunca tente novamente.
     *
     * - `consent_required` — o visualizador ainda não permitiu comentários escritos pela página
     *   neste artefato. Consulte a nota de design de falha acima.
     * - `forbidden` — o visualizador não pode escrever comentários pela página
     *   (recusado, sem acesso, ou sem mais declaração), ou não tem alcance de moderação
     *   sobre o único thread que um `resolve`/`delete` nomeou.
     * - `invalid` — os argumentos foram rejeitados: texto vazio ou só com espaços,
     *   texto acima de 4 KiB como UTF-8 ou com caracteres de controle
     *   diferentes de quebras de linha e tabs, uma âncora ou `threadId` malformados,
     *   ou argumentos que não são dados simples. Corrija a chamada; não tente novamente.
     * - `not_found` — o thread não existe (foi apagado, está em outro
     *   artefato, ou nunca foi visível para este visualizador — não é distinguível).
     * - `rate_limited` — escrevendo demais; reduza o ritmo.
     * - `unavailable` — comentários não podem ser usados nesta visualização agora
     *   (o serviço está temporariamente degradado, a capacidade de comentar está desligada para
     *   este artefato, ou o prompt de consentimento não pôde ser exibido). Uma
     *   nova tentativa a partir de um gesto novo é razoável; se repetir, esconda
     *   os recursos de escrita para esta visita.
     * - `upstream_error` — qualquer outra coisa: falha transitória, ou uma
     *   condição que a repetição não corrige (o limite de threads ou respostas do artefato
     *   — projete para threads deliberadas, iniciadas pelo visualizador, não uma por elemento).
     *   Se a única repetição repetir, pare e diga ao visualizador. Também é a forma de chamada sem resposta quando o shell para de responder.
     * - `claude_unavailable` — somente {@link Comments.sendToClaude}: o
     *   comentário não pôde ser enviado para Claude nesta visualização, decidido ANTES
     *   de qualquer coisa fosse escrita, então NADA foi postado. O visualizador não é um
     *   editor do artefato, nenhuma sessão de Claude pôde recebê-lo, a
     *   chamada não veio do gesto recente do próprio visualizador, ou o envio
     *   para Claude está desligado aqui. Ao contrário de `unavailable`, os
     *   métodos simples {@link Comments.create} / {@link Comments.reply} continuam utilizáveis:
     *   mantenha o rascunho, ofereça o comentário simples e reavalie
     *   {@link Comments.canSendToClaude} antes de oferecer o envio novamente.
     *
     * Códigos de ciclo de vida (do próprio runtime, não do caminho de escrita) —
     * permanentes para esta visualização, nunca reutilizáveis:
     * - `not_granted` — a sessão do visualizador não concedeu `comments` a
     *   esta página do artefato (artefato não declarado, ou uma visualização que não pode
     *   comentar); renderize a página sem seus recursos de escrita. Em
     *   {@link Comments.customAnchors}: a declaração servida não carrega `"customAnchors": true` (não declarado, ou desligado
     *   aqui); execute a página com ancoragem do shell.
     * - `capability_disabled` — concedido, mas não utilizável nesta visualização (o
     *   runtime de serviço é anterior a ele, ou seu módulo falhou ao carregar);
     *   trate como `not_granted`.
     * - `capability_removed` — o método chamado não faz parte do
     *   runtime que serve esta visualização; trate como `capability_disabled`.
     * - `transform_error` — os argumentos da chamada não puderam ser preparados;
     *   trate como `invalid`.
     */
    type CommentsErrorCode =
      | "consent_required"
      | "forbidden"
      | "invalid"
      | "not_found"
      | "rate_limited"
      | "unavailable"
      | "upstream_error"
      | "claude_unavailable"
      | "not_granted"
      | "capability_disabled"
      | "capability_removed"
      | "transform_error";

    /**
     * Onde um thread fica na página — o vocabulário de posicionamento que
     * o próprio clique para comentar do shell produz, para que o marcador de um thread posicionado pela página
     * seja renderizado exatamente onde um thread posicionado pelo shell ficaria. Obtenha-o
     * em {@link Comments.anchorFor} e passe-o intacto; os campos são dados de posicionamento para o shell,
     * então trate o objeto como opaco e nunca o persista como dado de layout.
     */
    interface Anchor {
      path: string;
      x: number;
      y: number;
    }

    /** Forma de resolução para {@link Comments.create}. */
    interface CreateResult {
      /** O identificador do novo thread — o identificador que {@link Comments.reply},
       * {@link Comments.resolve} e {@link Comments.delete} usam. */
      threadId: string;
      /** O comentário de abertura do thread. Informacional. */
      commentId: string;
    }

    /** Forma de resolução para {@link Comments.reply}. */
    interface ReplyResult {
      /** O comentário anexado. Informacional. */
      commentId: string;
    }

    /**
     * O que {@link Comments.sendToClaude} grava: um NOVO thread em `anchor`
     * (como {@link Comments.create} faria), ou uma resposta em `threadId` (como
     * {@link Comments.reply} faria) — exatamente um dos dois, com as mesmas regras de texto.
     */
    type SendToClaudeTarget =
      | { anchor: Anchor; text: string }
      | { threadId: string; text: string };

    /** Forma de resolução para {@link Comments.sendToClaude}: o comentário
     * foi postado E enviado para Claude (a plataforma confirmou o envio e
     * notificou as sessões do Claude que observam o artefato; uma resposta chega ao thread mais tarde, não neste resultado). */
    interface SendToClaudeResult {
      /** O thread em que foi escrito — novo (forma anchor) ou o nomeado. */
      threadId: string;
      /** O comentário postado. Informacional. */
      commentId: string;
    }

    /**
     * Resolução de {@link Comments.canSendToClaude} — se
     * {@link Comments.sendToClaude} pode prosseguir para este visualizador agora.
     * Uma foto instantânea, não uma assinatura: reavalie ao (re)mostrar o
     * controle. Trate qualquer valor não reconhecido como indisponível.
     *
     * - `available` — ofereça "Enviar para Claude".
     * - `writers_only` — o visualizador pode comentar, mas não é editor do
     *   artefato; ofereça apenas o comentário simples.
     * - `no_session` — nenhuma sessão de Claude pôde recebê-lo agora.
     * - `off` — o envio para Claude não é oferecido nesta visualização.
     */
    type CanSendToClaude = "available" | "writers_only" | "no_session" | "off";

    /**
     * Onde {@link Comments.openComposer} abre o compositor do shell:
     * exatamente um entre Element ou Range, ambos conectados ao documento atual
     * no momento da chamada. O texto selecionado de um Range vira a citação
     * do compositor quando cabe nos limites do span da plataforma;
     * uma seleção grande ou incomum cai silenciosamente para o elemento que a contém
     * — a abertura em si nunca falha por isso. O alvo é tomado como dado; o atributo
     * `data-comment-target` da página, que ancora o clique próprio do visualizador em modo de comentário em qualquer lugar
     * dentro de um elemento marcado para ele, não se aplica aqui.
     */
    type ComposerTarget = { element: Element } | { range: Range };

    /**
     * Forma de resolução para {@link Comments.openComposer}. `opened:
     * false` é uma recusa suave, não um erro: o visualizador não está
     *engajado no artefato no momento (a página não está focada — abra a partir do próprio gesto do visualizador na página e ele estará),
     * o shell está protegendo um compositor que o visualizador já abriu
     * com texto digitado, o alvo está dentro de um subárvore que a página
     * marcou como `data-uncommentable`, ou, enquanto um registro
     * {@link Comments.customAnchors} está ativo, a chamada fechou um compositor vazio ou um cartão de thread aberto em vez de
     * abrí-lo (isso conta como clique do visualizador). Não faça nada — nunca
     * tente de novo em loop.
     */
    interface OpenComposerResult {
      opened: boolean;
    }

    /** Um ponto no documento do artefato em pixels CSS, com deslocamento de rolagem
     * incluído (`pageX`/`pageY`; retângulo do cliente mais `scrollX`/`scrollY`). */
    interface DocPoint {
      x: number;
      y: number;
    }

    /**
     * Um thread como o shell o revela para uma página
     * {@link Comments.customAnchors} — nunca seu texto, autores ou
     * contagens de respostas, que o shell renderiza. Threads ancoradas pelo
     * próprio clique para comentar do shell (âncoras de caminho CSS) também são listadas:
     * posicione as âncoras que a página reconhece, deixe as demais sem posicionamento.
     */
    interface OverrideThread {
      /** Um identificador válido somente para este registro (para
       * {@link CustomAnchors.open} e {@link CustomAnchors.placed}); não é um id do armazenamento, então não pode alimentar os verbos de escrita. Correlacione um thread
       * que a página criou pela string da âncora. */
      id: string;
      /** A âncora do thread, literalmente: um nome que a página passou para
       * {@link CustomAnchors.compose}, um caminho {@link CustomAnchors.domAnchor}
       * ou uma âncora de CSS do shell que a página nunca gerou. */
      anchor: string;
      resolved: boolean;
      /** Verdadeiro no único thread cujo cartão o shell abriu. */
      active: boolean;
    }

    /**
     * Argumento opcional do terceiro parâmetro de {@link CustomAnchors.compose} e os campos opcionais de uma resposta
     * de {@link CustomAnchorsCallbacks.move}.
     * `label` e `detail` são texto simples de no máximo 1024 unidades UTF-16
     * cada (mais rejeita `invalid`; vazio significa nenhum); o shell
     * colapsa espaços em branco, remove caracteres de controle e invisíveis e
     * mantém no máximo 128 bytes do label e 512 do detail em UTF-8, ou nada quando não resta letra ou dígito.
     * Ambos são armazenados somente junto a um caminho {@link CustomAnchors.domAnchor}: ao lado de um nome inventado pela página,
     * a plataforma mantém apenas o nome (é o que Claude depois lê como local do thread, então mantenha os nomes legíveis), embora o compositor aberto mostre o label e um "Enviar para Claude" a partir dele leve os dois.
     */
    interface ComposeOptions {
      /** As palavras curtas da própria página para o ponto ("Gráfico de receitas, barra do Q3"), mostradas como a localização do thread e citadas para Claude,
       * onde a plataforma exibe rótulos de localização. */
      label?: string;
      /** Uma linha mais longa do que o ponto ou área desenhada cobre (os
       * elementos dentro de um retângulo desenhado, por exemplo), mantida para Claude
       * em vez de exibida no cartão. */
      detail?: string;
      /** A âncora é uma área que o visualizador acabou de desenhar, não um ponto: sobre
       * um compositor aberto ela move o compositor para a nova âncora, incluindo texto digitado, e sobre um cartão de thread aberto ela abre o compositor em vez de apenas recolher o cartão. */
      area?: boolean;
    }

    /** Uma resposta de {@link CustomAnchorsCallbacks.move}: a nova âncora do thread, formatada e validada como os argumentos de {@link CustomAnchors.compose}. */
    interface MoveResult extends ComposeOptions {
      anchor: string;
      at: Element | DocPoint;
    }

    /**
     * Os callbacks que {@link Comments.customAnchors} recebe. O shell
     * os executa muitas vezes por sessão; logo após o registro, o
     * estado atual (`mode(true)`, `composing(true)`, lista de threads)
     * também é entregue. Exceções lançadas dentro de um callback são capturadas
     * e descartadas — mantenha-os baratos e infalíveis.
     */
    interface CustomAnchorsCallbacks {
      /** O modo de comentários começou ou terminou — pelo visualizador no shell,
       * ou iniciado pela própria página via {@link CustomAnchors.compose}. Enquanto
       * estiver ligado, trate cliques em pontos comentáveis como gestos de comentário e
       * mantenha os relatórios de {@link CustomAnchors.placed} atualizados; enquanto desligado,
       * pare (um controle visível que chama compose pode permanecer). Um post
       * mantém o modo ligado e abre o cartão postado; o modo termina quando
       * o visualizador sai dele ou em {@link CustomAnchors.exitMode}. */
      mode: (on: boolean) => void;
      /** O conjunto completo atual de threads ancoradas na página sendo
       * exibido (no máximo 256), substituindo a lista anterior; reenviado quando
       * uma entrada muda (criada, movida, resolvida, apagada, cartão aberto
       * ou fechado) ou a página mostrada muda. Enviado apenas em sessões que
       * o visualizador entrou a partir dos controles do shell — uma sessão que
       * a página iniciou com compose não recebe nada, mesmo depois de seu rascunho
       * postar — então remova a lista e seus identificadores em `mode(false)`. */
      threads: (list: OverrideThread[]) => void;
      /** O visualizador abriu o thread `id` pelo lado do shell (sua
       * lista de comentários, por exemplo): traga esse assunto do thread para a vista —
       * enquanto registrado, o shell nunca rola o artefato em si.
       * Entregue apenas para identificadores na lista atual e somente depois
       * do primeiro relatório de {@link CustomAnchors.placed}. A página
       * possui esse scroll, então respeite `prefers-reduced-motion`. */
      reveal: (id: string) => void;
      /** O compositor novo de comentário do shell abriu (`true`) ou fechou
       * (`false`); fica `true` durante toda a sessão para um visualizador que não pode postar
       * aqui. Uma página que desenha a seleção de área do visualizador mantém isso na tela enquanto isso lê true e limpa em false. */
      composing?: (open: boolean) => void;
      /** Fornecer isso permite que o criador do thread arraste o pino para um novo
       * ponto. Ao soltar, o shell o chama com um identificador da lista atual e o ponto de queda; responda em cerca de dois segundos,
       * diretamente ou com uma promessa, a nova âncora para esse ponto, ou
       * `null` para recusar (o pino volta). Uma resposta que falharia as regras de argumento de {@link CustomAnchors.compose}, uma rejeição ou uma exceção recusa também. O shell armazena a nova âncora e
       * reenvia a lista de threads. */
      move?: (
        id: string,
        at: DocPoint,
      ) => MoveResult | null | Promise<MoveResult | null>;
    }

    /** O controlador que {@link Comments.customAnchors} resolve.
     * Depois de {@link CustomAnchors.release}: compose e open rejeitam
     * `invalid`, placed e exitMode não fazem nada, areas lê false. */
    interface CustomAnchors {
      /**
       * Abre o compositor novo de comentário do shell para um NOVO thread ancorado
       * em `anchor` — a sobreposição de {@link Comments.openComposer}, com
       * as mesmas regras de gesto (gesto deliberado do visualizador, artefato
       * em foco, limitados por taxa), recusa suave e rejeições. `anchor`
       * é o nome durável da própria página para o ponto (um id de forma, um carimbo de tempo de vídeo, uma referência de célula): não vazio, no máximo 128 bytes em UTF-8, sem caracteres de controle ou invisíveis, senão `invalid`; ou um caminho de {@link CustomAnchors.domAnchor}. Nunca é dado de layout. Sob
       * a declaração somente compositor, somente caminhos domAnchor são mantidos, então
       * um nome rejeita `invalid` ali. `at` posiciona o compositor: um
       * Element conectado (um dentro de um subárvore `data-uncommentable`
       * resolve `{opened: false}`) ou um {@link DocPoint}. Não há forma de texto de intervalo.
       *
       * Enquanto um registro está ativo, essa chamada É o clique do visualizador:
       * sobre um compositor vazio aberto ou cartão de thread aberto, ela o fecha e
       * resolve `{opened: false}` (chame novamente para posicionar); um compositor
       * com texto digitado é deixado em paz (`{opened: false}`) a menos que
       * `opts.area` o mova. Um rascunho que o visualizador recolheu sem enviar
       * reabre aqui pré-preenchido, com cursor no fim — a única forma do visualizador
       * voltar a ele.
       */
      compose(
        anchor: string,
        at: Element | DocPoint,
        opts?: ComposeOptions,
      ): Promise<OpenComposerResult>;
      /**
       * O visualizador pediu para abrir o thread `id` a partir da própria interface da página
       * (clicou no assunto, por exemplo; os pinos do shell abrem seus cartões por si só): peça ao shell para abrir o cartão desse thread na
       * posição que a página relatou, ou em `at`. Resolve quando enviado, não quando aberto: o shell ignora um identificador que não está na
       * lista atual ou já aberto, nunca fecha um compositor com texto digitado ou um cartão em envio para ele, e silenciosamente descarta aberturas
       * além da taxa de {@link Comments.openComposer}. Rejeita `invalid` para
       * um id ou ponto malformados.
       */
      open(id: string, at: Element | DocPoint): Promise<void>;
      /**
       * Informe onde cada pino do thread listado pertence, identificador para ponto.
       * Cada chamada SUBSTITUI o relatório anterior; threads listadas ausentes
       * dela são recolocadas e exibidas na própria lista de comentários do shell
       * em vez disso. Relate após cada callback de threads, com um mapa vazio
       * incluído (o primeiro relatório também diz ao shell que a página está
       * escutando), e novamente após qualquer coisa que mova os assuntos —
       * re-renderização, relayout, pan, zoom, redimensionamento; a rolagem da janela é
       * reprojetada para você.
       */
      placed(map: Record<string, DocPoint>): void;
      /**
       * Para pontos comentáveis que são elementos reais do DOM: construa
       * `[anchor, point]` para `el` na gramática do caminho CSS o shell usa para o próprio clique para comentar, para que threads do shell e da página em um mesmo elemento compartilhem a mesma âncora. Passe o evento do ponteiro para ancorar no ponto do gesto em vez do centro do elemento.
       * Lança `TypeError` para um elemento fora do documento — um bug da página,
       * não um {@link CommentsError}.
       */
      domAnchor(
        el: Element,
        ev?: { clientX: number; clientY: number },
      ): [anchor: string, at: DocPoint];
      /**
       * Peça ao shell para sair do modo de comentário na própria ação de saída da página
       * (o visualizador escolheu outra ferramenta da página, por exemplo). Uma
       * solicitação, não uma mudança de estado: o shell confirma por meio
       * de `mode(false)` e recusa enquanto qualquer compositor tiver texto não enviado
       * ou um envio estiver em andamento; fora do modo de comentário, não faz nada.
       */
      exitMode(): void;
      /**
       * Termina a sobreposição: o próprio clique para comentar do shell e
       * a ancoragem retornam; descarta os identificadores. Idempotente. Registre novamente
       * com {@link Comments.customAnchors} para assumir a ancoragem de volta.
       */
      release(): void;
      /**
       * Se um comentário ancorado por área poderia ser iniciado agora:
       * falso fora do modo de comentários, para um visualizador que não pode postar aqui,
       * enquanto um envio está em andamento e após release.
       * Ofereça um gesto de desenho de área somente enquanto lida true; um
       * sinal `area` enviado de outra forma é ignorado.
       */
      readonly areas: boolean;
    }
  }

  /**
   * Os verbos `comments`. Cada método resolve com sua
   * forma documentada ou rejeita com {@link comments.CommentsError}; nenhum
   * lança exceção síncrona. O texto é texto simples — quebras de linha permitidas, sem
   * marcação renderizada, no máximo 4 KiB como UTF-8; limite a entrada da página para
   * corresponder. Escrever "@Claude" no texto fornecido pela página NÃO traz Claude
   * para o thread; a única maneira da página enviar um comentário para Claude é
   * {@link Comments.sendToClaude}, para editores do artefato.
   */
  interface Comments {
    /**
     * Abre o próprio compositor de novo comentário do claude.ai ancorado em
     * `target` — exatamente o que acontece quando o visualizador entra no modo de comentário
     * e clica ali. A página NÃO envia NADA: digitação, envio,
     * atribuição e exibição ficam no shell, então este verbo não precisa
     * de prompt de consentimento. Use-o para tornar o comentário descoberto pela
     * própria interface da página (um item "Comentário" em um menu de contexto, um botão em um
     * cartão); chame-o apenas a partir de um gesto deliberado do visualizador — nunca no
     * carregamento, em um temporizador ou em um loop (aberturas programáticas são
     * limitadas por taxa: rejeições `rate_limited` significam desacelerar).
     *
     * Resolve `{opened: true}` quando o compositor abriu, e a recusa suave `{opened: false}` quando o shell recusou perturbar um
     * compositor com texto digitado pelo visualizador (veja
     * {@link comments.OpenComposerResult}). Rejeita `unavailable` quando
     * esta visualização não tem interface de comentários para abrir (o visualizador não pode comentar
     * aqui, ou comentários estão desligados) — trate isso como permanente para esta visualização
     * e esconda o recurso; `invalid` para um alvo que não é um
     * Element conectado ou Range.
     *
     * Disponível em AMBAS as formas de declaração — a completa
     * `capabilities: {comments: {}}` e a forma somente compositor
     * `capabilities: {comments: {"composer_only": true}}`. Declare
     * somente compositor quando a página quiser apenas este verbo de entrada (e
     * {@link Comments.anchorFor}): os verbos de escrita então rejeitam
     * `not_granted`, nenhum consentimento é pedido, e — ao contrário de uma declaração completa — o artefato continua compartilhável publicamente.
     */
    openComposer(
      target: comments.ComposerTarget,
    ): Promise<comments.OpenComposerResult>;

    /**
     * Constrói a {@link comments.Anchor} para `el`. Executa no lado da página e
     * nunca solicita; a geometria do elemento é lida no momento da chamada, então chame-a no
     * momento do gesto do visualizador sobre o elemento que ele está comentando, depois passe o resultado direto para
     * {@link Comments.create}. Rejeita `invalid` somente quando `el` não é um
     * elemento anexado ao documento atual.
     */
    anchorFor(el: Element): Promise<comments.Anchor>;

    /**
     * Inicia um novo thread em `anchor` com o texto inicial `text`, escrito como
     * o visualizador atual. A primeira gravação em um artefato pode ficar pendente
     * enquanto o shell pede consentimento ao visualizador. No sucesso, a exibição de comentários do shell
     * pega o thread.
     */
    create(opts: {
      anchor: comments.Anchor;
      text: string;
    }): Promise<comments.CreateResult>;

    /** Anexa uma resposta ao thread `threadId`, como o visualizador atual. Mesmas
     * regras de consentimento e texto que {@link Comments.create}; um thread desconhecido ou apagado rejeita `not_found`. */
    reply(threadId: string, text: string): Promise<comments.ReplyResult>;

    /**
     * Publica um comentário E o envia para Claude, exatamente como o visualizador pressionando
     * "Enviar para Claude" no compositor de comentários do claude.ai faria: um novo
     * thread em `anchor` ou uma resposta em `threadId`, após o que Claude
     * é trazido para o thread e responde lá. Somente editores do
     * artefato e só a partir do gesto recente do próprio visualizador — chame
     * {@link Comments.canSendToClaude} primeiro e habilite o controle apenas em
     * `"available"` (esconda-o, ou mostre-o desabilitado com a razão,
     * caso contrário). Mesmas regras de consentimento, texto e thread (e as
     * mesmas rejeições `consent_required` / `forbidden` / `invalid` / `not_found` /
     * `rate_limited`) que {@link Comments.create} e
     * {@link Comments.reply}; adicionalmente rejeita `claude_unavailable`
     * quando o envio não pode prosseguir — decidido antes de qualquer coisa ser
     * escrita, então nada foi postado e os verbos de escrita simples ainda
     * funcionam. Os envios são limitados a uma cadência humana: `rate_limited` significa desacelerar.
     * Quando a plataforma é anterior a este método, ela rejeita
     * `capability_removed` e não posta nada.
     */
    sendToClaude(
      target: comments.SendToClaudeTarget,
    ): Promise<comments.SendToClaudeResult>;

    /**
     * Se {@link Comments.sendToClaude} pode prosseguir para este visualizador
     * agora (veja {@link comments.CanSendToClaude}). Chame-o antes
     * de renderizar um controle "Enviar para Claude" e habilite o controle apenas em
     * `"available"`; em qualquer outro valor, ou qualquer rejeição (quando a
     * plataforma é anterior a este método ela rejeita `capability_removed`),
     * esconda-o ou mostre-o desabilitado com a razão. Não posta nada, nunca
     * pergunta e é barato de chamar em cada render do controle; a resposta pode mudar após o carregamento (sessões de Claude observando são aprendidas
     * de forma assíncrona), então reavalie ao (re)mostrar o controle.
     */
    canSendToClaude(): Promise<comments.CanSendToClaude>;

    /**
     * Marca um thread como resolvido (`resolved: true`) ou o reabre (`false`).
     * Executa com o alcance de moderação do próprio visualizador: um visualizador que não podia
     * resolver este thread no shell também não pode resolvê-lo na página
     * (rejeita `forbidden`). Idempotente — resolver um thread já resolvido
     * funciona sem mudança.
     */
    resolve(threadId: string, resolved: boolean): Promise<void>;

    /**
     * Apaga um thread e todas as respostas nele. IRREVERSÍVEL, e executa
     * com todo o alcance de moderação do visualizador — um visualizador que pode apagar
     * threads de outras pessoas no shell também as apaga aqui.
     * Ofereça isso apenas por trás de uma ação deliberada e confirmada do visualizador em um
     * thread nomeado; nunca o chame em massa, no carregamento ou a partir de uma lógica da página
     * que o visualizador não acionou diretamente.
     */
    delete(threadId: string): Promise<void>;

    /**
     * Assume a ANCORAGEM de comentários do shell, para conteúdo cujas
     * âncoras por caminho CSS não podem seguir — cenas canvas e WebGL, linhas do tempo de vídeo,
     * documentos gerados cujo DOM re-renderiza. As âncoras viram strings opacas que a página inventa e depois reconhece; a página
     * faz sua própria detecção de clique, decide onde cada pino do thread vai e
     * relata isso, e o shell desenha o pino ali e continua renderizando
     * cada cartão, compositor e lista, enquanto sua própria clique para comentar,
     * anel de hover e cursor do pino ficam inativos dentro do artefato. A
     * página não desenha pinos próprios (destacar o assunto está bem).
     *
     * Requer `"customAnchors": true` adicionado a qualquer uma das formas de declaração
     * form: `capabilities: {comments: {"customAnchors": true}}`
     * (a forma completa: verbos de escrita sob consentimento) ou
     * `{comments: {"composer_only": true, "customAnchors": true}}`
     * (sem consentimento, sem verbos de escrita da página; mantém nenhum nome de âncora inventado pela página,
     * então {@link comments.CustomAnchors.compose} aceita apenas caminhos de
     * {@link comments.CustomAnchors.domAnchor} ali). Sem isso
     * a chamada rejeita `not_granted`. Se uma publicação for recusada com
     * `capabilities.comments: unavailable`, remova apenas
     * `"customAnchors": true` da declaração, republicar e executar
     * a página com ancoragem do shell. Um callback obrigatório ausente
     * rejeita `invalid`, e o mesmo acontece em um segundo registro antes de
     * {@link comments.CustomAnchors.release}.
     */
    customAnchors(
      callbacks: comments.CustomAnchorsCallbacks,
    ): Promise<comments.CustomAnchors>;
  }
}

interface ClaudeCapabilityMap {
  comments: Claude.Comments;
}
