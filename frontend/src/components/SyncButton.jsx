const SyncButton = ({ onSync, loading }) => {
  return (
    <button
      onClick={onSync}
      disabled={loading}
      className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white transition-all ${
        loading
          ? 'bg-purple-300 cursor-not-allowed'
          : 'bg-purple-600 hover:bg-purple-700'
      }`}
    >
      {loading ? (
        <>
          <span className="animate-spin">⟳</span>
          Sincronizando...
        </>
      ) : (
        <>
          🔄 Sincronizar productos
        </>
      )}
    </button>
  )
}

export default SyncButton