import { Link } from 'react-router'
import { useDocumentTitle } from '../lib/hooks'

type Page = { title: string; eyebrow: string; body: React.ReactNode }

const PAGES: Record<string, Page> = {
  sobre: {
    eyebrow: 'Sobre',
    title: 'O EUNIS',
    body: (
      <>
        <p>
          O EUNIS é uma plataforma para descobrir filmes e séries, registrar o que você assistiu, escrever críticas e encontrar pessoas com gosto
          parecido.
        </p>
        <p>
          Começou como um protótipo em um único arquivo HTML e está sendo reconstruído como aplicação web completa: React no frontend, FastAPI no
          backend e banco relacional.
        </p>
        <p>
          Recomendações e compatibilidade usam sinais reais — notas, gêneros favoritos e o que você salva. Quando não há dados suficientes, a
          interface diz isso em vez de inventar números.
        </p>
      </>
    ),
  },
  contato: {
    eyebrow: 'Contato',
    title: 'Fale com a gente',
    body: (
      <>
        <p>O EUNIS ainda não tem um canal de contato público definido.</p>
        <p className="dim">
          Pendência de lançamento: definir e-mail de suporte e publicar aqui (ver EUNIS_REDESIGN_PLAN.md e README).
        </p>
      </>
    ),
  },
  privacidade: {
    eyebrow: 'Privacidade',
    title: 'Seus dados no EUNIS',
    body: (
      <>
        <p>
          <strong>O que guardamos:</strong> nome, nome de usuário, e-mail, senha (somente em hash scrypt — nunca em texto), bio, gêneros
          favoritos, críticas, notas, curtidas, comentários, listas, quem você segue e o que marcou como assistido, quero ver ou favorito.
        </p>
        <p>
          <strong>O que é público:</strong> nome, @, bio, críticas, listas públicas, assistidos, quero ver, favoritos e seguidores. Listas
          privadas e e-mail nunca são mostrados a outras pessoas.
        </p>
        <p>
          <strong>Presença online:</strong> enquanto você usa o EUNIS, outras pessoas podem ver que você está online e o tipo de página aberta
          (por exemplo, “Vendo Duna”). Você pode ficar invisível em Configurações → Privacidade.
        </p>
        <p>
          <strong>Sessão:</strong> usamos um único cookie essencial (HttpOnly) para manter você conectado. Não usamos cookies de publicidade.
        </p>
        <p className="dim">Documento preliminar — revisar com assessoria jurídica antes do lançamento público (LGPD).</p>
      </>
    ),
  },
  termos: {
    eyebrow: 'Termos',
    title: 'Termos de uso',
    body: (
      <>
        <p>Ao usar o EUNIS você concorda em publicar apenas conteúdo seu, respeitar outras pessoas e marcar spoilers.</p>
        <p>Você pode editar ou excluir suas críticas, comentários e listas a qualquer momento. Ninguém além de você pode alterá-los.</p>
        <p>
          Dados de filmes e séries vêm do TMDb quando a integração está configurada. Este produto usa a API do TMDb, mas não é endossado ou
          certificado pelo TMDb.
        </p>
        <p className="dim">Documento preliminar — revisar antes do lançamento público.</p>
      </>
    ),
  },
}

export default function StaticPage({ slug }: { slug: keyof typeof PAGES }) {
  const p = PAGES[slug]
  useDocumentTitle(p.eyebrow)
  return (
    <div className="container page prose-page">
      <p className="eyebrow">{p.eyebrow}</p>
      <h1 className="page__title">{p.title}</h1>
      <div className="prose">{p.body}</div>
    </div>
  )
}

export function NotFound() {
  useDocumentTitle('Página não encontrada')
  return (
    <div className="container page not-found">
      <p className="eyebrow mono">404</p>
      <h1 className="page__title">
        Essa cena <span className="serif">foi cortada.</span>
      </h1>
      <p className="muted">A página que você procurou não existe ou mudou de lugar.</p>
      <div className="form__actions" style={{ justifyContent: 'flex-start' }}>
        <Link to="/" className="btn btn--primary">
          Voltar ao início
        </Link>
        <Link to="/explorar" className="btn btn--glass">
          Explorar
        </Link>
      </div>
    </div>
  )
}
