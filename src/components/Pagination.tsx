/** Previous / next buttons under a paged table. */
export function Pagination(props: { page: number; totalPages: number; totalItems: number; noun: string; onPage: (page: number) => void }) {
  const { page, totalPages, totalItems, noun, onPage } = props
  return (
    <div className="pagination">
      <span className="muted">
        {totalItems} {noun}
      </span>
      <button type="button" className="button button-small" disabled={page === 0} onClick={() => onPage(page - 1)}>
        Anterior
      </button>
      <span>
        Página {totalPages === 0 ? 0 : page + 1} de {totalPages}
      </span>
      <button type="button" className="button button-small" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)}>
        Próxima
      </button>
    </div>
  )
}
