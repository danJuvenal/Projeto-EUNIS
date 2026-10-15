import { Link } from 'react-router'
import { useCatalogSource } from '../lib/catalog'
import { Logo } from './Logo'

export function Footer() {
  const source = useCatalogSource()
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Logo />
          <p className="muted">
            Descubra filmes e séries, registre o que assistiu e encontre gente com o mesmo gosto.
          </p>
        </div>
        <nav aria-label="Produto" className="footer__col">
          <h2 className="footer__h">Produto</h2>
          <Link to="/explorar?tipo=movie">Filmes</Link>
          <Link to="/explorar?tipo=tv">Séries</Link>
          <Link to="/match">Match</Link>
          <Link to="/comunidade">Comunidade</Link>
        </nav>
        <nav aria-label="EUNIS" className="footer__col">
          <h2 className="footer__h">EUNIS</h2>
          <Link to="/sobre">Sobre</Link>
          <Link to="/contato">Contato</Link>
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/termos">Termos</Link>
        </nav>
      </div>
      <div className="container footer__base">
        <span className="dim">© {new Date().getFullYear()} EUNIS</span>
        {source === 'tmdb' ? (
          <span className="dim">Este produto usa a API do TMDb, mas não é endossado ou certificado pelo TMDb.</span>
        ) : source === 'demo' ? (
          <span className="dim">Catálogo de demonstração: artes tipográficas no lugar dos pôsteres oficiais.</span>
        ) : null}
      </div>
    </footer>
  )
}
