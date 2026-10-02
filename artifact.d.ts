/**
 * A capacidade `artifact` — publicação de artefato: esta página escreve EM SI MESMA
 * publicando uma nova versão (`publish`). SOMENTE DOCS AO VIVO: em um artefato
 * criado pela plataforma como documento ao vivo (nem a página nem sua declaração
 * escolhem isso), as edições são anexadas em vez disso, por `edit` ou pelos
 * gestos do visualizador na marcação (`sync`); veja esses membros.
 *
 * A página entrega ao shell um `index.html` completo de substituição — ou, em um
 * artefato multiarquivo, apenas os arquivos alterados — e o shell
 * publica como uma nova versão imutável do mesmo artefato com a própria autoridade
 * do visualizador; todas as visualizações abertas recarregam ao vivo para ela (uma
 * publicação de arquivos deixa a visualização de publicação em execução — veja {@link publish}). Obtenha
 * o namespace com `await claude.use("artifact")` — `null` significa que esta visualização
 * não pode executar a capacidade; uma visualização somente leitura ainda resolve o
 * namespace, e seus verbos de escrita aparecem como códigos de rejeição
 * (`not_granted` / `not_writer`), nunca como `null`.
 */

declare namespace Claude {
  /**
   * Design de falha — leia antes de escrever qualquer ponto de chamada. Uma publicação é uma
   * gravação com pré-condições reais, e duas de suas falhas são ROTINEIRAS:
   *
   * - `conflict` — outra pessoa (outro visualizador, ou a própria sessão de edição do autor)
   *   publicou entre o carregamento desta página e esta chamada.
   *   Este não é um estado de erro para se desculpar: o shell já está
   *   recarregando todas as visualizações abertas para a versão vencedora, então o correto
   *   é quase sempre não fazer nada além de abortar a IU local
   *   otimista — o recarregamento entrega a nova verdade. Se a página
   *   mantiver entrada do visualizador não enviada que valha preservar durante esse recarregamento,
   *   guarde em `sessionStorage` antes de chamar `publish` (estado mantido
   *   apenas em variáveis JS não sobrevive ao recarregamento). Com `ifMatch`
   *   em uma publicação de arquivos, o `conflict` pode ter `paths` para mesclar.
   * - `not_writer` — este visualizador pode ver a página, mas não pode escrevê-la.
   *   A presença do membro NÃO indica gravabilidade (veja a documentação do membro),
   *   então uma página compartilhada deve tratar sua primeira rejeição `not_writer` ou
   *   `not_granted` como o sinal de somente leitura: desabilite ou esconda
   *   os recursos de escrita a partir de então, com texto que diga que a visualização é
   *   somente leitura em vez de dizer que algo falhou.
   *
   * O restante é excepcional: ramifique a UX no código do erro `code`, nunca
   * no texto da mensagem; tente novamente apenas `upstream_error`, no máximo uma vez após um
   * curto atraso aleatório; trate `rate_limited` como sinal para desacelerar o
   * próprio ritmo da página (agrupe várias alterações em uma única publicação), nunca
   * como um loop de repetição.
   */
  namespace artifact {
    /**
     * Estrutura de rejeição para {@link publish}. Ramifique em `.code`;
     * `.message` é legível para humanos, mas não localizado.
     */
    interface ArtifactError {
      code: ArtifactErrorCode;
      message: string;
      /** Em `conflict`: o identificador da versão que agora está ativa. */
      live?: string;
      /** Em um `conflict` de arquivos: os arquivos cujo `ifMatch` deixou de valer. */
      paths?: ConflictPath[];
      /** Em um `conflict` de arquivos: como {@link PublishResult.changed}. */
      changed?: ChangedFile[];
      /** Em uma rejeição por operação (normalmente `invalid_content` de {@link
       * edit}): o índice baseado em zero da operação inválida no array `ops`, e
       * o `data-id` que ela nomeou — presente apenas quando a falha é
       * atribuível a uma única operação (o campo do plano de controle:
       * "ops[N].target"). */
      opIndex?: number;
      target?: string;
    }

    /** Um arquivo alterado; `sha256` é seu hash agora, `null` se foi excluído. */
    interface ChangedFile {
      path: string;
      sha256: string | null;
    }

    /** `expected`: o `ifMatch` enviado; `actual`: o sha256 do arquivo agora
     * (`null`: nenhum arquivo). */
    interface ConflictPath {
      path: string;
      expected: string | null;
      actual: string | null;
    }

    /**
     * Códigos de erro estáveis. Trate códigos desconhecidos como `"upstream_error"` —
     * mas observe que os códigos de ciclo de vida abaixo são PERMANENTES para a visualização:
     * nunca tente novamente.
     *
     * - `conflict` — uma versão mais nova foi publicada primeiro; a visualização
     *   já está sendo recarregada para ela. Veja a nota de design de falha acima.
     * - `not_writer` — o visualizador não tem acesso de escrita a este artefato.
     * - `not_declared` — o artefato não declara mais esta capacidade
     *   (uma republicação a remove). Oculta recursos de escrita.
     * - `too_large` — o HTML enviado, ou os arquivos enviados
     *   juntos, excedem o limite de tamanho.
     * - `invalid_content` — a string enviada não é uma página HTML
     *   (ela deve começar com um doctype, como a própria página faz), ou um
     *   argumento de arquivos está malformado (um caminho, conteúdo ou tipo de conteúdo que
     *   o artefato não pode armazenar).
     * - `read_only_path` — em um artefato feito a partir de um TIPO (ele mantém a
     *   página e os arquivos do tipo somente leitura; apenas seus próprios arquivos podem mudar):
     *   uma publicação de arquivos nomeou um dos caminhos do tipo — nada foi
     *   publicado; remova esse caminho e publique o restante — ou uma publicação
     *   `html` foi tentada, o que esse artefato nunca aceita; use o
     *   formato de arquivos.
     * - `rate_limited` — publicação em excesso; diminua o ritmo e agrupe.
     * - `consent_required` — código legado de shells que exigiam um prompt de consentimento
     *   por visualizador para publicar artefatos; shells atuais
     *   nunca enviam isso (a concessão é por construção). Trate
     *   como `not_granted`: renderize a experiência somente leitura.
     * - `upstream_error` — qualquer outra coisa (falha transitória de serviço).
     *
     * Códigos de ciclo de vida (do próprio tempo de execução, não do caminho de publicação) —
     * permanentes para esta visualização, nunca reutilizáveis:
     * - `not_granted` — a sessão do visualizador não concedeu `artifact` a
     *   este frame (artefato não declarado, ou visualização somente leitura); renderize
     *   a experiência somente leitura.
     * - `capability_disabled` — concedido, mas não utilizável nesta visualização
     *   (o runtime de serviço é anterior a ele, ou seu módulo falhou ao carregar), ou — para a forma de arquivos de {@link publish} — o formato
     *   não está disponível para esta visualização ou este artefato; trate como
     *   `not_granted`.
     * - `capability_removed` — o método chamado não faz parte do
     *   runtime que serve esta visualização; trate como `capability_disabled`.
     * - `transform_error` — os argumentos da chamada não puderam ser preparados;
     *   trate como `invalid_content`.
     */
    type ArtifactErrorCode =
      | "conflict"
      | "not_writer"
      | "not_declared"
      | "too_large"
      | "invalid_content"
      | "read_only_path"
      | "rate_limited"
      | "consent_required"
      | "upstream_error"
      | "not_granted"
      | "capability_disabled"
      | "capability_removed"
      | "transform_error";

    /** Estrutura de resolução para {@link publish}. */
    interface PublishResult {
      /** O identificador da nova versão — informativo; o shell recarrega
       * todas as visualizações abertas para ela (após uma publicação `html` também; após
       * uma publicação de arquivos esta visualização continua em execução e constrói sobre ela, a menos
       * que o salvamento tenha ocorrido sobre a versão de outra pessoa). */
      version: string;
      /** Quando todas as entradas tinham `ifMatch`: arquivos escritos por outros visualizadores mudaram desde
       * a versão desta visualização (`[]`: nenhum; ausente: desconhecido). A mudança desta visualização
       * para a nova versão traz o conteúdo deles. */
      changed?: ChangedFile[];
      /** Presente quando o host verificou os valores `ifMatch` desta chamada (qualquer
       * entrada tinha um; `null` conta); uma chamada sem nenhum não recebe `shas`. Mapeia
       * cada arquivo que esta chamada escreveu para seu sha256 armazenado: use isso como o
       * próximo `ifMatch` do arquivo, não um hash do que você enviou. `{}` quando a
       * chamada não escreveu nenhum arquivo, então teste `shas !== undefined`. */
      shas?: Record<string, string>;
    }

    /**
     * Um arquivo em uma publicação de arquivos: texto UTF-8 como string, bytes binários
     * como `Blob`, ou qualquer um dos dois encapsulados como `{content, contentType}` para indicar
     * explicitamente o tipo de mídia (um tipo simples como `text/plain`, sem
     * parâmetros `;charset`; uma string precisa de um tipo de texto, qualquer outra coisa
     * vai como `Blob`). Sem `contentType`, o tipo é o
     * `type` do próprio Blob, caso contrário inferido a partir da extensão do caminho para os
     * tipos web comuns (html, htm, css, js, mjs, json, webmanifest, txt,
     * md, xml, svg, png, jpg, jpeg, gif, webp, avif, ico, woff, woff2,
     * ttf, otf, mp3, wav, mp4, webm, pdf, wasm); qualquer outro nome precisa de um
     * `contentType` explícito, e o artefato armazena apenas tipos de mídia web servíveis. `ifMatch`: o sha256 da cópia que esta gravação substitui
     * (`null`: criando); veja PRECONDIÇÕES POR ARQUIVO em {@link publish}.
     */
    type PublishFile =
      | string
      | Blob
      | {
          content: string | Blob;
          contentType?: string;
          ifMatch?: string | null;
        };

    /** Exclui o arquivo; com `ifMatch`, somente enquanto seu sha256 ainda for esse. */
    type PublishDelete = { delete: true; ifMatch?: string };

    /**
     * Publica `html` como a nova versão ao vivo deste artefato.
     *
     * `html` deve ser a página de substituição COMPLETA — um documento completo
     * começando com `<!doctype html>`, exatamente o que um visualizador novo deve
     * receber. Não serializa o DOM ao vivo (`document.documentElement.
     * outerHTML` contém estado da sessão do visualizador e scripts de runtime
     * injetados); em vez disso, mantenha a fonte canônica da página em JS — por
     * exemplo, uma função de template do estado da página — e renderize a
     * substituição a partir dela, da mesma forma que a página foi escrita.
     *
     * A gravação é de comparação e atribuição contra a versão em que esta visualização está
     * executando: se algo foi publicado no meio, a chamada rejeita com
     * `conflict` e a visualização recarrega para o vencedor. Depois de uma publicação bem-sucedida,
     * esta visualização também recarrega — trate `publish` como o último ato de
     * uma interação e guarde tudo que deve sobreviver em
     * `sessionStorage` antes.
     *
     * A publicação é executada com a AUTORIDADE e a identidade do VISUALIZADOR: em um
     * artefato compartilhado onde outras pessoas podem escrever, cada clique do visualizador
     * publica como eles. Cada versão é atribuída e a página inteira
     * é substituída atomicamente — não há atualização parcial.
     */
    function publish(html: string): Promise<PublishResult>;

    /**
     * FORMA DE ARQUIVOS — publique apenas os arquivos alterados como a nova versão ativa
     * do artefato: `files` mapeia caminhos relativos (`"data/doc.json"`,
     * `"notes.md"`) para o novo conteúdo, ou para `null` para excluir o
     * caminho; todo caminho não nomeado é mantido inalterado. Este é o
     * caminho de salvamento para artefatos tipo editor cuja página permanece fixa enquanto
     * seus arquivos de dados mudam — incluindo um artefato feito a partir de um TIPO,
     * cuja página (`index.html`) e outros arquivos do tipo são somente leitura:
     * nomear um deles rejeita `read_only_path` e não publica nada, e o
     * formato `html` é recusado ali diretamente.
     *
     * A mesma autoridade do visualizador e o mesmo design `not_writer` que o formato `html`, e
     * por padrão a mesma comparação e atribuição em toda a versão. Com sucesso,
     * ESTA visualização continua em execução (a menos que o salvamento tenha caído sobre a versão de outra pessoa,
     * abaixo): a próxima publicação se baseia na versão que ela acabou de criar, e apenas
     * as OUTRAS visualizações abertas recarregam. URLs relativas nesta visualização ainda servem
     * a versão que ela carregou, então renderize o conteúdo salvo a partir dos dados que a página
     * mantém. Cada chamada gera uma versão completa, então nunca publique por
     * tecla: reduza as edições para uma única chamada, com todos os arquivos alterados, alguns
     * segundos após o usuário pausar (ou em um Salvar explícito). Onde o formato
     * não está disponível — o host da visualização não o habilita (uma visualização somente leitura
     * incluída), ou o artefato é compartilhado publicamente — a chamada rejeita
     * `capability_disabled`: mantenha o trabalho do usuário na página e diga que o salvamento
     * não está disponível aqui.
     *
     * PRECONDIÇÕES POR ARQUIVO — quando outros podem salvar o mesmo artefato, forneça
     * a cada entrada `ifMatch`: o sha256 do arquivo conforme o host o informou por último
     * (listagem de arquivos, `shas` de resultado, `actual` de `conflict`); `null`
     * ao criar; `{delete: true, ifMatch}` para excluir. Com um em cada
     * entrada (uma entrada sem isso mantém a verificação de toda a versão para a
     * chamada), duas gravações de escritores em arquivos diferentes entram, e uma gravação
     * que caiu sobre a versão de outra pessoa move esta visualização para a nova versão: um
     * RECARREGAMENTO, a menos que a página tome as atualizações no local. Se um arquivo nomeado
     * mudou, nada é publicado e o `conflict` tem `paths`: assim que
     * esta visualização se mover para a versão ativa, releia esses arquivos, mescle,
     * publique novamente.
     */
    function publish(
      files: Record<string, PublishFile | PublishDelete | null>,
    ): Promise<PublishResult>;

    /**
     * Uma edição endereçada por id para um DOCUMENTO AO VIVO (um artefato criado como um
     * documento ao vivo — seu conteúdo é um diário de edição, não há versões).
     * `target` é o `data-id` de um elemento: o servidor marca um em cada
     * elemento que serve, então leia-o do DOM (`el.dataset.id`).
     *
     * - `set-text` substitui o conteúdo de texto do elemento. O texto é salvo com
     *   the bytes as written; a difference that is ONLY a no-break space
     *   (U+00A0) for a space, or the reverse, is never reported as an edit —
     *   browsers store a typed trailing space as U+00A0, a rendering detail,
     *   not the writer's intent — and another writer's text is applied to
     *   the view with its own bytes.
     * - `set-attr` / `del-attr` set or remove one attribute (`data-*`,
     *   `class`, `hidden`, `aria-*` and so on — not `data-id` itself).
     * - `create-element` adds a child `<tag>` under `target`, last unless
     *   placed by ONE of: `before` / `after` — the `data-id` of a direct
     *   child of `target` (prefer these) — or `index`, which counts the
     *   parent's child NODES, whitespace text included. Initial `text` and
     *   `attrs` are optional; the server assigns its id and returns it in
     *   `created`, in op order — target (or anchor on) that id in a
     *   following call. (`newId` is retired and refused.)
     * - `remove` deletes the element and its subtree.
     */
    type EditOp =
      | { op: "set-text"; target: string; text: string }
      | { op: "set-attr"; target: string; key: string; val: string }
      | { op: "del-attr"; target: string; key: string }
      | {
          op: "create-element";
          target: string;
          tag: string;
          text?: string;
          /** initial attributes (set-attr's rules; at most 16) */
          attrs?: Record<string, string>;
          /** data-id of a direct child of `target` to insert before */
          before?: string;
          /** data-id of a direct child of `target` to insert after */
          after?: string;
          /** position among `target`'s child nodes, text nodes counted;
           * prefer `before`/`after` — at most one of the three */
          index?: number;
        }
      | { op: "remove"; target: string };

    /** Forma de resolução para {@link edit}. */
    interface EditResult {
      /** A posição no diário em que esta edição caiu — informacional. */
      seq: number;
      /** `data-ids` atribuídos pelo servidor para ops `create-element`, em ordem de operação. */
      created: string[];
    }

    /**
     * SOMENTE DOCS AO VIVO — anexe `ops` a este documento como visualizador. Assim é
     * como uma página e uma sessão Claude em observação COLABORAM em tempo real:
     * no momento em que a edição cai, o Claude recebe o que mudou (qual
     * elemento, seu texto/atributos) e normalmente responde com uma edição própria
     * um segundo ou dois depois, aplicada a esta visualização no local (abaixo).
     *
     * Aplique sua alteração ao seu próprio DOM também — antes da chamada, ou
     * sincronamente quando ela resolve (então com o `created` retornado como
     * `data-id` do elemento), com exatamente os atributos e texto que você
     * passou: esta visualização NÃO é re-renderizada para suas próprias edições — apenas para
     * as de outros escritores (Claude, outro visualizador). Um elemento que você renderizou
     * dessa forma, ao lado do local em que o documento o coloca, é considerado o que você
     * criou. Um que você cria por `edit` mas não insere você mesmo é
     * inserido para você na posição do documento, e um que seu `remove`
     * nomeia mas você deixa no lugar é removido, para que as edições de outros escritores
     * ao redor possam ser posicionadas — mas se o pai mantiver, sem um
     * `data-id`, um elemento dessa tag ao lado do slot que difira do que você passou,
     * ou uma correspondência exata em outro lugar entre os filhos, isso pode ser sua própria tentativa: nada é inserido para você e uma edição posterior ao redor recarrega esta visualização. Renderize exatamente, ou não insira nada.
     * Mantenha o estado que importa NO DOCUMENTO (texto, atributos `data-*`),
     * não em variáveis JS. Quando uma edição de outra pessoa cai —
     * atributos ou texto em elementos existentes, ou um elemento criado,
     * removido ou movido (por exemplo, o Claude respondendo você) — ela é aplicada ao seu
     * DOM no local e o `document` recebe um evento personalizado `claude:edit`
     * (`detail: {seq, targets: string[]}` — os `data-ids` afetados): reagindo a isso,
     * por exemplo `document.addEventListener('claude:edit', e => render())`.
     * Uma edição que a visualização não consegue aplicar no local a recarrega a partir do documento
     * e seus scripts rodam de novo — então o estado mantido no DOM sobrevive de qualquer forma.
     * Uma edição de texto em `<script>` ou `<style>` (ou em texto de controle de formulário/
     * metadados como `<textarea>` ou `<title>`) nunca é aplicada no local: as outras visualizações recarregam a partir do documento e seus scripts rodam de novo.
     *
     * Rejeições: `not_writer` / `not_granted` (visualizador somente leitura — esconda o
     * controle), `invalid_content` (uma operação inválida, um id que não existe mais,
     * este artefato não é um documento ao vivo, ou a edição levaria o documento
     * além do orçamento de edição ao vivo — abaixo), `conflict` (o documento se moveu
     * sob a edição — reemitir a mesma chamada é seguro), `rate_limited`
     * (desacelere; agrupe várias alterações em uma única chamada), `upstream_error`
     * (o serviço falhou OU a resposta foi perdida — a edição PODE ter
     * caído: o runtime já tentou novamente uma vez com a mesma chave de idempotência,
     * então reenvie você mesmo apenas ops seguras para serem aplicadas duas vezes —
     * `set-*`/`del-attr`/`remove` — nunca `create-element`, que poderia
     * duplicar). Uma chamada carrega no máximo 32 ops; prefira uma chamada por gesto do usuário.
     *
     * Orçamentos de edição ao vivo. Uma edição cai apenas enquanto a página que produz
     * permanece dentro de 524.288 caracteres de texto (cada nó de texto conta —
     * `<script>`, `<style>` e corpos de blocos de dados e o espaço em branco entre
     * tags incluídos), 131.072 elementos mais atributos (cada elemento, trecho de texto e atributo contam como um), e 8 MiB renderizados; uma edição que cruzasse essa linha é recusada com `invalid_content` enquanto edições que mantêm a
     * página dentro dela ainda caem. Dois orçamentos só enchem ao longo da
     * vida do documento, e nada feito ao mesmo documento os esvazia:
     * conteúdo removido — cada elemento removido com tudo que estava dentro dele,
     * mais uma pequena entrada por filho removido ou movido — acumula em direção a
     * 4 MiB, além do qual uma edição que remove ou move elementos é recusada
     * enquanto a maioria das outras edições ainda cai; e um elemento pai tem no máximo
     * 65.536 posicionamentos de filhos (cada filho criado sob ele ou movido para ele,
     * filhos removidos ainda contados). Apenas um documento novo — o arquivo ao vivo recriado, ou o artefato duplicado — começa do zero. Um
     * `set-text` (ou `text` de um `create-element`) carrega no máximo 16.384
     * caracteres; para um `<script>` ou `<style>`, cujo corpo uma edição sempre reescreve inteiro,
     * isso limita o corpo. Portanto, mantenha scripts grandes, estilos e
     * blocos de dados em arquivos separados do artefato, e faça uma página de longa execução girar ou aposentar linhas antigas em vez de crescer sem limites.
     */
    function edit(ops: EditOp[]): Promise<EditResult>;

    /**
     * SOMENTE DOCS AO VIVO — a forma sem API de escrever. Em um documento ao vivo, A MARCAÇÃO DA PÁGINA É O DOCUMENTO: qualquer clique, tecla ou arrasto do escritor na DOM — texto, atributos, elementos adicionados, removidos ou reordenados, estado de checkbox, valor de um campo de texto, digitação em `contenteditable` — é anexado ao documento como esse visualizador (o mesmo diário que `edit` grava) e alcança todas as outras visualizações e a sessão Claude em observação. Nada para marcar: o runtime trata `<body>`
     * como região de sincronização (ele mesmo define `<body artifact-sync>`); seus filhos SERVIDOS
     * são o documento, e um elemento que seu script anexa diretamente em `<body>` — um toast, um modal ou portal de tooltip — fica só desta visualização.
     * Cole em marcação editável e ela cai como texto simples.
     *
     * O que fica só desta visualização: ALTERAÇÕES dentro de um elemento `<artifact-local>`
     * ou atributo `artifact-local` (sua marcação continua compartilhada como escrita — toda visualização recebe a mesma caixa de filtro ou chip "saving...";
     * somente o que uma visualização faz nele é local, e ele volta VAZIO para
     * os outros se sua linha for movida); qualquer atributo `data-local-*` em qualquer lugar (a
     * seleção, hover, estado expandido de um elemento compartilhado de um visualizador);
     * `open` em `<details>`/`<dialog>`; e entradas password / hidden /
     * payment-autocomplete, cujos valores nunca entram no documento.
     * Toda escrita de ATRIBUTO e TEXTO capturada é agendada em um SYNC LANE,
     * inferido a partir do evento que a gerou da mesma forma que o React classifica a prioridade de uma atualização. Elementos que um gesto cria ou remove são
     * registrados como antes: ainda não em lane, não coalescidos nem orçamentados.
     * (Nenhuma escrita é descartada por deixar o documento como estava — isso exige
     * o valor atual do documento por atributo, que vem em uma versão posterior;
     * um valor reajustado para si mesmo é uma linha que nada diz.)
     * Nada disso custa a um usuário uma escrita:
     * - `discrete` — o que um manipulador de clique, tecla, input, change, paste ou drop
     *   escreve (eventos discretos do React, menos os que um
     *   script pode disparar como confiáveis: `focus()`, `scrollTo()`,
     *   `play()`, `close()` de um diálogo ou `reset()` de um formulário não abrem gesto;
     *   e um evento de submit, clipboard ou input do host de edição que o
     *   navegador dispara para uma chamada de script — `requestSubmit()`,
     *   `execCommand()` — conta somente sob a própria ativação do usuário; a
     *   entrada/alteração do próprio controle de formulário, de um picker ou autofill
     *   incluídos, sempre contam — então uma página que conduz um controle por
     *   `execCommand`, ou clica em seu próprio checkbox ou rádio (`.click()`),
     *   é tratada como usuário: o evento é o que digita ou clica e dispara, suas escritas entram no diário imediatamente e não são orçamentadas, e um loop `.click()` é a única forma de passar do orçamento), além do que `claude.artifact.sync(fn)`
     *   escreve: gravado imediatamente, nunca retido ou descartado.
     * - `default` — tudo o mais dentro da janela de gesto: um
     *   timer do handler, um effect, um loop de animação, e — até que a lane
     *   `continuous` caia — um handler de `pointermove` de arrasto, um handler de scroll,
     *   um hover. Atributos coalescem em 1,5 s, então uma classe pressionada
     *   ou um destaque de drag-over que um timer coloca e retira é UMA linha
     *   com seu valor final, não duas; e cada elemento tem um orçamento de 60
     *   dessas gravações no diário por
     *   minuto, além do qual apenas o último valor por atributo ou texto é
     *   mantido e cai até 1,5 s após a janela liberar — com um aviso no console
     *   nomeando isso (um timer, um loop quente: marque com `data-local-*` /
     *   `<artifact-local>`). Um arrasto ou scrub, portanto, cai com seu valor final,
     *   1,5 s depois; uma classe de hover que um par de handlers coloca e retira é uma linha com a classe limpa; e uma escrita em lane padrão ainda esperando
     *   sua vaga quando um script remove ou re-renderiza seu elemento sem gesto por trás é descartada junto com o elemento.
     * - `idle` — `<artifact-local>`, `data-local-*`, `open` em
     *   details/dialog: nunca entram no diário.
     * O atributo (ou texto) de um elemento mantém sua ordem entre lanes: a
     * última escrita vence, incluindo uma mudança aplicada por um co-writer.
     * Então a UI por visualizador — entradas de filtro e busca, abas, ordem de classificação, rascunhos,
     * chrome expandido/contraído — vai dentro de `<artifact-local>` ou fica em
     * atributos `data-local-*`; tudo o mais que um visualizador altera é
     * everyone's. Keep what sits inside `<artifact-local>` to the MINIMUM —
     * the controls and chrome that are genuinely per view. The served
     * document IS the artifact: it is what every other view, the watching
     * session and a read of the page see, so the content people come for
     * (the rows, the entries, the text) belongs in the shared markup, never
     * inside a local island; a page whose content lives only in
     * `<artifact-local>`, or only in what a script draws, reads as empty
     * everywhere but the view that drew it. Islands and regions nest both
     * ways (an `<artifact-sync>` element or `artifact-sync` attribute inside
     * an island is shared again;
     * the innermost marker governs), the marker elements are layout-neutral
     * (`display: contents`), and a page that marks `<body>` or `<html>`
     * itself keeps what it chose — `<body artifact-local>` makes the whole
     * page local except the regions it marks explicitly (use the attribute
     * form inside tables and lists: `<tbody artifact-sync>`).
     *
     * Two rules make it work:
     * - SERVE the content as HTML in the page; change it in event handlers
     *   however you like - in place (`li.remove()`, `el.textContent = x`,
     *   `list.append(li)`, `el.classList.toggle(...)`) or by re-rendering a
     *   container (`list.innerHTML = render(items)`): a re-render is
     *   reconciled against what it replaced (rows paired by `data-key`/`id`
     *   if you give one, else by content, else by position) and only the
     *   rows and text that actually changed are saved. What is NOT the
     *   document is markup a script renders with no gesture behind it - on
     *   load, on a timer or animation frame, after `await fetch()`: nothing
     *   of it is saved, and an element found holding such script-built
     *   children is switched OFF for the view (saving continues everywhere
     *   else): the console says so, that element gets
     *   `artifact-sync-state="off"` (style `[artifact-sync-state=off]`) and
     *   a `claude:sync-off` event bubbles from it; moving or copying such an
     *   element by gesture is not saved either. So a chart or computed
     *   summary you render from script belongs in `<artifact-local>` (the
     *   element around it then moves freely) — drawn FROM rows that stay in
     *   the document, so script enhances served content rather than standing
     *   in for it — and if you keep JS state,
     *   update it from `claude:edit` so a re-render never rolls back
     *   another writer's change. Prefer `class`/`hidden`/`data-*`/`aria-*`
     *   for state you toggle — those, `value`/`checked`, and the inert
     *   presentation names (`style`, `title`, `alt`, `placeholder`,
     *   `lang`, `dir`, `role`, `tabindex`, `disabled`, `readonly`,
     *   `contenteditable`, `open`, `colspan`, `rowspan`) patch the other
     *   views in place; any other attribute (`on*`, `href`/`src`, `id`,
     *   `type`, ...) reloads them instead.
     * - Keep each editable text in its own element (`<span>`, `<p>`, `<td>`
     *   with no child elements): text mixed with child elements cannot be
     *   saved (the console warns when a gesture produces it).
     *   `<textarea>`/`<select>` values and canvas pixels are not captured;
     *   use `<input>` / `contenteditable`, or call `edit`.
     *
     * `sync(fn)` is the deliberate exception to the gesture rule: it runs
     * `fn` (which may be async) with capture on — inputs it sets included —
     * and resolves once what `fn` changed in shared markup has been
     * appended, or rejects with the `edit` error code if it was not. For the
     * rare write with no gesture behind it (applying a poll result you DO
     * want everyone to see); its writes are always discrete. (A
     * `continuous` lane for drags, hovers and scrolls, and a `transition`
     * opt-in below discrete, follow in a later version.) Read-only
     * viewers' changes are never saved
     * (their first attempt turns capture off for the view: every region,
     * the adopted `<body>` included, gets `artifact-sync-state="off"`) — style them a read-only
     * page. A transient failure keeps the changes and sends them with the
     * next one (`claude:sync-lost` event, `{code, count}`). A change the
     * document refuses outright (an element another writer already removed,
     * a page over a live-editing budget — see `edit`), or content that cannot
     * be saved at all (text mixed with child elements, script-built elements),
     * is not queued again: `claude:sync-dropped` fires on `document` with
     * `{reason, count, targets?}` — `reason` is `"invalid_content"` for a
     * refused batch, or `"mixed"` / `"script_built"`; `targets` are the
     * data-ids the refused changes addressed (a created element's parent),
     * absent for mixed / script-built content. This view keeps the change;
     * the document does not. React with per-view state (a `data-local-*`
     * attribute, an `<artifact-local>` notice), not by rendering into
     * shared markup.
     */
    function sync(fn: () => unknown): Promise<void>;
  }
}

interface ClaudeCapabilityMap {
  artifact: typeof Claude.artifact;
  /** Legacy spelling — `claude.use("self")` resolves the same namespace. */
  self: typeof Claude.artifact;
}
