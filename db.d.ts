/**
 * A capacidade `db` — um armazenamento de documentos persistente e em tempo real para este
 * artefato, compartilhado por seus visualizadores.
 *
 * Um armazenamento por artefato: documentos JSON em caminhos separados por barras
 * (`collection/doc`, aninhando mais fundo como `collection/doc/subcollection/doc`),
 * sobrevivendo a recarregamentos, republicações e sessões. O armazenamento é criado na
 * primeira gravação e apagado quando o artefato é excluído. Leituras e
 * assinaturas veem as gravações de outros visualizadores ao vivo. Declare
 * `capabilities: {db: {}}` — um artefato declarante é interno à organização
 * e não pode ser compartilhado publicamente, então todo leitor e escritor é um
 * membro conectado da organização do dono.
 *
 * REGRAS DE ACESSO. Por padrão, todo visualizador lê e grava documentos compartilhados
 * e a subárvore própria de cada visualizador `data/users/<id>/` é privada.
 * Para mudar quem pode ler ou gravar onde, declare regras chaveadas pela
 * categoria de compartilhamento do visualizador — `interact` (pode interagir: usa a página e
 * altera seus dados compartilhados), `admin` (pode editar: também publica versões
 * e ativos; o menu de compartilhamento "Pode editar", Editor ou Manager, ou um editor
 * convidado por e-mail enquanto o artefato não foi também compartilhado por link),
 * `owner`, além de `view`, o nível mais baixo, para caminhos que devem permanecer
 * legíveis por todos que o servidor admite (todo visualizador conectado a um
 * artefato db tem pelo menos `interact`, então `view` só alarga leituras,
 * nunca gravações) — como nível mínimo para cada ação em um caminho e abaixo:
 *   capabilities: { db: { rules: [
 *     { path: "", read: "interact", write: "admin" },
 *     { path: "data/users/{self}", write: "interact" },
 *   ] } }
 * lê "qualquer pessoa que pode abrir a página lê os dados compartilhados, apenas editores
 * gravam ali, e cada visualizador grava sua própria subárvore". Uma regra se aplica
 * ao seu caminho e tudo abaixo; uma regra mais profunda o substitui ali e
 * pode ser mais estrita ou mais flexível. Um nível deixado sem valor herda do nível mais próximo acima
 * (a raiz padrão é read: "view", write: "interact").
 * Um artefato criado a partir de um tipo costuma vir com as regras do tipo
 * já declaradas (comumente `write: "admin"` em dados compartilhados): leia seu
 * manifesto antes de assumir os padrões.
 * Gravar implica ler: o nível de escrita de uma regra nunca fica abaixo do de leitura.
 * Um caminho terminando em `/{self}` nomeia a subárvore própria de cada visualizador sob
 * esse prefixo: ninguém mais — o dono do artefato incluso — vê a subárvore de um irmão sem que uma regra no prefixo a abra, e `{self}`
 * deve ser o último segmento. `{self}` funciona sob QUALQUER prefixo, não só
 * `data/users`: "todos leem os votos, cada visualizador grava apenas
 * o seu" é
 *   { path: "votes", read: "view", write: "admin" },
 *   { path: "votes/{self}", write: "interact" }
 * com cada visualizador gravando `votes/<seu id>` (ou documentos abaixo dele) —
 * uma regra declarada NO prefixo de uma regra `{self}` (aqui `votes`) deve
 * definir AMBOS `read` e `write`, ou a declaração é rejeitada na
 * publicação; sem regra de prefixo, subárvores irmãs permanecem privadas como em
 * `data/users`. No máximo 64 regras; os caminhos seguem a
 * gramática de caminhos de documento abaixo. O dono atende a todos os níveis, então regras de nível
 * nunca limitam o dono; apenas a privacidade de `{self}` faz isso. Quem tem
 * qual nível, nas palavras do menu de compartilhamento: "Pode editar", Editor e Manager
 * têm `admin`, assim como um editor convidado por e-mail (onde o menu
 * o oferece) a menos que o artefato também seja compartilhado por link. "Pode
 * interagir", em uma pessoa ou em acesso geral, tem `interact`, como
 * também um membro da organização que chega por link público. Um membro somente leitura (Viewer ou "Pode ver"; mas em um menu antigo que
 * não oferece nível somente leitura, uma pessoa listada como Viewer e o
 * "Pode ver" geral da organização são `interact`) tem `view`, como
 * qualquer outro visitante conectado fora da organização, por
 * link público ou convite por e-mail. Um membro que é Commenter tem
 * `view` em dados compartilhados e ainda grava sua própria subárvore `data/users/<id>/`;
 * nenhum outro titular de `view` grava em lugar algum. Um visitante sem login
 * não tem dados. Então, por padrão, somente `interact` e acima gravam
 * documentos compartilhados. Uma chamada abaixo
 * do mínimo falha da mesma forma que a subárvore `{self}` de um irmão: uma leitura
 * vê um documento inexistente e uma gravação rejeita `invalid_argument` —
 * então vise controles na frente com o que a capacidade `user` relata
 * (`can("data.write")` = pode gravar documentos compartilhados sob a regra raiz;
 * `canEdit()` = admin, para controles que uma regra reserva para admin;
 * `isOwner()` = dono) em vez de ramificar no código. Quando
 * `can("data.write")` resolve `null`, ou `claude.use("user")` também,
 * a plataforma não disse nada sobre o nível de gravação deste visualizador:
 * mantenha os campos de dados compartilhados, e se um `set()` bem formado então rejeitar
 * `invalid_argument`, renderize-os somente leitura para o restante da visita.
 * As regras entram em vigor para a versão ativa no próximo call após entrarem em vigor;
 * `{db: {}}` restaura os padrões.
 * DISPONIBILIDADE é um
 * fato por visualização: obtenha o namespace com `await claude.use("db")` —
 * ele resolve `null` quando esta visualização não pode executar db (não servido, não
 * concedido na inicialização, ou falhou ao carregar) — e trate os códigos de rejeição de ciclo de vida nas chamadas e no callback de erro `onSnapshot`.
 */

/** Forma de rejeição para todo método e para o callback de erro de `onSnapshot`.
 * `message` é legível para humanos, mas não localizado. */
type DbError = {
  code: DbErrorCode;
  message: string;
};

/**
 * Códigos de erro estáveis. Ramifique em `code`, nunca no texto da mensagem; trate
 * códigos desconhecidos como `"unavailable"`.
 *
 * Códigos de armazenamento — o conjunto completo para operações de armazenamento:
 * - `invalid_argument` — o caminho, corpo ou consulta quebra uma regra em
 *   a documentação abaixo (gramática de caminho ruim, corpo não-objeto, documento
 *   acima de 256 KiB ou 32 níveis de profundidade, muitos filtros, tamanho de página acima do limite, ...). Aparece no momento da chamada para verbos
 *   e no callback de erro no subscribe. Corrija a chamada;
 *   repetir não tem sucesso.
 * - `resource_exhausted` — um orçamento: a taxa de chamadas por visualizador, o
 *   limite de inscrições (64 por visualização), muitas gravações concorrentes ou
 *   leases ativos, ou uma query que escaneia muitos documentos. Reduza a velocidade,
 *   inscreva-se menos ou afine a query; apertar um loop
 *   nisso não pode ter sucesso.
 * - `quota_exceeded` — um limite de contagem está cheio: documentos na
 *   coleção, documentos no banco de dados deste artefato, ou nos
 *   bancos da organização (a mensagem nomeia qual e o limite
 *   quando conhecido). Não é transitório: criar documentos falha até que alguns
 *   sejam excluídos, enquanto gravações em documentos existentes continuam com sucesso.
 *   Exponha isso ao visualizador; repetir não tem sucesso.
 * - `unavailable` — uma condição transitória da plataforma. Verbos: tente
 *   uma vez após um pequeno atraso aleatório. Inscrições tratam isso
 *   INTERNAMENTE — a entrega cai para refresh periódico e
 *   se recupera sozinha; um callback de erro `onSnapshot` nunca
 *   o recebe, EXCETO quando a ponte da plataforma em si para
 *   de responder (uma inscrição que nunca chega ao store): esse
 *   listener é terminado com `unavailable` e um novo
 *   `onSnapshot` é a única recuperação.
 * - `revoked` — a concessão desta visualização foi retirada enquanto a página estava
 *   em execução (acesso, compartilhamento ou disponibilidade alterados). Terminal para
 *   a carga da página: no máximo uma entrega por listener; as chamadas rejeitam
 *   depois disso. Renderize a experiência degradada; não editorialize
 *   sobre o motivo — o app ao redor possui a mensagem de acesso.
 *
 * Há deliberadamente NENHUM código `permission-denied` e NENHUM not-found
 * em leituras: um documento que este visualizador não consegue ver se comporta exatamente como
 * um que não existe (`exists: false`, omitido de queries).
 *
 * Códigos de ciclo de vida (do próprio runtime, não do store):
 * - `not_granted` — esta visualização não concedeu db ao frame.
 * - `capability_disabled` — concedido, mas não utilizável nesta visualização
 *   (o runtime que serve é anterior ou seu módulo falhou ao carregar).
 * - `capability_removed` — o método chamado não faz parte do
 *   runtime que serve esta visualização; trate como `capability_disabled`.
 * - `transform_error` — os argumentos da chamada não puderam ser preparados;
 *   trate como `invalid_argument`.
 * (`queue_overflow`, de runtimes que enfileiram chamadas feitas antes de estarem prontas,
 * também pode chegar a um callback de erro; é terminal para esse listener e cai sob a regra de código desconhecido acima.)
 */
type DbErrorCode =
  | "invalid_argument"
  | "resource_exhausted"
  | "quota_exceeded"
  | "unavailable"
  | "revoked"
  | "not_granted"
  | "capability_disabled"
  | "capability_removed"
  | "transform_error";

/**
 * PATH GRAMMAR (shared by every ref). A document path has an EVEN
 * number of slash-separated segments — the last is the document id,
 * the joined rest is its collection (`tasks/t1`, or nested:
 * `boards/b1/columns/c2`). A collection path is the odd-length
 * prefix form (`tasks`, `boards/b1/columns`). Count segments before
 * choosing the builder. `data/users/<id>` (3) is a COLLECTION — the
 * viewer's own — so one document per viewer is
 * `db.doc("data/users/" + uid + "/profile")` (4), and one document per
 * deck is `db.collection("data/users/" + uid).doc(deckId)` (4).
 * `data/users/<id>/decks` (4) is therefore a DOCUMENT path, not a
 * collection: a named per-viewer list is a subcollection under a
 * per-viewer document,
 * `db.doc("data/users/" + uid + "/profile").collection("decks")` (5),
 * each deck `.doc(deckId)` below it (6) — building from a ref like
 * this keeps the parity right for you. Segments use letters, digits,
 * and `_ - . ~ : @ +` only (never `.` or `..` alone); at most
 * 200 bytes per segment, 1000 bytes and 16 segments per path.
 * `doc()`, `collection()` and the builders on refs THROW a
 * `TypeError` synchronously for a path that breaks
 * this grammar (its message names the broken rule; for parity, the
 * segment count) — a programming error to fix where the path is
 * written, not a store condition to handle; building a ref never
 * touches the network. Paths are data you choose — there is no need to
 * pre-create a collection, and deleting a document does NOT delete
 * documents nested under its path.
 *
 * The `data/users/` path prefix is special, platform-side: each
 * viewer's own subtree under it is private per viewer — including
 * from the artifact's owner (the default `data/users/{self}` rule;
 * a declared rule at the `data/users` prefix opens siblings' subtrees
 * nos seus níveis, veja REGRAS DE ACESSO acima). Enderece a subárvore do visualizador como
 * `data/users/<id>/...` usando o valor AWAITED de
 * {@link Claude.user.id} (declare `user` junto com `db` — sem
 * a declaração `id()` resolve `null`; é assíncrono, e uma
 * promise não aguardada não é um segmento de caminho válido, então o construtor
 * lança) — o
 * store reconhece exatamente esse id como este visualizador, nenhum outro valor
 * funciona. Um id nulo significa sem subárvore privada: desative o recurso por visualizador
 * para essa visita em vez de realocar seus dados para um
 * caminho compartilhado; um membro só de leitura tem um id, mas também não pode escrever ali,
 * então trate uma escrita rejeitada da mesma forma. Documentos de outro visualizador sob `data/users/`
 * leem como inexistentes (`exists: false`, omitidos de queries e
 * `onSnapshot`) — o padrão "compartilhado pelos seus visualizadores" NÃO
 * se aplica dentro deste prefixo — e uma escrita (`set`/`update`/`delete`)
 * em outra subárvore de visualizador rejeita `invalid_argument`.
 * Hidden-until-reveal (sealed votes, planning poker): each viewer
 * writes their pick under their own `data/users/<id>/` path, where by
 * default nobody else can read it, and copies it to a shared path when
 * THEY reveal — rules are fixed at publish, so nothing a page does at
 * run time opens another viewer's subtree.
 */

/** Snapshot provenance. `fromCache: true` marks a view that is not
 * yet (or not currently) server-definitive — the first pages of a
 * subscription, or delivery during a connectivity gap. A definitive
 * snapshot follows automatically; no action is needed.
 * `hasPendingWrites` is true while the view includes this page's own
 * unconfirmed write (latency compensation). */
type SnapshotMetadata = {
  fromCache: boolean;
  hasPendingWrites: boolean;
};

/** One document, as reads and snapshots deliver it. Delivered
 *  snapshots and their `data()` are frozen; a document that didn't
 *  change is the same object across deliveries — compare with
 *  `===`, don't mutate or accumulate them (clone a body before
 *  editing it for a write). */
type DocumentSnapshot = {
  /** The last segment of the document's path. */
  id: string;
  /** False covers both a missing document and one this viewer cannot
   * see — deliberately indistinguishable. */
  exists: boolean;
  /** The document body; `undefined` when `exists` is false. */
  data(): Record<string, unknown> | undefined;
  metadata: SnapshotMetadata;
};

/** One ordered-view transition inside a query snapshot. Indexes are
 * positions in the snapshot's `docs` order: `oldIndex` is -1 for
 * `added`, `newIndex` is -1 for `removed`. `removed` covers
 * deletion, leaving the query, and losing visibility, identically; its
 * `doc` is the last snapshot the listener saw (`exists: true`,
 * carrying the final body), so a removal handler still has the data. */
type DocumentChange = {
  type: "added" | "modified" | "removed";
  doc: DocumentSnapshot;
  oldIndex: number;
  newIndex: number;
};

/** A query's matched set, in query order. */
type QuerySnapshot = {
  docs: DocumentSnapshot[];
  size: number;
  empty: boolean;
  /** The changes since the previous snapshot of this listener (the
   * first snapshot is all-`added`). */
  docChanges(): DocumentChange[];
  metadata: SnapshotMetadata;
};

/** Stop receiving snapshots. Idempotent; after it returns, the
 * callbacks never fire again. */
type Unsubscribe = () => void;

type AcquireOptions = {
  /** Who holds the lease — any stable string (a viewer id, a tab
   * id). Renewal requires the same holder. */
  holder: string;
  /** Requested lease length in milliseconds. Absent/0 means 30000;
   * values are clamped to [1000, 600000], never rejected. */
  ttlMs?: number;
  /** Merged into the document body when the lease is granted. */
  data?: Record<string, unknown>;
};

type AcquireResult = {
  acquired: boolean;
  /** The document's version after a granted acquire. */
  version?: number;
  /** RFC 3339 expiry of the lease now in force (granted or not). */
  expiresAt?: string;
  /** Your own holder string, echoed on a granted acquire; absent when
   * busy — the platform reveals `expiresAt`, never who holds it. */
  holder?: string;
};

/**
 * A reference to one document. Pure and synchronous to create — a
 * malformed path throws here; nothing reaches the store until a
 * terminal call.
 */
type DocumentReference = {
  /** The last path segment. */
  id: string;
  path: string;

  /** Read once. Absence is NOT an error — branch on `exists`. */
  get(): Promise<DocumentSnapshot>;

  /** Write the WHOLE document, creating it (and the store) if
   * absent — a full replace, Firestore-style. Use `update` to merge
   * into existing fields. Writes are last-writer-wins; there are no
   * transactions.
   *
   * ONE WRITE AT A TIME per document, only when its data changed:
   * await each `set`/`update` before the next to the same document;
   * write on a user action or a real state change, never from render
   * code, a snapshot callback, or a timer that rewrites unchanged or
   * clock-derived values; coalesce a burst of input events into one
   * write per pause. The page open in other tabs or devices writes the
   * same documents; overlapping writes to one document make each write
   * slower. */
  set(data: Record<string, unknown>): Promise<void>;

  /** Merge-write that REQUIRES the document to exist — rejects
   * `invalid_argument` otherwise (creating-on-miss would be a bug
   * for its use cases). Nested objects merge recursively; anything
   * else (arrays included) replaces that field wholesale. Same
   * one-write-at-a-time rule as `set`. Do NOT build monotonic
   * counters from read-modify-update — writes are last-writer-wins
   * and a retried write can apply twice. */
  update(data: Record<string, unknown>): Promise<void>;

  /** Delete this document. Idempotent; nested documents survive. */
  delete(): Promise<void>;

  /**
   * Cooperative short lease on this document — set-if-not-busy, the
   * single-writer primitive (one editor at a time, a migration that
   * should run once, a turn lock). NOT a security boundary: other
   * viewers can still write directly; leases only coordinate
   * callers that all use `acquire`. Busy resolves
   * `{acquired: false}` — a normal outcome, never an error. Leases
   * expire on their own (no release verb): prefer short `ttlMs`
   * and renew while working. There is no create-if-absent write, so
   * "claim a slot" (a seat, a username, first-come ownership) is:
   * `acquire` the slot document (short `ttlMs`, no `data`), `get()`
   * it, and while you hold the lease `set` your claim only if it does
   * not exist yet or its body names no owner, then let the lease
   * lapse; `{acquired: false}` means someone else is mid-claim — treat
   * the slot as taken or re-read after `expiresAt`. Do not carry the
   * claim in `acquire`'s `data` (it merges on every later grant too).
   * A bare get-then-set races and both callers believe they won.
   */
  acquire(options: AcquireOptions): Promise<AcquireResult>;

  /**
   * Subscribe to this document. `next` fires with the current state
   * soon after registration, then on every change — including other
   * viewers' writes, live. Your own writes appear immediately
   * (`hasPendingWrites: true` until confirmed). Delivery rides a
   * realtime stream when available and falls back to periodic
   * refresh (about 30 s foreground) — same callbacks either way.
   * `error` receives at most one terminal {@link DbError}
   * (`invalid_argument`, `resource_exhausted`, `revoked`, or the
   * dead-bridge `unavailable` above), after which the subscription
   * is dead. Pass it: without one a terminal error is reported via
   * `reportError` (your `error` event and console see it) and the
   * listener still dies.
   *
   * SUBSCRIBE ONCE per document or query (when the view starts, or
   * when the path or filter really changes), keep the returned
   * `Unsubscribe`, and call it when done. Never subscribe from code
   * that runs on every render (a React component body, a `render()`
   * function, anything the snapshot callback triggers): each call
   * opens another subscription, each snapshot re-renders, and the
   * page loops. In React, subscribe in a `useEffect`, build the ref or
   * query inside it, depend only on stable primitives, and return the
   * unsubscribe. Don't omit the dependency list or put a query built
   * during render in it: either one re-subscribes on every render. To
   * sort or filter by fast-changing UI state, subscribe once to the
   * wider set and derive the view in render.
   */
  onSnapshot(
    next: (snap: DocumentSnapshot) => void,
    error?: (e: DbError) => void,
  ): Unsubscribe;

  /** A subcollection under this document. */
  collection(path: string): CollectionReference;
};

/**
 * A filtered, ordered, limited view of one collection. Builders are
 * pure — each returns a NEW query; terminal calls do the work.
 * Filters and `orderBy` evaluate against top-level fields without
 * indexes (the store scans the collection), so keep queried
 * collections modest — hundreds to low thousands of documents.
 */
type Query = {
  /** Add a filter (up to 10). Operators: `==`, `!=`, `<`, `<=`,
   * `>`, `>=`, `in`, `not-in` (value arrays of at most 30), and
   * `array-contains`. */
  where(field: string, op: string, value: unknown): Query;

  /** Order by one top-level field (at most one `orderBy`);
   * `dir` defaults to `"asc"`. Documents missing the field sort
   * last. Without `orderBy`, results are ordered by document id
   * (ascending) — the same on every delivery path. */
  orderBy(field: string, dir?: "asc" | "desc"): Query;

  /** At most `n` documents (1-1000). An ordered, limited query is a
   * window: documents beyond the window are not delivered until
   * they enter it. */
  limit(n: number): Query;

  /** Read the matched set once, in query order. */
  get(): Promise<QuerySnapshot>;

  /** Subscribe to the matched set — same delivery contract and same
   * subscribe-once rule as {@link DocumentReference.onSnapshot} (in
   * React, subscribe inside the effect, never during render, and don't
   * list a query built during render as a dependency), with
   * `docChanges()` describing each transition. At most 64 active
   * subscriptions per view (the 65th rejects `resource_exhausted` on
   * the error callback). */
  onSnapshot(
    next: (snap: QuerySnapshot) => void,
    error?: (e: DbError) => void,
  ): Unsubscribe;
};

/** A collection: a {@link Query} over everything in it, plus
 * document access and creation. */
type CollectionReference = Query & {
  path: string;

  /** A document in this collection. Omit `id` to mint a fresh
   * client-generated id — the retriable-create idiom (the store has
   * no idempotency key; a retried create with a fresh ref leaves at
   * most one document per id). */
  doc(id?: string): DocumentReference;

  /** Create a document under a client-generated id and resolve its
   * ref. Sugar for `.doc().set(data)`. */
  add(data: Record<string, unknown>): Promise<DocumentReference>;
};

/**
 * A superfície do store. Refs são apenas portadores de caminho — construí-los nunca
 * toca a rede; apenas as chamadas neles o fazem.
 *
 * CORPOS DE DOCUMENTO são objetos JSON simples (não arrays ou escalares no
 * nível superior): no máximo 256 KiB serializados e 32 níveis de profundidade.
 * CAPACIDADE: o banco de dados de um artefato contém no máximo 5.000 documentos no
 * total. Não mapeie um fluxo ilimitado e crescente (eventos, linhas de log,
 * mensagens) para um documento por item — agregue muitos itens em um único
 * documento ou remova os antigos — e quando uma criação rejeitar com
 * `quota_exceeded`, informe ao visualizador o que aconteceu e o que fazer.
 * Números são números JSON (dupla precisão). Gravações são
 * last-writer-wins — compare o ESTADO do documento para raciocinar sobre
 * concorrência, nunca contagens de linhas ou chamadas.
 */
type DB = {
  /** A document reference. The path must have an even number of
   * segments (`tasks/t1`); throws `TypeError` for a path that breaks
   * the grammar above. */
  doc(path: string): DocumentReference;

  /** A collection reference. The path must have an odd number of
   * segments (`tasks`, `boards/b1/columns`); throws `TypeError` for a
   * path that breaks the grammar above. */
  collection(path: string): CollectionReference;
};

interface ClaudeCapabilityMap {
  db: DB;
}
