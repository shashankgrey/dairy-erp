const { ZodError } = require('zod');

// Wraps a Zod schema as Express middleware. Validates the given part of
// the request (body/query/params), replaces it with the parsed
// (type-coerced, defaulted) result, and calls next(). On failure, hands
// a clean 400 error to the existing errorHandler instead of letting a
// ZodError's raw shape leak to the client.
//
// Usage:
//   router.post('/', validate(createCustomerSchema), controller.createCustomer);
//   router.get('/', validate(listCustomersQuerySchema, 'query'), controller.listCustomers);
function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const firstIssue = err.issues[0];
        const field = firstIssue.path.join('.') || source;
        const error = new Error(`${field}: ${firstIssue.message}`);
        error.status = 400;
        return next(error);
      }
      next(err);
    }
  };
}

module.exports = { validate };