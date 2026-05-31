const ProductCard = ({ product }) => {
  return (
    <div className="bg-white rounded-xl shadow p-4 flex flex-col gap-3 border border-gray-100">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.title}
          className="w-full h-48 object-cover rounded-lg"
        />
      ) : (
        <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
          Sin imagen
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-gray-800">{product.title}</h2>
        <p className="text-gray-500 text-sm">{product.vendor}</p>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-xl font-bold text-gray-900">${product.price}</span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
          product.status === 'active'
            ? 'bg-green-100 text-green-700'
            : product.status === 'draft'
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {product.status}
        </span>
      </div>

      <p className="text-gray-500 text-sm">Stock: {product.inventory_quantity}</p>
    </div>
  )
}

export default ProductCard