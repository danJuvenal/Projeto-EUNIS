/**
 * A capacidade `assets` — armazena ativos binários (imagem, SVG, vídeo, PDF,
 * ou fonte web) e arquivos de texto (CSV, Markdown, JSON, texto simples, CSS,
 * JavaScript) para este artefato e devolve IDs de ativo duráveis.
 *
 * Métodos: `upload(blob, options?)` resolve `{id, url, sizeBytes,
 * contentType}`; `list()` resolve todos os ativos armazenados mais o
 * uso de armazenamento do artefato; `delete(ref)` remove um ativo. Os ativos vivem
 * com o artefato: sobrevivem a recarregamentos e republicações, são compartilhados por
 * todos os visualizadores do artefato e são excluídos com o artefato. O
 * documento `db` em que um id é armazenado continua sendo o índice do ativo — uma listagem
 * não carrega nomes ou significados próprios, então `list()` é para
 * manutenção doméstica (um medidor de armazenamento, removendo ativos que nenhuma linha aponta), não
 * uma fonte de galeria. Em um runtime anterior a um método, chamá-lo rejeita
 * `capability_removed`, então trate os códigos de rejeição em vez de verificar
 * membros.
 *
 * A capacidade é um NAMESPACE de métodos: obtenha-o com
 * `const assets = await claude.use("assets")`, então chame
 * `assets.upload(...)`. Todo método é SOMENTE ESCRITA: a plataforma concede
 * a capacidade apenas aos visualizadores que possuem o bit de escrita deste artefato, então
 * em uma visualização somente leitura `use("assets")` resolve `null` — esconda os recursos de upload e
 * exclusão em `null`, e ainda trate os códigos de rejeição em
 * toda chamada (`not_granted` continua sendo a proteção por chamada). Declare
 * `capabilities: {assets: {}}`
 * (declare também `db` — um id de ativo sem um documento para viver é perdido
 * quando a página recarrega). Um artefato declarante é interno à organização
 * e não pode ser compartilhado publicamente.
 *
 * O que armazenar onde, a única invariável que vale a pena projetar: armazene
 * o `id` retornado (uma string opaca de 32 caracteres) em documentos `db` como o
 * ponteiro durável — por exemplo, `{"ticket_id": 7, "screenshot": id}` — e
 * construa a URL de exibição por visualização. A `url` retornada é essa
 * URL de exibição, já correta para a visualização atual — use-a literalmente
 * como `src` de `<img>`/`<video>`/`<script>`, `href` de um `<link>` de stylesheet,
 * `src: url()` em `@font-face`, ou `href` de um link de download.
 * Para exibir um ativo cujo id você lê de volta
 * de `db`, construa `"/_blob/" + id`: esse caminho relativo à raiz resolve
 * em todas as páginas e versões do artefato (o único caminho relativo à raiz
 * que a plataforma serve).
 * Um ativo SVG é exibido apenas por `<img>` ou CSS `url()` — ele é
 * servido como imagem, nunca como documento para incorporar ou navegar.
 * SVG é sanitizado no upload: scripts, manipuladores de eventos, `<foreignObject>`,
 * `<style>`/`<link>`, elementos de animação, referências externas `<use>`
 * e URLs `javascript:`/`data:` são removidos e o arquivo é re-encodificado
 * (`sizeBytes` é o tamanho armazenado), então estilize SVG com atributos, não
 * blocos `<style>`, e faça upload de raster separadamente em vez de incorporá-los
 * como `data:` (uma exportação de ferramenta de design com imagens incorporadas faz upload
 * normalmente, mas essas imagens renderizam em branco). Arquivos SVG têm limite de 2 MiB,
 * CSS e JavaScript de 16 MiB, outros tipos de 20 MiB.
 *
 * Arquivos de texto (`text/csv`, `text/markdown`, `application/json`,
 * `text/plain`, `text/css`, `text/javascript`) são armazenados e servidos
 * byte a byte sob o tipo declarado, nunca renderizados como página: uma
 * página que ingere um arquivo de dados lê-o de volta pela `url` e analisa o
 * texto por si mesma; um ativo de stylesheet ou script entra em vigor onde uma
 * das próprias páginas do artefato o referencia, mesma origem, por exemplo,
 * `<link rel="stylesheet" href={url}>` ou `<script src={url}>`. O
 * tipo deve ser a grafia exata — um parâmetro `;charset=` ou um
 * alias da plataforma (um `.csv` escolhido no Windows pode informar
 * `application/vnd.ms-excel`; `.js` costuma informar
 * `application/javascript`) é rejeitado — então passe `options.type` escolhido
 * pela extensão do arquivo sempre que `blob.type` não for já um dos
 * seis. O texto deve ser UTF-8 válido (uma marca de ordem de bytes é aceita);
 * UTF-16, UTF-32 ou codificação legada de byte único são rejeitados
 * por `invalid_request`, então reencode esse arquivo antes do upload. Os
 * quatro tipos de dados são, de resto, nunca inspecionados: um arquivo Markdown ou
 * texto simples que abre com uma tag HTML ou comentário é armazenado como
 * está. Uma stylesheet ou script também deve ler como texto: um que abre
 * com marcação ou carrega conteúdo binário rejeita `unsupported_type`.
 * Marcação sob qualquer outro tipo faz upload apenas como `image/svg+xml`.
 */

declare namespace Claude {
  /**
   * Design de falha: ramifique a UX no código do erro `code`, nunca no texto
   * da mensagem. `store_unavailable` é o único código de tentativa de reenvio; tudo
   * o mais é ou um bug da página, uma condição permanente por visualização, ou exige
   * que o visualizador altere o que está enviando ou excluindo.
   */
  namespace assets {
    /** Opções para {@link Claude.Assets.upload}. */
    interface UploadOptions {
      /** Tipo de conteúdo para registrar e servir, sobrescrevendo `blob.type`.
       * Obrigatório quando `blob.type` está vazio; deve estar no conjunto aceito.
       * Somente tipos de mídia exatos — sem parâmetros. Arquivos de fonte escolhidos
       * no disco frequentemente carregam `blob.type` vazio ou legado; passe o
       * formato `font/` (`font/woff2`, `font/woff`, `font/ttf`,
       * `font/otf`) aqui. Arquivos de texto frequentemente carregam um parâmetro de charset,
       * um tipo vazio ou um alias da plataforma como
       * `application/vnd.ms-excel` para `.csv` ou `application/javascript`
       * para `.js`; passe o tipo simples `text/csv`, `text/markdown`,
       * `application/json`, `text/plain`, `text/css` ou
       * `text/javascript`, escolhido pela extensão do arquivo. */
      type?: string;
    }

    /** Estrutura de resolução para {@link Claude.Assets.upload}. */
    interface UploadResult {
      /** ID opaco de 32 caracteres do ativo — o ponteiro DURÁVEL. Armazene isto em
       * documentos `db`; ele nunca muda e nunca incorpora conteúdo. */
      id: string;
      /** URL de exibição para a visualização atual; use-a literalmente. Derivável
       * de `id` a qualquer momento como `"/_blob/" + id`; não armazene. */
      url: string;
      /** Quantidade de bytes armazenados, conforme a plataforma registrou. */
      sizeBytes: number;
      /** O tipo de conteúdo com o qual o ativo será servido. */
      contentType: string;
    }

    /** Um ativo armazenado, conforme {@link Claude.Assets.list} informa. */
    interface Asset {
      /** ID opaco de 32 caracteres do ativo — o mesmo ponteiro durável
       * que {@link Claude.Assets.upload} resolveu. */
      id: string;
      /** URL de exibição para a visualização atual; use-a literalmente. */
      url: string;
      /** Tipo de conteúdo com o qual o ativo é servido. */
      contentType: string;
      /** Quantidade de bytes armazenados. */
      sizeBytes: number;
      /** Hora do upload, um timestamp RFC 3339 UTC. */
      createdAt: string;
    }

    /** O orçamento de ativos do artefato e quanto dele foi usado. */
    interface Usage {
      /** Contagem de ativos armazenados. */
      files: number;
      /** Bytes armazenados em todos os ativos. */
      bytes: number;
      /** Limite de contagem de ativos por artefato. */
      maxFiles: number;
      /** Cota de bytes por artefato. */
      maxBytes: number;
    }

    /** Estrutura de resolução para {@link Claude.Assets.list}. */
    interface ListResult {
      /** Todos os ativos armazenados, do mais antigo para o mais recente. */
      assets: Asset[];
      usage: Usage;
    }

    /** Estrutura de resolução para {@link Claude.Assets.delete}. */
    interface DeleteResult {
      /** `true` quando esta chamada removeu o ativo; `false` quando nada
       * foi armazenado sob esse id (já excluído ou nunca enviado para
       * este artefato). Ambos são sucesso. */
      deleted: boolean;
    }

    /**
     * Estrutura de rejeição para toda chamada. `message` é legível para humanos, mas
     * não localizado.
     */
    interface UploadError {
      code: UploadErrorCode;
      message: string;
    }

    /**
     * Códigos de erro estáveis. Trate códigos desconhecidos como `"upstream_error"`.
     *
     * - `invalid_request` — a chamada está malformada: o primeiro argumento de upload
     *   não é um `Blob`/`File`, o blob está vazio, `options`
     *   quebra uma regra acima, um arquivo de texto (csv, markdown, json, plain,
     *   css, javascript) não é UTF-8 válido, ou o argumento de delete não é
     *   um id de ativo nem sua `url`. Um bug da página, ou um arquivo para re-encodar;
     *   corrija a chamada.
     * - `too_large` — excedeu o limite por arquivo (2 MiB para SVG, 16 MiB
     *   para CSS e JavaScript, 20 MiB para outros tipos). Comprima ou
     *   divida; o limite não é negociável por chamada.
     * - `unsupported_type` — o tipo de conteúdo não está no conjunto aceito
     *   (png, jpeg, gif, webp, svg+xml, mp4, webm, pdf, woff2,
     *   woff, ttf, otf, text/csv, text/markdown, application/json,
     *   text/plain, text/css, text/javascript), ele carrega um parâmetro,
     *   um corpo SVG não é um documento SVG, um corpo declarado como
     *   imagem, vídeo, PDF ou tipo de fonte começa com marcação (um primeiro
     *   `<` não em branco em um tipo binário só é aceito como
     *   `image/svg+xml`), ou uma stylesheet ou script começa com marcação
     *   ou não é lido como texto (os quatro tipos de dados nunca
     *   são inspecionados). O conjunto é fechado; envolva outros dados em um
     *   contêiner suportado ou armazene pequenos dados em `db`.
     * - `quota_or_state` — o artefato não pode aceitar a chamada no momento
     *   certo: sua cota de armazenamento ou contagem de arquivos está esgotada (upload), ou
     *   ele está não publicado, sendo excluído ou aposentado. Exiba a
     *   condição; fazer upload de algo menor, ou excluir ativos aos quais nenhuma linha aponta,
     *   pode funcionar para a metade de cota apenas.
     * - `rate_limited` — chamada com muita frequência; diminua o ritmo e deixe o
     *   visualizador repetir. Nunca faça loop.
     * - `upstream_auth` — a plataforma não conseguiu autenticar a
     *   chamada; peça ao visualizador para recarregar ou entrar novamente.
     * - `capability_disabled` — concedido, mas não utilizável nesta visualização
     *   (o runtime de serviço é anterior a ele, seu módulo falhou ao carregar,
     *   ou a plataforma o desativou aqui). Oculta recursos de ativo.
     * - `store_unavailable` — problema transitório da plataforma; tente uma vez
     *   depois de um breve atraso.
     * - `upstream_error` — qualquer outra coisa, incluindo todo código que este
     *   contrato antecedeu e uma chamada sem resposta.
     *
     * Códigos de ciclo de vida (do próprio runtime, não do armazenamento):
     * - `not_granted` — esta visualização não concedeu ativos ao frame.
     * - `capability_removed` — o método chamado não faz parte do
     *   runtime que serve esta visualização; trate como `capability_disabled`.
     * - `transform_error` — o pipeline de instrumentação do runtime
     *   falhou nesta chamada; trate como `upstream_error`.
     */
    type UploadErrorCode =
      | "invalid_request"
      | "too_large"
      | "unsupported_type"
      | "quota_or_state"
      | "rate_limited"
      | "upstream_auth"
      | "capability_disabled"
      | "store_unavailable"
      | "upstream_error"
      | "not_granted"
      | "capability_removed"
      | "transform_error";
  }

  /**
   * The method namespace `await claude.use("assets")` resolves for a
   * writer (`null` for a reader).
   */
  interface Assets {
    /**
     * Store `blob` as an artifact asset and resolve with its id and
     * display URL. The id is the durable pointer: write it into the
     * document store right after the call resolves (for instance, a
     * ticket row keeping a screenshot field), and use the resolved
     * `url` for image or video sources in the current view. A later
     * view rebuilds the source from the stored id as `"/_blob/" + id` —
     * ids never expire, and that path resolves from every page and
     * version of the artifact.
     *
     * The upload is not transactional with any `db` write: write the id
     * into its document right after the call resolves, and treat a pointer
     * whose asset 404s as deleted (render a placeholder).
     *
     * @param blob The bytes: a `Blob` or `File`, 1 byte to 20 MiB (2 MiB
     *   for SVG, 16 MiB for CSS and JavaScript), whose type (or
     *   `options.type`) is in the accepted set.
     * @param options `{type?}` — see {@link assets.UploadOptions}.
     */
    upload(
      blob: Blob,
      options?: assets.UploadOptions,
    ): Promise<assets.UploadResult>;

    /**
     * List every asset stored for this artifact, oldest first, with the
     * artifact's storage usage. A housekeeping read: drive a storage
     * meter from `usage`, or reconcile against the ids your `db` rows
     * hold to find assets nothing points at. It is not a substitute for
     * those rows — entries carry no names, order keys, or ownership.
     */
    list(): Promise<assets.ListResult>;

    /**
     * Delete one asset by id (or its url exactly as `upload`/`list`
     * returned it) and resolve `{deleted}`.
     * IRREVERSIBLE and artifact-wide: every viewer's `<img>`/link to it
     * starts returning 404, so remove or rewrite the `db` rows holding
     * the id in the same deliberate user action, and otherwise call it
     * only on ids no row points at — never speculatively or in bulk on
     * load. Idempotent: an id with nothing stored resolves
     * `{deleted: false}`.
     */
    delete(ref: string): Promise<assets.DeleteResult>;
  }
}

interface ClaudeCapabilityMap {
  assets: Claude.Assets;
}
