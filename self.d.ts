/**
 * `self` é o NOME ANTIGO da capacidade `artifact` — renomeada em
 * 0.2.0; esta entrada do roster permanece para que o nome publicado nas páginas e
 * nos clientes distribuídos continue resolvendo. Ambas as grafias resolvem
 * permanentemente: `claude.use("self")` e `claude.use("artifact")`
 * respondem à mesma capacidade em toda página que a serve (páginas mais antigas
 * também podem carregar um membro `window.claude.self`; este contrato não promete
 * nenhum). Novas páginas declaram `capabilities: {artifact: {}}` e chamam
 * `claude.use("artifact")`; veja as definições de tipos de artifact para a
 * superfície completa.
 */

interface ClaudeCapabilityMap {
  self: typeof Claude.artifact;
}
