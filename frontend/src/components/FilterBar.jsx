const FilterBar = ({ status, onStatusChange, search, onSearchChange }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      
      {/* Buscador */}
      <input
        type="text"
        placeholder="Buscar producto..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-4 py-2 w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-purple-400"
      />

      {/* Filtro por status */}
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
      >
        <option value="">Todos</option>
        <option value="active">Active</option>
        <option value="draft">Draft</option>
        <option value="archived">Archived</option>
      </select>

    </div>
  )
}

export default FilterBar