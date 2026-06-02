function appError(status, code, message, details = null) {
  const err = new Error(message)
  err.status = status
  err.code = code
  err.details = details
  return err
}

// Traduce un error (AppError o inesperado) a la respuesta JSON consistente
function sendError(res, err) {
  if (err.status) {
    return res.status(err.status).json({
      success: false,
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {})
    })
  }
  // Error no controlado -> 500
  console.error(err)
  return res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'Error interno del servidor'
  })
}

module.exports = { appError, sendError }
