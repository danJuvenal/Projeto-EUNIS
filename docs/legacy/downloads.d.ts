/**
 * A capacidade `downloads` — oferece um arquivo que o seu frame gerou ao
 * visualizador. `save({filename, data})` mostra ao visualizador uma confirmação
 * (nome final do arquivo + tamanho); o arquivo só é salvo se eles aceitarem. O código do frame
 * nunca baixa diretamente. Obtenha o namespace com
 * `await claude.use("downloads")` — `null` significa que esta visualização não pode executar
 * a capacidade; projete para ausência.
 */

declare namespace Claude {
  namespace downloads {
    /** Forma de rejeição para {@link save}. Ramifique em `.code`. */
    interface DownloadsError {
      code: DownloadsErrorCode;
      message: string;
    }

    /**
     * Códigos de erro estáveis; trate códigos desconhecidos como `"unavailable"`.
     * - `rejected_extension` — extensão ausente ou fora da lista permitida
     *   (`gif png jpg jpeg webp mp4 webm txt json md` e
     *   `docx pptx epub csv ttf html svg pdf xlsx zip`). Ofereça o formato que
     *   o conteúdo quer (uma tabela simples é um `csv`, uma planilha um `xlsx`);
     *   não construa fallbacks antecipadamente para outros formatos.
     * - `extension_not_enabled` — a plataforma desligou a segunda
     *   lista para esta visualização. Não é o estado normal: se chegar, diga
     *   ao visualizador que esse formato não está disponível aqui e pare — sem retry,
     *   sem cadeia de fallback pré-construída.
     * - `too_large` — este arquivo excede um limite: uma resposta de exportação
     *   (`request` definido) maior do que o destino que o visualizador escolheu
     *   aceita (16 MiB hoje), ou um salvamento comum acima de 200 MiB em um
     *   host que grava arquivos por si mesmo (o Claude Android app). Outros
     *   salvamentos normais não têm limite de tamanho: nunca limite, recorte ou re-encode
     *   um download antecipadamente; em `too_large`, ofereça uma versão menor.
     * - `declined` — o visualizador disse não (ou deixou o prompt expirar);
     *   nunca tente automaticamente.
     * - `rate_limited` — um prompt já está aberto ou há muitos prompts recentes;
     *   espere e tente novamente.
     * - `bad_request` — bug do chamador: nome de arquivo inválido (não-string ou >512
     *   caracteres), dados inválidos/vazios/detachados, `request` malformado, ou uma exportação respondida cuja extensão não é o formato solicitado.
     * - `request_unknown` — `request` nomeou uma solicitação de exportação aberta inexistente
     *   (expirada, já respondida ou nunca emitida para esta página);
     *   nada foi salvo. Descarte o trabalho; nunca tente novamente com esse token.
     * - `unavailable` — salvamentos indisponíveis nesta visualização; esconda sua UI de salvamento.
     * - `not_granted`, `capability_disabled`, `capability_removed`,
     *   `transform_error` — ciclo de vida do runtime; trate como `unavailable`
     *   (`transform_error` como `bad_request`).
     */
    type DownloadsErrorCode =
      | "rejected_extension"
      | "extension_not_enabled"
      | "too_large"
      | "declined"
      | "rate_limited"
      | "bad_request"
      | "request_unknown"
      | "unavailable"
      | "not_granted"
      | "capability_disabled"
      | "capability_removed"
      | "transform_error";

    interface SaveRequest {
      /**
       * Nome de arquivo sugerido com extensão. Ele é sanitizado (caracteres invisíveis removidos,
       * espaços em branco repetidos tornam um só espaço, no máximo 240 bytes de UTF-8) e verificado por allowlist; o visualizador confirma o
       * nome FINAL, que pode diferir.
       */
      filename: string;
      /**
       * Conteúdo não vazio; sem limite de tamanho além de `too_large` acima.
       * Strings codificam em UTF-8. Um
       * ArrayBuffer é TRANSFERIDO (detach após a chamada) — passe
       * `buf.slice(0)` se ainda precisar dele; views são copiadas; um Blob é
       * entregue como está, nem lido nem transferido (exceto quando
       * `request` está definido: então ele é lido em um buffer), então prefira
       * um Blob para arquivos grandes. O MIME vem da extensão; o próprio tipo de um Blob
       * (e o nome de um File) é ignorado.
       */
      data: string | Blob | ArrayBuffer | ArrayBufferView;
      /**
       * Somente ao responder uma exportação que a plataforma pediu para esta página:
       * o token opaco que chegou com a solicitação, literalmente. O
       * visualizador então é perguntado se permite que o arquivo vá para o destino escolhido em vez de salvá-lo, e a chamada resolve `"delivered"`. Omitir para um
       * salvamento comum.
       */
      request?: string;
    }

    interface SaveResult {
      /**
       * `"saved"` = o visualizador aceitou e o arquivo foi entregue à superfície de salvamento do host — o download do navegador, a folha nativa de compartilhamento no app Claude iOS, ou a própria gravação de arquivos do app Claude Android,
       * que foi confirmada (um host navegador ainda pode descartar um download
       * para baixo, de forma não observável). `"delivered"` = o salvamento carregou `request` e o
       * visualizador aceitou: o arquivo foi entregue à plataforma para o
       * destino escolhido, não salvo; não mostre aviso de "salvo".
       */
      status: "saved" | "delivered";
    }

    /**
     * Oferece o arquivo. Resolve quando o visualizador aceita; rejeita com
     * {@link DownloadsError} para qualquer outro resultado. Um prompt pendente por vez (first-wins).
     */
    function save(request: SaveRequest): Promise<SaveResult>;
  }
}

interface ClaudeCapabilityMap {
  downloads: typeof Claude.downloads;
}
