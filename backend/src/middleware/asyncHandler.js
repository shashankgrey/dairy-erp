// Express 4 (unlike Express 5) does NOT automatically forward a
// rejected promise from an async route handler to the error-handling
// middleware. If a handler throws/rejects without this, Node treats it
// as an unhandled promise rejection -- which, in modern Node.js,
// terminates the entire process. That's what was crashing the whole
// backend on a single bad query.
//
// This wraps a handler so any rejection is caught and passed to
// next(err), routing it to errorHandler.js like every other error.
//
// Usage: router.get('/', asyncHandler(controller.listThings));
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;