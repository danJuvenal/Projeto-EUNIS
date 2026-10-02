/**
 * A capacidade `user` — fatos sobre a pessoa que está vendo esta página e
 * sobre as pessoas às quais seu estado compartilhado se refere. Obtenha o namespace com
 * `const user = await claude.use("user")`; `null` (sem visualizador aqui, ou a
 * visualização não pode executar a capacidade) equivale aos padrões de ausência total para
 * leituras booleanas e strings — `user?.isOwner() ?? false` dá a mesma
 * resposta que eles dariam. Leituras de objeto precisam do próprio ramo null: o
 * `profiles(ids)` dos padrões resolve entradas renderizáveis, enquanto um namespace `null`
 * não tem nada para chamar.
 *
 * UMA regra para todo o namespace: toda leitura resolve um valor e NUNCA
 * REJEITA — uma string de exibição ("" quando não está disponível para este visualizador), um
 * dado opcional (null quando não está disponível), [] para uma busca, booleanos false,
 * ou um objeto cujos campos seguem as mesmas regras. "Não disponível" cobre
 * todas as razões de uma vez (sem visualizador, escopo não declarado, política da organização,
 * visualizador fora da organização, sessão degradada) e não há nada para
 * capturar. A grafia é fixa: strings de exibição (name) são "" quando retidas ou
 * desconhecidas — falsy, então `p.name || "Someone"` renderiza e `if (p.name)`
 * discrimina (observe: ?? NÃO captura "" — use ||); dados opcionais (id,
 * email) são null; nunca uma chave ausente, nunca undefined.
 *
 * Escopos bloqueiam CAMPOS, uniformemente, em todos os lugares onde esses campos aparecem — me(),
 * profiles(), search() e os acessadores por campo igualmente:
 *
 *   (nada)                                                   // isOwner, canEdit, can; me() com id/email null, name ""
 *   capabilities: { user: {} }                               // + id (o seu); profiles() resolve, nomes permanecem ""
 *   capabilities: { user: { scopes: ["profile"] } }          // + nomes, avatares, search()
 *   capabilities: { user: { scopes: ["profile","email"] } }  // + email (o seu e dos outros)
 *
 * "profile" é em formato OIDC: identidade de exibição apenas — nunca
 * inclui email. Um escopo declarado é um teto, não uma garantia: qualquer campo governado
 * ainda pode ser "" / null para um visualizador específico (cada um também precisa da
 * organização do visualizador permitir isso).
 *
 * Todo visualizador recebe HTML IDÊNTICO: essas leituras mudam o que você RENDERIZA,
 * nunca o que um visualizador pode extrair do código-fonte. ARMAZENE SOMENTE IDS — a partir de id(),
 * (await me()).id, ou o .id de um hit de search() — nunca um nome, avatar, email ou
 * objeto Profile: nomes diferem por visualizador, congelam no momento da escrita e sobrevivem
 * às pessoas. Nomes e e-mails são ENTRADA DE OUTRAS PESSOAS: defina-os com textContent.
 */
declare namespace Claude {
  namespace user {
    // -- universal: sem declaração necessária --------------------------------------

    /** Esta pessoa é proprietária do artefato. false quando não há visualizador. */
    function isOwner(): Promise<boolean>;

    /** Esta pessoa pode publicar novas VERSÕES DA PÁGINA — ou seja, `artifact publish`
     *  não rejeitaria `not_writer`; leia isso antecipadamente em vez de esperar a
     *  rejeição. Para `db` é o nível `admin`: bloqueie os controles que uma
     *  regra declarada reserva para `admin` nisso. Isso NÃO significa "pode
     *  escrever documentos `db` compartilhados" — por padrão o nível `interact` também os escreve
     *  — e também não significa `id()`: um membro somente de visualização tem um id e
     *  não pode escrever, enquanto um editor convidado de fora da organização
     *  escreve e não tem nenhum. Para essa pergunta, pergunte `can("data.write")`; quando
     *  resolver `null`, mantenha o controle e deixe uma gravação recusada decidir
     *  em vez de cair para este. false quando não houver visualizador. */
    function canEdit(): Promise<boolean>;

    /** Se esta pessoa pode fazer uma coisa nomeada neste artefato, como a
     *  plataforma a decidiu para esta visualização: true ou false. `null` = a plataforma
     *  não informou nada a esta página (por exemplo, um host antigo, uma página aberta
     *  no topo, um visualizador fora da organização, ou nenhum visualizador), e
     *  então todo nome resolve `null`: `null` NÃO é "não pode", então decida sem
     *  `can()`: mantenha um controle de dados compartilhados e deixe uma gravação recusada decidir;
     *  para os dois nomes de escrita de arquivo, use `canEdit()`. Os nomes:
     *    "data.write"      altera os documentos compartilhados `db` do artefato
     *    "files.write"     publica os próprios arquivos e versões da página do artefato
     *    "assets.write"    envia e exclui ativos
     *  Quando a plataforma responde de qualquer forma, qualquer outra string resolve false, então
     *  uma página escrita para um nome que um host posterior adiciona simplesmente não oferece esse
     *  controle nesta. A resposta é um conselho sobre o que OFERECER; o
     *  servidor impõe todas as ações reais independentemente e pode recusar uma.
     *  "data.write" é sobre documentos compartilhados apenas: a subárvore `data/users/<id>/`
     *  de um visualizador segue sua própria regra `db` daquele caminho, então escreva
     *  ali e trate a rejeição. Fixo pela vida de uma visualização. `can()`
     *  não altera a resposta de nenhum outro membro. Não exige declaração. */
    function can(capability: string): Promise<boolean | null>;

    /** O visualizador, em UM único await. NUNCA `null` e nunca rejeita: cada campo é
     *  ""/`null`/`false` exatamente quando o acessador do mesmo nome seria, então
     *  `(await me()).id === await id()`, sempre, e `isMe` de um Perfil é exatamente
     *  `p.id === isso`. `avatarUrl` e `color` são SEMPRE renderizáveis (uma marca genérica
     *  e uma cor neutra quando este visualizador não tem identidade aqui); `name`
     *  é "" então — renderize `me.name || "you"`. Funciona sem nenhuma declaração
     *  (id/email `null`, name ""; `isOwner`/`canEdit` ainda reais). Os acessadores por campo abaixo
     *  são projeções desse objeto — use qualquer leitura que seja melhor. */
    function me(): Promise<Viewer>;

    interface Viewer {
      /** Seu id nesta organização do artefato: um token opaco (u_...);
       *  precisa de `capabilities:{user:{}}`. `null` = sem identidade nesta página (desconectado,
       *  fora da organização, ou a capacidade não declarada). O valor que `db`
       *  reconhece em `data/users/<id>/`. */
      id: string | null;
      /** Seu nome de exibição; precisa do escopo "profile". "" quando não estiver disponível para
       *  este visualizador — falsy por propósito: `me.name || "you"`. */
      name: string;
      /** Sempre uma URL renderizável em `<img>`: sua foto de perfil, servida a partir da
       *  própria origem do artefato, quando você tem uma e a claude.ai a mostra aqui;
       *  caso contrário, uma URL `data:` (iniciais desenhadas em `color`, ou uma marca genérica
       *  quando você não tem identidade aqui). Opaca e relativa ao visualizador: renderize,
       *  nunca analise nem armazene. */
      avatarUrl: string;
      /** Estável por conta em todos os artefatos, visualizadores e sessões; paleta do shell
       *  com contraste seguro em claro e escuro. Cursores, chips, bordas. */
      color: string;
      /** Precisa do escopo "email" E da organização do visualizador permitindo isso. */
      email: string | null;
      isOwner: boolean;
      canEdit: boolean;
    }

    // -- capabilities: { user: {} } -------------------------------------------

    /** O id do visualizador: um token opaco por ORGANIZAÇÃO — o mesmo para você
     *  em todos os artefatos que sua organização possui e em toda capacidade
     *  (`db`'s private data/users/<id>/ subtree, linhas que você atribui, votos que você
     *  conta); sem significado fora da organização; rompido se a conta for
     *  excluída. Opaco: nunca analise, encurte ou mostre. `null` = sem identidade
     *  aqui. Resolva para uma pessoa com `profiles()` — nunca armazene o nome que ele
     *  resolveu. */
    function id(): Promise<string | null>;

    /** Uma pessoa COMO ESTE VISUALIZADOR A VEÊ AGORA. Persista apenas `id` — nunca
     *  escreva nome / email / avatarUrl / color em `db` ou no código-fonte da página (eles
     *  diferem por visualizador, ficam obsoletos e sobrevivem às pessoas); resolva
     *  novamente com `profiles()` ao renderizar. Dois visualizadores de uma mesma página podem
     *  ver nomes diferentes para o mesmo id legitimamente. */
    interface Profile {
      /** O id da pessoa — o valor que SEU `id()` retorna nesta organização
       *  (um token opaco), e a ÚNICA coisa sobre eles para escrever no estado.
       *  Todo id que você passa para `profiles()` recebe uma entrada: uma pessoa que este visualizador
       *  não consegue resolver volta com `name` "". */
      id: string;
      /** Seu nome de exibição atual, ou "" quando este visualizador não consegue resolver
       *  eles (outra organização, não mais resolvível, diretório desligado,
       *  escopo ausente, ou um id perdido — deliberadamente um único sinal). Falsy
       *  por propósito: renderize `p.name || "Someone"`, ramifique com `if (p.name)`.
       *  Observe que `??` não captura "" — use `||`. Texto definido pelo usuário: defina com
       *  `textContent`. */
      name: string;
      /** Nunca `null`. Uma URL renderizável em `<img>`: a foto de perfil deles, servida a partir da
       *  própria origem do artefato, quando eles têm uma e a claude.ai a mostra a
       *  este visualizador; caso contrário, uma URL `data:` (iniciais em `color`, ou uma marca genérica
       *  quando não resolvido). Opaca e relativa ao visualizador: renderize, nunca
       *  analise nem armazene. */
      avatarUrl: string;
      /** Estável por conta; cada página e cada visualizador recebe o mesmo valor. */
      color: string;
      /** `null` a menos que o escopo "email" esteja declarado E a organização do visualizador
       *  permita E a pessoa seja resolvível. Proteja antes de renderizar. */
      email: string | null;
      /** `p.id === (await id())`. Nunca armazene. */
      isMe: boolean;
    }

    /** Resolva as pessoas às quais seu estado se refere. SOMENTE EM BATCH POR DESENHO (há
     *  deliberadamente nenhuma forma de ID único): colete os ids que você está prestes a
     *  desenhar, resolva e depois consulte de forma síncrona —
     *
     *      const ps = await user.profiles(idsOnScreen);
     *      cell.textContent = ps[id].name || "Someone";  img.src = ps[id].avatarUrl;
     *
     *  Chame isso DENTRO do seu caminho de renderização, toda vez que renderizar. Chamadas repetidas
     *  são baratas POR CONTRATO: entradas são armazenadas em cache pela vida da página,
     *  chamadas concorrentes são coalescidas em uma única viagem de ida e volta, e entradas em cache
     *  são atualizadas em segundo plano — então "chame de novo" é sempre certo,
     *  e elevar uma chamada para o carregamento fica obsoleta assim que alguém novo
     *  aparece no estado compartilhado. Chaves são EXATAMENTE os ids únicos que você passou:
     *  ids desconhecidos, estrangeiros, apagados ou inválidos recebem uma entrada não resolvida (`name` "",
     *  avatar genérico, cor estável); nada é adicionado, nada é removido.
     *  Qualquer comprimento (o shell divide e deduplica; entradas absurdas resolvem como
     *  entradas não resolvidas com um aviso no console). Uma string simples é tratada
     *  como `[string]`. Sem o escopo "profile" toda entrada é não resolvida. Um hit
     *  de `search()` já está aquecido. Nunca rejeita. */
    function profiles(
      ids: readonly string[] | string,
    ): Promise<Record<string, Profile>>;

    // -- scope "profile" -------------------------------------------------------

    /** `(await me()).name` — seu nome de exibição, ou "" quando não estiver disponível para
     *  este visualizador (falsy: `(await name()) || "you"`). */
    function name(): Promise<string>;
    /** Sua URL de avatar (foto, ou um URL `data:` com iniciais), ou `null` quando você
     *  não tem identidade aqui. Prefira `(await me()).avatarUrl`, que nunca é
     *  `null`. */
    function avatarUrl(): Promise<string | null>;

    /** Um typeahead inline sobre a ORGANIZAÇÃO do visualizador, para um seletor de menção
     *  `@` ou de responsável que você renderiza. Um typeahead, não um roster: no máximo
     *  8 perfis, melhor correspondência primeiro, classificado por relevância e não exaustivo;
     *  ele nunca crescerá com uma opção de limite, cursor ou flag "more".
     *  `search("")` resolve o CONJUNTO PADRÃO relativo à audiência (você, mais ids
     *  que esta página já resolveu) — chame ao focar para que o menu abra
     *  pré-selecionado; vazio em uma página que não resolveu ninguém. Qualquer outra
     *  consulta pesquisa o diretório por nome
     *  ou email; VALORES de email são retornados somente no escopo "email".
     *  `[]` significa sem correspondência OU indisponível
     *  (desconectado, outra organização, um visualizador que não pode editar, ou uma
     *  organização que retém colegas), nunca "continue digitando". Chame
     *  diretamente no `oninput`: a plataforma debounces, e uma chamada substituída
     *  por uma `search()` mais nova resolve com o RESULTADO DA CHAMADA NOVA no mesmo
     *  momento, então manipuladores ingênuos sempre pintam a lista final. Os hits são
     *  os mesmos objetos que `profiles()` retornaria agora. Armazene `hit.id`, nunca
     *  o hit; coloque `hit.name` / `hit.email` em linhas com `textContent` (um hit
     *  sempre tem um nome não vazio — linhas sem nome nunca são oferecidas).
     *  Uma busca encontra pessoas para escolher e não faz mais nada: ela não notifica
     *  ninguém e não concede acesso. Nunca rejeita. */
    function search(query: string): Promise<Profile[]>;

    // -- scope "email" ---------------------------------------------------------

    /** `(await me()).email` — seu próprio email, ou `null`. */
    function email(): Promise<string | null>;
  }
}

interface ClaudeCapabilityMap {
  user: typeof Claude.user;
}
