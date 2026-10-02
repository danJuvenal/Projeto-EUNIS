/**
 * A capacidade `sample` — pergunta ao Claude a partir do artefato publicado, na
 * própria conta do Claude do visualizador, e obtém a resposta (ao vivo, como ela é
 * escrita, se você quiser exibi-la dessa forma).
 *
 * A versão curta:
 *
 *     const sample = await claude.use("sample")                          // null: ocultar o recurso
 *     const { text, truncated } = await sample(input, options?)         // a resposta completa
 *     const data = await sample.json(input, options?)                    // a resposta analisada como JSON
 *     // input   = "prompt" | [{role: "user"|"assistant", content}, ...] terminando em turno do usuário
 *     // options = { onText?({text, delta}), signal?, tools?, images?, modelTier?, cache? }
 *     // failure = uma promessa rejeitada {code, message, text?}; text = a parte que você pode manter
 *
 * Uma função, uma promessa. Passe `onText` para renderizar a resposta enquanto ela
 * é transmitida (cada chamada traz `text`, a RESPOSTA COMPLETA até então, para atribuir,
 * e `delta`, a parte nova, para anexar); passe `signal` para poder interromper. A mesma promessa
 * resolve ao final com o texto completo, ou rejeita com a única forma de erro.
 * Não existe objeto de stream, nem handle e nem segunda promessa.
 *
 * Cada chamada é independente e sem memória: o Claude vê SOMENTE o `input`
 * que você passa (uma string de prompt, ou a pequena lista de turnos que a PÁGINA mantém
 * para um chat) mais quaisquer `images`, sob enquadramento fixo da plataforma. Ele não pode
 * navegar, não lembra nada entre chamadas, não tem ferramentas além das funções da página
 * que você passa em `options.tools`, e não há prompt de sistema que a página controla: coloque a instrução,
 * os dados da página e o formato de saída que deseja em `input`.
 *
 * Disponibilidade. Dentro de um visualizador a página é enquadrada e `window.claude`
 * existe antes de qualquer script da página rodar; servida em nível superior pela plataforma no
 * host próprio do artefato ela também existe, com cada `use()` resolvendo
 * `null` ali por enquanto, enquanto qualquer outra cópia em nível superior da página não tem
 * `window.claude` de forma alguma. `const sample =
 * await claude.use("sample")` resolve esta função assim que o
 * runtime inicia, não perguntando ao visualizador, ou `null` onde ela nunca
 * pode (por exemplo, a página está enquadrada por um host que não é um visualizador Claude;
 * decidido cerca de dez segundos após o carregamento) — projete para ausência
 * e esconda o recurso. O consentimento é por chamada, não por `use()`: um visualizador
 * que recusa ainda recebe a função e toda chamada rejeita
 * `not_granted`, então seu `catch` também esconde o recurso. Em um efeito React,
 * faça `await claude.use("sample")` dentro do próprio efeito e trate
 * `null` como `not_granted`: ausência.
 *
 * Custo e consentimento — leia antes de projetar a UI em torno disso. Uma chamada que
 * chega ao Claude gasta o USO próprio do Claude do VISUALIZADOR, então a primeira chamada
 * em uma visualização pede ao visualizador para permitir isso; a chamada espera enquanto eles decidem
 * e uma recusa rejeita `not_granted` pelo restante da visualização. As respostas
 * são cacheadas para o visualizador por padrão: repetir uma chamada com o mesmo
 * `input`, `modelTier` e `images` em até cinco minutos reexecuta a resposta armazenada
 * sem contatar o Claude (veja
 * {@link sample.SampleOptions.cache}). Alguns poucos calls rodam ao mesmo tempo para
 * um visualizador, alguns mais esperam sua vez, e um excesso rejeita
 * `rate_limited`. Então: sample em uma ação explícita do visualizador ("Perguntar",
 * "Resumir", "Enviar") ou uma vez no carregamento com um prompt estável
 * entre carregamentos — nunca em loop ou temporizador — e renderize uma página sensata
 * quando o sample estiver indisponível.
 *
 * Tempo para projetar: em `"quick"` um prompt curto responde em um segundo
 * ou dois; em `"default"`/`"complex"` o Claude pensa em silêncio antes de
 * escrever, então o primeiro texto geralmente leva 5-60 s (até dois minutos para
 * um prompt estruturado longo), depois transmite em segundos; cada rodada é
 * limitada a cerca de cinco minutos; uma chamada que usa `tools` é várias
 * rodadas seguidas — cada uma pensa, depois chama suas ferramentas ou escreve: uma
 * chamada de três rodadas no tier default normalmente leva 30-90 s (cerca de um
 * segundo por rodada em `"quick"`), mais longa com imagens (reenviadas a cada rodada). Mostre progresso de dentro de suas funções `execute`. Mostre
 * "Pensando..." desde o momento
 * em que você chama até `onText` disparar pela primeira vez (isso também cobre o diálogo de consentimento
 * e uma chamada esperando sua vez), e ofereça um botão Stop em qualquer tarefa longa. Uma chamada ainda pode falhar APÓS `onText` ter disparado: a
 * promessa rejeita e `e.text` diz o que pode permanecer na tela.
 *
 * Design de falha: toda falha é uma promessa rejeitada carregando um
 * {@link sample.SampleError} `{code, message, text?}` — nunca uma
 * exceção síncrona. Ramifique em `code`, nunca em `message`; NUNCA reenvie
 * em loop. {@link sample.SampleErrorCode} agrupa os códigos pelo que
 * a página deve fazer sobre cada um.
 */
declare namespace Claude {
  /**
   * Pergunte ao Claude. Resolve com a resposta completa; rejeita com um
   * {@link sample.SampleError}. Nunca lança sincronicamente.
   *
   * A requisição sai da página imediatamente após sua chamada retornar (na
   * próxima microtask), não quando você faz `await` — então uma chamada cujo `signal` é
   * abortado no mesmo bloco síncrono (limpeza de efeito React, tecla substituída)
   * não envia nada, não pergunta ao visualizador e não custa nada. Os argumentos são lidos uma vez,
   * no momento da chamada: mudanças posteriores em um array de turnos ou em um `FileList`
   * não afetam a chamada.
   *
   *     // Um único disparo: um botão que resume o que a página mostra
   *     const sample = await claude.use("sample");          // null: oculta o botão
   *     btn.onclick = async () => {
   *       btn.disabled = true;
   *       out.textContent = "Pensando...";
   *       try {
   *         const { text } = await sample("Resuma em 3 itens:\n\n" + notes.textContent);
   *         out.textContent = text;
   *       } catch (e) {
   *         out.textContent = copyFor(e.code);                // seu mapa de código para texto do visualizador
   *       } finally {
   *         btn.disabled = false;
   *       }
   *     };
   *
   *     // Stream com botão Stop: renderiza a resposta conforme ela é escrita
   *     let ctl;
   *     stopBtn.onclick = () => ctl?.abort();
   *     askBtn.onclick = async () => {
   *       ctl = new AbortController();                     // UM controlador novo por chamada
   *       out.textContent = "Pensando...";
   *       try {
   *         const { truncated } = await sample("Explique esta configuração:\n\n" + src, {
   *           signal: ctl.signal,
   *           onText: ({ text }) => { out.textContent = text; },   // resposta completa até agora
   *         });
   *         if (truncated) note.textContent = "Cortado — peça menos de cada vez.";
   *       } catch (e) {
   *         out.textContent = e.text ?? "";                 // mantém o que pode ser mantido; senão limpa
   *         if (e.code !== "cancelled") note.textContent = copyFor(e.code);
   *       }
   *     };
   *
   *     // Chat: instruções permanentes são um turno inicial `user`; a lista termina na nova mensagem
   *     turns.push({ role: "user", content: box.value });
   *     const { text } = await sample([{ role: "user", content: RULES }, ...turns], {
   *       cache: false, signal: ctl.signal, onText: ({ text }) => { bubble.textContent = text; },
   *     });
   *     turns.push({ role: "assistant", content: text });
   *
   * @param input   O que o Claude lê: uma string de prompt, ou turnos
   *                `user`/`assistant` começando e terminando em um turno `user` — veja
   *                {@link sample.SampleInput}. No máximo 64 KiB de texto no total.
   * @param options {@link sample.SampleOptions}: `onText` para stream, `signal`
   *                para cancelar, `tools`, `images`, `modelTier`, `cache`.
   *                Opcional; deve ser um objeto simples.
   */
  function sample(
    input: sample.SampleInput,
    options?: sample.SampleOptions,
  ): Promise<sample.SampleResult>;

  namespace sample {
    /**
     * Peça dados ao Claude. A mesma chamada que {@link Claude.sample} — mesmo
     * input, opções, stream, consentimento, cache e erros — mas resolve
     * com a resposta analisada como um valor JSON em vez de `{text}`.
     *
     * Diga no prompt exatamente qual JSON você quer ("Responda apenas com uma
     * array JSON de objetos {name, score}" mais um exemplo em uma linha); a
     * plataforma também informa ao Claude que a resposta será analisada por máquina. A
     * resposta é lida com tolerância: a resposta inteira como JSON; caso contrário, o corpo de
     * uma caixa de código Markdown; ou o texto do primeiro `{` ou `[` até
     * o último `}` ou `]` (então uma frase antes ou depois do valor é
     * ignorada, mas dois valores, ou JSON embutido dentro de uma frase, não
     * são aceitos). Qualquer valor JSON pode voltar; o parâmetro de tipo é
     * conveniência do TypeScript e nada é validado em tempo de execução — verifique
     * os campos de que você depende. Se nenhum valor for analisado, ou a resposta foi cortada
     * pelo limite de tamanho, a chamada rejeita `invalid_json` com a
     * resposta bruta em `e.text`. Essa resposta nunca é armazenada em cache, então o "Tentar novamente" do visualizador realmente pergunta de novo — mas não tente repetir no código; se
     * continuar falhando, aperte a instrução ou peça menos. `onText`, se
     * passado, recebe o texto bruto da resposta conforme ele é transmitido. Com `tools`,
     * descreva a FORMA desejada como de costume; a plataforma informa ao Claude que
     * sua mensagem final (após qualquer uso de ferramenta) é a que será analisada, então a narração em
     * rodadas anteriores é ignorada. Se essa mensagem final não contiver JSON, a chamada
     * rejeita `invalid_json` com tudo escrito em `e.text`.
     *
     *     const tags = await sample.json(
     *       "Responda apenas com uma matriz JSON de até 5 tags curtas de tópico (strings) para:\n\n" + note,
     *       { modelTier: "quick" },
     *     );
     *     for (const t of tags) chips.append(chip(String(t)));
     */
    function json<T = unknown>(
      input: SampleInput,
      options?: SampleOptions,
    ): Promise<T>;

    /**
     * Resolva os limites desta visualização: o limite de bytes de entrada e um membro `images`
     * SOMENTE quando esta visualização puder enviar imagens (quantas por chamada, o
     * maior arquivo aceito, os tipos de arquivo). Use isso para decidir se deve
     * mostrar um affordance de imagem; trate uma rejeição como `images` ausente.
     * Barato e local — nenhum uso é gasto, o visualizador não é perguntado.
     *
     *     const caps = await sample.limits().catch(() => null);
     *     photoInput.hidden = !caps?.images;
     *     photoInput.accept = caps?.images?.mediaTypes.join(",") ?? "";
     */
    function limits(): Promise<SampleLimits>;

    // Entrada

    /**
     * O que o Claude lê. Ou:
     * - uma string — o prompt inteiro: instrução, dados da página e formato
     *   de saída, em um único bloco de texto (caso comum); ou
     * - um array de turnos `{role: "user" | "assistant", content}` — uma conversa curta
     *   que a PÁGINA mantém (o Claude não guarda nada entre chamadas),
     *   em ordem antiga primeiro, que deve COMEÇAR e TERMINAR com um turno `user`. Use isso
     *   para uma caixa de chat: empurre a mensagem do visualizador, chame, empurre a
     *   resposta do Claude. Turnos consecutivos com o mesmo papel são aceitáveis (um turno de
     *   instruções antes da primeira mensagem do visualizador; um chat cuja última resposta falhou e deixou doze turnos do usuário em sequência) e são lidos
     *   como um. Não existe papel `system`: instruções permanentes vão em um turno `user`
     *   inicial que você sempre mantém. Turnos de assistente são
     *   o que a página diz que são e a plataforma informa ao Claude — use-os para troca real,
     *   não para programar palavras na boca do Claude (isso piora as respostas).
     * Em qualquer caso, o texto total tem no máximo 64 KiB (`prompt_too_large` além
     * disso) — cerca de 60.000 caracteres em inglês, menos em outros
     * alfabetos: corte textos da página para alguns milhares de caracteres em vez de
     * medir, e elimine os turnos mais antigos do chat (nunca o seu turno de instruções)
     * conforme a conversa cresce. O array é copiado na chamada.
     */
    type SampleInput = string | SampleMessage[];

    /** Um turno de uma conversa {@link SampleInput}. */
    interface SampleMessage {
      /** `"user"` para o lado visualizador/página, `"assistant"` para uma resposta anterior
       * do Claude que você está mostrando novamente como contexto. Nenhum outro papel. */
      role: "user" | "assistant";
      /** Texto do turno. Não vazio. (Uma string simples — imagens vão em
       * `options.images`, não aqui.) */
      content: string;
    }

    /**
     * O argumento opcional do segundo parâmetro: um objeto simples, cada membro opcional.
     * Qualquer coisa que não seja um objeto simples — um Blob, FileList, função,
     * AbortController, string — rejeita `invalid_request` com uma
     * mensagem apontando a opção que você provavelmente quis dizer. Membros desconhecidos desta runtime
     * são ignorados (o console os nomeia uma vez).
     */
    interface SampleOptions {
      /**
       * Transmite a resposta. Chamado cada vez que mais dela foi escrita —
       * algumas vezes por segundo no máximo — com um objeto: `text` é a
       * RESPOSTA COMPLETA até então, `delta` é apenas a parte adicionada desde a última
       * chamada. Use o que couber: `el.textContent = text` (ou `setText(text)` do React) para mostrar a resposta,
       * `el.append(delta)` ou um efeito de máquina de escrever para animá-la. Nunca `+= text`.
       *
       * Garantias: `text` sempre igual ao `text` da chamada anterior +
       * `delta`, e `delta` nunca é vazio; nunca é chamado sincronamente
       * dentro de `sample()`; nunca é chamado depois que a promessa resolve ou depois
       * que seu `signal` aborta; a primeira chamada já tem texto visível
       * (não em branco); e antes de uma resolução bem-sucedida é chamado ao menos uma vez, sua última chamada carregando exatamente o `text` do resultado —
       * então uma resposta em cache, ou um app de visualizador que ainda não consegue transmitir, é
       * simplesmente uma chamada cujo `text` e `delta` são a resposta inteira,
       * seguida pela resolução. Nada dispara enquanto o Claude está
       * pensando, enquanto o diálogo de consentimento está aberto, ou enquanto a chamada espera
       * sua vez: mantenha seu placeholder até a primeira chamada. O valor de retorno é ignorado (uma função `async` não é aguardada); uma exceção
       * ou promessa rejeitada de `onText` é reportada ao console e
       * não afeta a chamada. Chamar `abort()` dentro de `onText`
       * é aceitável.
       *
       *     // Renderiza itens da lista conforme completam: peça um objeto JSON por LINHA
       *     let pending = "";
       *     const eatLines = ({ delta }) => {
       *       const lines = (pending + delta).split("\n");
       *       pending = lines.pop();                       // a linha incompleta
       *       for (const line of lines) if (line.trim()) addRow(safeParse(line));
       *     };
       *     await sample(
       *       'Sugira 8 nomes de projeto, um objeto {"name": string, "why": string} por linha, '
       *         + "sem nenhum outro texto.\n\n" + brief,
       *       { onText: eatLines },
       *     );
       *     if (pending.trim()) addRow(safeParse(pending));
       */
      onText?: (update: SampleTextUpdate) => void;

      /**
       * Cancela a chamada. Crie `new AbortController()` PARA ESTA CHAMADA,
       * passe `ctl.signal` e chame `ctl.abort()` a partir de um botão Stop, uma
       * mudança de input ou limpeza de efeito React. Um controlador por chamada:
       * um signal abortado continua abortado, então um reutilizado faz todas as chamadas posteriores
       * rejeitarem `cancelled` imediatamente (o console avisa quando vê isso). Ao abortar, a promessa rejeita `{code: "cancelled"}` prontamente
       * (`e.text` guarda qualquer resposta parcial), `onText` para, e o Claude é
       * instruído a parar de escrever para o visualizador parar de pagar pelo restante.
       * Abortar antes que a requisição saia da página — no mesmo
       * bloco síncrono da chamada, ou enquanto imagens estão sendo preparadas
       * — não envia nada: sem diálogo de consentimento, sem uso. Abortar
       * enquanto a chamada espera sua vez ou espera o diálogo de consentimento
       * não gasta uso; o diálogo continua aberto (a resposta dele governa
       * chamadas futuras) e esta chamada é simplesmente descartada. Uma chamada ainda em fila
       * para um runtime que ainda não começou rejeita quando o runtime começa
       * (normalmente bem abaixo de um segundo). O código é sempre `cancelled`
       * qualquer que seja a razão do signal; a razão fica no seu signal
       * se você precisar distinguir seu botão Stop da sua limpeza. Não existe opção de timeout e você não deve criar uma: a plataforma
       * já encerra uma chamada muito longa, e um timer do lado da página também contaria
       * o tempo em que o visualizador passa lendo o diálogo de consentimento. Deve ser um `AbortSignal` — passar o próprio controlador rejeita
       * `invalid_request`.
       */
      signal?: AbortSignal;

      /**
       * Imagens para o Claude olhar, mostradas com o turno final (ou único)
       * do usuário: um `Blob`/`File` JPEG, PNG, WebP ou GIF, ou uma lista deles
       * (um array, um `FileList`) — um arquivo escolhido pelo visualizador,
       * saída de `canvas.toBlob()` — no máximo `limits().images.maxCount` por
       * chamada. A plataforma redimensiona cada um para cerca de 1,2 megapixels, aplica
       * orientação, mantém o primeiro frame de animação e remove metadados
       * antes de qualquer envio; diga no prompt quais são as imagens e
       * o que fazer com elas. Apenas onde {@link limits} informa `images` —
       * em outro lugar a chamada rejeita `images_unavailable`; um arquivo de outro
       * tipo, indecodificável, ou acima de 20 MB / 10.000 px por lado / 64 megapixels
       * rejeita `image_rejected`. A página não pode buscar imagens por URLs
       * (sua rede é bloqueada): peça ao visualizador para escolher ou soltar o arquivo.
       * Em um chat, imagens de turnos anteriores não são reenviadas — descreva
       * elas em texto se ainda importarem.
       */
      images?: Blob | Blob[] | FileList;

      /**
       * Qual família de modelo responde. `"default"` (omitido): o modelo equilibrado
       * do dia a dia. `"complex"`: o mais capaz, para raciocínio difícil
       * (pensa mais). `"quick"`: o mais rápido, para trabalho rotineiro curto —
       * classificação, tags, reescritas de uma linha, JSON pequeno e
       * respostas conversacionais em que a rapidez importa mais do que a profundidade —
       * ele não pensa primeiro, então o texto começa quase imediatamente. Para uma lista
       * de itens, prefira UMA chamada que retorna uma matriz JSON em vez de uma chamada
       * por item. A plataforma pode servir um tier mais barato próximo quando o
       * plano do visualizador não tem o pedido —
       * {@link SampleResult.modelTierApplied} informa qual tier realmente
       * respondeu.
       */
      modelTier?: ModelTier;

      /**
       * Cache da resposta — ATIVADO por padrão. Uma resposta que este visualizador já
       * recebeu neste artefato para o mesmo `input` (cada turno),
       * `modelTier`, `images` (idêntico em bytes) e verbo (`sample` vs
       * `json`) é repetida em uma chamada posterior: nenhum uso é gasto, o Claude não é
       * contatado, `onText` dispara uma vez com o texto inteiro e a
       * promessa resolve. Uma chamada idêntica feita enquanto a primeira ainda
       * está em execução compartilha sua resposta em streaming em vez de perguntar duas vezes.
       * Apenas respostas bem-sucedidas são armazenadas (incluindo `truncated`,
       * que repetem com `truncated: true`); rejeições — `cancelled`,
       * `invalid_json`, qualquer outra — nunca são, então repetir após uma
       * falha não exige opção. O consentimento continua igual: a primeira chamada em uma
       * visualização ainda pergunta. Entradas são por visualizador, por artefato, por navegador;
       * melhor esforço; limpas no sign-out. Input que incorpora dados mutáveis
       * simplesmente nunca bate.
       *
       * A janela: uma resposta é repetida enquanto é mais nova que o
       * `gcTime` da chamada que a armazenou E da chamada que pergunta agora
       * (cinco minutos quando nenhum diz o contrário) — então passe o mesmo
       * valor de `cache` em toda chamada para um prompt dado.
       *
       * Omitido ou `true` — a janela padrão de cinco minutos.
       * `false` — pergunta sempre ao Claude, não armazena nada, não compartilha nada. Use isso
       *   sempre que uma repetição DEVE produzir uma nova resposta: cada turno de um chat,
       *   "Regenerate", "Try another".
       * `{gcTime}` — mantém e reutiliza por até `gcTime` ms, máximo 24 h (um
       *   resumo de conteúdo que muda raramente; deixe prompts assim
       *   curtos para a resposta armazenada ser completa).
       * `{gcTime, refresh: true}` — pergunta ao Claude agora (gastando uso) e
       *   sobrescreve a resposta armazenada: um botão "Refresh". Passe o mesmo
       *   `gcTime` da chamada de carregamento.
       * Qualquer outro valor rejeita `invalid_request`. Uma chamada com `tools` nunca é
       * armazenada nem compartilhada; passar `cache` (diferente de `false`) com
       * `tools` rejeita `invalid_request`.
       */
      cache?: boolean | SampleCacheOptions;

      /**
       * Funções DESTA PÁGINA que o Claude pode chamar enquanto trabalha na
       * resposta — lê o estado do app (`getTrack`) ou o altera
       * (`setTrackVolume`). O Claude lê o `name`, `description`
       * e `inputSchema` de cada ferramenta (nunca seu código), decide quando e se
       * vai chamar, e seu `execute` roda AQUI na página com os argumentos
       * que o Claude escolheu. Qualquer coisa que `execute` retorne — ou lance — volta ao
       * Claude, que então chama mais ferramentas ou escreve a resposta. A promessa
       * ainda resolve uma vez, com a resposta final; nada sobre as rodadas
       * é retornado — o próprio `execute` em execução É o evento.
       *
       * Custo e tempo: cada rodada é uma requisição paga separada na conta do visualizador
       * que releia tudo até então; uma chamada que usa duas ferramentas
       * é três requisições. Prefira `"quick"` para manipulação direta (cerca de um
       * segundo por rodada); uma chamada `"default"` de três rodadas normalmente leva 30-90 s.
       * A plataforma permite algumas rodadas e faz a última ser uma
       * resposta. Então: poucas ferramentas, resultados simples e pequenos, estado da página que cabe
       * no prompt vai no prompt. Chamadas com ferramentas nunca são cacheadas:
       * omita `cache` (qualquer valor diferente de `false` rejeita `invalid_request`) e
       * chame no clique. Apenas onde {@link limits} informa `tools` — em outro lugar
       * a chamada rejeita `tools_unavailable`.
       *
       * `onText` funciona como sempre: texto antes e depois de uma rodada de ferramenta chega
       * como UM `text` crescente com uma linha em branco entre as rodadas. `signal` interrompe
       * tudo: a promessa rejeita `cancelled`, cada `execute` em execução vê `context.signal` abortar,
       * nenhuma rodada adicional é feita. Qualquer coisa que suas
       * ferramentas já fizeram permanece feita. Texto dentro dos dados da página e dos resultados das ferramentas
       * pode influenciar quais ferramentas o Claude chama a seguir, então coloque qualquer coisa
       * destrutiva atrás de sua própria etapa de confirmação ou torne-a reversível.
       * Em TypeScript, anote uma lista pré-construída como `SampleTool[]` (como o
       * exemplo de chat anota `SampleMessage[]`); ferramentas inline não precisam de nada.
       */
      tools?: SampleTool[];
    }

    /** A forma de objeto de {@link SampleOptions.cache}. `{}` usa os padrões. */
    interface SampleCacheOptions {
      /** Quanto tempo uma resposta armazenada pode ser repetida, em ms: um número finito
       * maior que zero, padrão 300000 (5 min); valores acima de 86400000
       * (24 h) são tratados como 24 h. Para desativar o cache, passe `cache: false`
       * — `gcTime: 0` rejeita `invalid_request`. */
      gcTime?: number;
      /** Pula a resposta armazenada uma vez: pergunte ao Claude agora e sobrescreva-a. */
      refresh?: boolean;
    }

    /** Uma função de página oferecida ao Claude. Um objeto simples, lido uma vez na chamada. */
    interface SampleTool {
      /** 1-128 de `A-Z a-z 0-9 _ -`, único na lista. `getTrack`, `set_volume`. */
      name: string;
      /** O que faz, o que RETORNA, quando usar — 1-3 frases, no máximo 1 KB.
       * Isso é tudo que o Claude sabe sobre a ferramenta. Obrigatório. */
      description: string;
      /** Schema JSON para UM argumento de objeto — `{type:"object", properties, required}`,
       * o formato usado pelos conectores `claude.mcp`; no máximo 4 KB; enviado ao Claude como está.
       * Omitir para uma ferramenta sem argumentos. Não é forçado: coerce e verifique dentro de `execute`. */
      inputSchema?: SampleToolInputSchema;
      /** Executa na página quando o Claude chama a ferramenta. `input` é o objeto
       * que o Claude enviou, moldado por `inputSchema` mas não validado: coerce o que você
       * usa (`String(id)`, `Number(db)`) — os valores `unknown` fazem o TypeScript
       * exigir exatamente isso. Retorne uma string ou dado simples
       * (JSON-encoded, no máximo 32 KB). Para relatar um problema, LANÇE: o Claude recebe
       * "Error: <message>" como resultado e segue em frente — a chamada não falha.
       * Pode ser assíncrono; `context.signal` aborta em Stop, no settle ou após 150 s.
       * Várias chamadas em uma rodada rodam simultaneamente. */
      execute(
        input: { [name: string]: unknown },
        context: SampleToolContext,
      ): unknown;
    }

    /** O segundo argumento de {@link SampleTool.execute}. */
    interface SampleToolContext {
      /** Aborta quando o `signal` da chamada aborta, quando a chamada termina enquanto esta
       * ferramenta ainda roda, ou após 150 s. Passe adiante (`mcp.callTool(..., {signal})`),
       * e verifique `signal.aborted` depois de um `await` antes de aplicar um efeito. */
      signal: AbortSignal;
    }

    /** Schema JSON para um argumento de objeto de ferramenta (tipo `inputSchema` do MCP). */
    interface SampleToolInputSchema {
      type: "object";
      properties?: { [name: string]: unknown };
      required?: string[];
      [keyword: string]: unknown;
    }

    /** O argumento de {@link SampleOptions.onText}. */
    interface SampleTextUpdate {
      /** A RESPOSTA COMPLETA até então. Atribua: `el.textContent = text`. */
      text: string;
      /** Apenas o que foi adicionado desde a chamada anterior. Anexe se 
       * animar: `el.append(delta)`. Sempre `text === previousText + delta`. */
      delta: string;
    }

    type ModelTier = "default" | "complex" | "quick";

    // Saída

    /** O que {@link Claude.sample} resolve — um objeto simples. */
    interface SampleResult {
      /** O texto completo da resposta — a mesma string da última chamada `onText`
       * recebida. Nunca vazio ou em branco (isso rejeita `empty_completion`).
       * Com `tools`, o texto de cada rodada, com uma linha em branco entre elas. */
      text: string;
      /** `true` quando a resposta atingiu o limite de tamanho ou tempo e para
       * no meio do raciocínio. O texto continua sendo tudo que o Claude escreveu: mostre isso
       * com uma nota, e peça menos ou divida a tarefa na próxima vez.
       * Normalmente `false`. */
      truncated: boolean;
      /** O tier que realmente respondeu — o que você pediu, ou o
       * substituto que o plano do visualizador permitiu. Se você oferecer uma escolha de tier,
       * é assim que você informa ao visualizador que não pôde ser atendido. */
      modelTierApplied: ModelTier;
    }

    /** Forma de resolução para {@link limits}. */
    interface SampleLimits {
      /** Maior `input`, em bytes UTF-8 de texto — a string do prompt, ou todos
       * os `content` dos turnos juntos (65536). */
      maxPromptBytes: number;
      /** Presente apenas quando esta visualização pode enviar `images`. */
      images?: ImageLimits;
      /** Presente apenas quando esta visualização pode executar {@link SampleOptions.tools}. */
      tools?: ToolLimits;
    }

    /** O lado de imagem de {@link SampleLimits}. */
    interface ImageLimits {
      /** Máximo de imagens que uma chamada pode carregar. */
      maxCount: number;
      /** Maior arquivo de entrada aceito, em bytes (antes do redimensionamento). */
      maxInputBytes: number;
      /** Tipos de arquivo aceitos, por exemplo `"image/jpeg"` — úteis como lista
       * `accept` de um input de arquivo. */
      mediaTypes: string[];
    }
    interface ToolLimits {
      /** Máximo de ferramentas que uma chamada pode oferecer. */
      maxCount: number;
    }

    // Erros

    /**
     * A forma de falha única: o que `sample()` e `json()` rejeitam. Um
     * objeto simples, não um `Error` (`String(e)` é inútil — leia os
     * campos). Ramifique em `.code`; `.message` é texto voltado para desenvolvedor,
     * não para cópia de visualizador. `.text` é a parte da resposta que você pode manter na
     * tela: presente sempre que texto foi transmitido antes da falha — qualquer
     * código, já que com `tools` até `not_granted` ou `rate_limited` podem
     * chegar entre rodadas — e igual ao último `onText` recebido; a
     * resposta bruta inteira em `invalid_json`; ausente quando nada havia sido transmitido
     * e em `refused` (retirada — limpe o que você renderizou). Ferramentas que
     * já rodaram rodam — `e.text` não desfaz isso.
     */
    interface SampleError {
      code: SampleErrorCode;
      message: string;
      text?: string;
    }

    /**
     * Códigos de erro estáveis, agrupados pelo que a página deve fazer. Trate um
     * código desconhecido como `"upstream_error"`. Apenas `upstream_error` é
     * transitório; NUNCA tente novamente qualquer código em loop.
     *
     * Você fez isso — restaure a IU ociosa, mantenha `e.text` se quiser:
     * - `cancelled` — seu `signal` abortou (Stop, input substituído,
     *   desmontagem) ou já estava abortado quando você chamou. Não é algo para
     *   dizer ao visualizador. Se disparou depois que o Claude começou, algum uso foi
     *   gasto.
     *
     * Bug da página — nada foi enviado; a mensagem diz o que mudar:
     * - `invalid_request` — a chamada está malformada: `input` vazio, não é
     *   string ou lista de turnos (a forma de objeto `sample({prompt})` da 0.2 cai
     *   aqui — a prompt vai primeiro agora), turnos não começando e terminando
     *   em `user`, um turno com outro papel ou conteúdo vazio, `options`
     *   não é um objeto simples, `signal` não é `AbortSignal` ( passe
     *   `ctl.signal`, não o controller), `onText` não é função, um
     *   `modelTier` desconhecido, `images` não são Blobs, `cache` não é
     *   `true`/`false`/`{gcTime?, refresh?}`, `tools` não é uma array de
     *   {@link SampleTool}s bem formados (a mensagem nomeia a entrada e a
     *   regra), `cache` passado com `tools`, ou um `inputSchema` de ferramenta que a
     *   API do Claude recusou. (Raramente, o próprio serviço recusa a requisição como
     *   malformada depois que o texto começou; `e.text` então carrega o parcial.)
     * - `prompt_too_large` — mais de 64 KiB de texto, ou as rodadas de ferramentas de uma chamada
     *   excederam o que o Claude consegue ler de uma vez (retorne menos por ferramenta). Envie um
     *   trecho, um resumo ou menos turnos.
     * - `transform_error` — os argumentos não puderam ser preparados; trate como
     *   `invalid_request`.
     * - `queue_overflow` — centenas de chamadas foram feitas antes do runtime
     *   começar (um loop no carregamento).
     *
     * Oculte o recurso para esta visualização — permanente, nunca pergunte de novo, sem `text`:
     * - `not_granted` — o visualizador (ou sua organização) não permitiu
     *   que este artefato use o Claude.
     * - `sampling_disabled` — o Claude não está disponível para esta conta ou
     *   organização.
     * - `not_declared` — o artefato não declara mais `sample`.
     * - `capability_disabled` — concedido, mas indisponível nesta visualização.
     * - `capability_removed` — o método não está no runtime que serve
     *   esta visualização (por exemplo, `json` em um app de visualizador antigo).
     * - `images_unavailable` — esta visualização não pode enviar imagens (verifique
     *   {@link limits} primeiro). Oculte apenas o affordance de IMAGEM; chamadas de texto
     *   funcionam.
     * - `tools_unavailable` — esta visualização não pode executar ferramentas da página (verifique
     *   {@link limits} primeiro). Oculte o que depende delas; chamadas simples funcionam.
     *
     * Informe o visualizador, mantenha o controle — eles podem tentar de novo mais tarde ou com
     * entrada diferente; a página nunca tenta de novo sozinha:
     * - `rate_limited` — muitas chamadas (um excesso desta página além das
     *   poucas que esperam sua vez; outra cópia aberta deste artefato usando os slots do visualizador), muito frequentemente, ou o próprio limite de uso do visualizador
     *   (que também pode encerrar uma resposta no meio, com `e.text`). Reduza o ritmo;
     *   deixe o VISUALIZADOR tentar de novo mais tarde.
     * - `session_expired` — o visualizador precisa entrar novamente.
     * - `image_rejected` — muitas imagens, tipo errado, indecodificável ou
     *   grande demais. Peça ao visualizador outro arquivo.
     * - `refused` — o Claude recusou esta entrada, possivelmente APÓS alguma parte do texto
     *   ter sido transmitida. Qualquer parcial é retirado (`e.text` ausente): limpe
     *   o que você mostrou. Reenviar inalterado dá o mesmo resultado;
     *   mude o que ele pergunta. Qualquer coisa que suas ferramentas já fizeram permanece feita.
     * - `empty_completion` — o Claude não produziu texto (nenhum `onText` precedeu
     *   isso) (com `tools`: nenhuma rodada produziu texto). Não reenvie inalterado;
     *   simplifique ou peça menos.
     * - `invalid_json` — apenas {@link json}: a resposta não continha um valor JSON analisável,
     *   ou foi cortada antes de estar completa (a mensagem
     *   diz qual); `e.text` é a resposta bruta. Não fica em cache: ofereça "Tentar novamente"; se continuar falhando, aperte a instrução de formato.
     * - `upstream_error` — qualquer outra coisa: falha transitória de serviço ou
     *   conexão, antes ou durante a resposta. Mantenha qualquer parcial
     *   (`e.text`), marque como interrompido, ofereça uma tentativa manual.
     */
    type SampleErrorCode =
      | "invalid_request"
      | "prompt_too_large"
      | "images_unavailable"
      | "tools_unavailable"
      | "image_rejected"
      | "cancelled"
      | "not_granted"
      | "session_expired"
      | "sampling_disabled"
      | "not_declared"
      | "rate_limited"
      | "refused"
      | "empty_completion"
      | "invalid_json"
      | "upstream_error"
      | "capability_disabled"
      | "capability_removed"
      | "transform_error"
      | "queue_overflow";
  }
}

interface ClaudeCapabilityMap {
  sample: typeof Claude.sample;
}
