/**
 * `claude.use(name)` — a única forma de acessar uma capacidade.
 *
 *   const db = await claude.use("db");
 *   if (!db) return renderWithoutDb(); // projete para ausência
 *   db.collection("tasks").onSnapshot(render);
 *
 * Resolve o namespace da capacidade assim que esta visualização pode executar o
 * código da capacidade, ou `null` quando não pode: a capacidade não
 * é servida nesta visualização, não foi concedida na inicialização, ou seu módulo
 * falhou ao carregar. Os casos nulos são indistinguíveis por design —
 * projete para ausência, exatamente como a documentação de `permissions.state()` diz. (Artefatos de chat
 * usam um `window.claude` diferente e plano; nem `use()` nem
 * esses namespaces existem aí.)
 *
 * Tempo. Dentro de um visualizador, a página é enquadrada e `window.claude` existe
 * antes de qualquer script executar. Servida no nível superior pela plataforma, como
 * sua própria página no host do artefato, ela tem o mesmo `window.claude` apenas de `use`
 * antes do seu script também, e cada `use()` resolve
 * `null` ali por enquanto; qualquer outra cópia da página no nível superior (um arquivo salvo,
 * outro host) não tem `window.claude` de forma alguma. Este contrato
 * não promete nada além de `use`: trate `window.claude.db`,
 * `window.claude.room` e qualquer outro membro de capacidade como `undefined`
 * em todos os momentos. O namespace chega depois, por meio da promessa, quando o
 * visualizador respondeu e o módulo carregou — nunca durante a primeira execução síncrona do
 * seu script, nem em ordem em relação a
 * `DOMContentLoaded`, então não assuma que o DOM está completo
 * quando ele resolve. Renderize a página sem ele e ative recursos leves
 * quando ele resolver. Em um host que nunca responde, ele resolve
 * `null` após 10 s.
 *
 * O namespace resolvido é de propriedade da plataforma e somente leitura: um objeto congelado
 * cujos membros são as funções da capacidade. Chame-os e mantenha a referência; atribuir a ele,
 * `Object.defineProperty` nele, ou substituir um membro lança erro (ou silenciosamente não faz nada).
 * Para suas próprias funções auxiliares, envolva-o em seu próprio objeto.
 *
 * `use()` responde a uma pergunta: esta visualização pode executar o código da capacidade?
 * A permissão fica nas próprias chamadas — uma confirmação de consentimento,
 * limite de taxa ou recusa de política chega na primeira chamada, nunca aqui.
 * Para uma capacidade que esta visualização serve, a promessa é memoizada — toda
 * `use("db")` retorna o mesmo objeto de promessa; um nome não servido
 * resolve `null` (sem identidade estável da promessa).
 */
interface ClaudeCapabilityMap {}

interface Claude {
  /**
   * Veja {@link ClaudeCapabilityMap} para os nomes que `use()` aceita nesta
   * versão do contrato; um nome desconhecido é um erro de compilação em autoria tipada
   * e resolve `null` em tempo de execução.
   */
  use<K extends keyof ClaudeCapabilityMap & string>(
    name: K,
  ): Promise<ClaudeCapabilityMap[K] | null>;
}

// Autores de capacidade: registrem o tipo do namespace em
// `interface ClaudeCapabilityMap` no seu contract.d.ts próprio — uma linha,
// mesmo padrão de junção de declarações que `interface Claude`.
interface Window {
  claude: Claude;
}
