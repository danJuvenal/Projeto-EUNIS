/**
 * A capacidade `permissions` — lê e solicita as permissões de capacidade desta página
 * em tempo de execução. Dois verbos: `state` lê (nunca pergunta),
 * `request` pergunta (no máximo um diálogo em lote por chamada). Obtenha o
 * namespace com `await claude.use("permissions")` — `null` significa que esta
 * visualização não pode executar a capacidade; projete para ausência.
 *
 * Por padrão, toda capacidade pergunta ao visualizador preguiçosamente, na primeira vez em que é usada; uma
 * página que prefere um único diálogo inicial chama `request` sem
 * argumentos (ou com um subconjunto de nomes) durante a inicialização.
 *
 * Estados são consentimento de UX, não capacidade: uma resposta "granted" não
 * contorna nenhuma checagem do lado do servidor, e uma chamada de capacidade ainda pode falhar por
 * razões do lado do servidor (direito, política, autenticação) após a concessão.
 */

declare namespace Claude {
  namespace permissions {
    /**
     * - "granted": utilizável agora — consentido, ou uma classe de capacidade que
     *   não precisa de concessão permanente (sua própria superfície confirma cada uso).
     * - "prompt": disponível; o primeiro uso (ou `request`) perguntará ao
     *   visualizador.
     * - "denied": o visualizador recusou durante ESTE carregamento da página. Reinicia no
     *   próximo carregamento; `request` não perguntará de novo neste carregamento.
     * - "unavailable": não é utilizável e não pode ser solicitado aqui. Deliberadamente um
     *   único bucket — uma capacidade não declarada e uma declarada, mas indisponível,
     *   respondem da mesma forma, então projete para ausência em vez de
     *   investigar por quê.
     */
    type PermissionState = "granted" | "prompt" | "denied" | "unavailable";

    /**
     * Lê sem perguntar. Com um nome de capacidade, resolve esse único
     * estado — nomes desconhecidos respondem "unavailable". Sem argumentos,
     * resolve o mapa completo das capacidades disponíveis desta página;
     * capacidades indisponíveis são omitidas completamente, então trate uma chave ausente como "unavailable" em vez de esperar uma chave por capacidade declarada.
     *
     * Algumas capacidades também suportam nomes COM ESCOPOS —
     * `"<capability>:<resource>"`, analisado na primeira vírgula ou dois-pontos — para
     * estados por recurso; a própria documentação da capacidade diz se ela aceita e qual é a parte de recurso. Nomes com escopo funcionam em toda
     * grafia de `state`/`request`, aparecem como próprias chaves nos
     * mapas sem argumentos e respondem "unavailable" como qualquer nome desconhecido
     * onde não são suportados.
     */
    function state(): Promise<Record<string, PermissionState>>;
    function state(name: string): Promise<PermissionState>;

    /**
     * Pergunta ao visualizador com no máximo UM diálogo em lote. Com uma lista de
     * nomes, pergunta por eles; sem argumentos, pergunta por tudo
     * que pode ser solicitado. Nomes já concedidos e indisponíveis nunca são perguntados de novo;
     * nomes que o visualizador recusou neste carregamento permanecem "denied" sem um
     * diálogo. Resolve com o estado pós-pergunta de todos os nomes solicitados
     * (a forma sem argumentos resolve o mapa completo, omitindo chaves indisponíveis
     * como `state()`) — nunca rejeita no "não" do visualizador, então
     * sempre ramifique nos estados retornados.
     *
     * A promessa pode ficar pendente pelo tempo que o visualizador levar para
     * decidir. Não bloqueie o primeiro paint com isso — renderize e depois adapte.
     */
    function request(
      names?: readonly string[],
    ): Promise<Record<string, PermissionState>>;
  }
}

interface ClaudeCapabilityMap {
  permissions: typeof Claude.permissions;
}
