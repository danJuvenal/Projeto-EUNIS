import { useGenres } from '../lib/catalog'
import { Icon } from './Icon'

export function GenrePicker({
  value,
  onChange,
  max = 8,
}: {
  value: string[]
  onChange: (v: string[]) => void
  max?: number
}) {
  const genres = useGenres()
  return (
    <div className="genre-picker" role="group" aria-label="Gêneros favoritos">
      {genres.map((g) => {
        const on = value.includes(g.slug)
        return (
          <button
            key={g.slug}
            type="button"
            className={`chip chip--lg ${on ? 'is-active' : ''}`}
            aria-pressed={on}
            disabled={!on && value.length >= max}
            onClick={() => onChange(on ? value.filter((s) => s !== g.slug) : [...value, g.slug])}
          >
            {on && <Icon name="check" size={14} />} {g.name}
          </button>
        )
      })}
    </div>
  )
}
