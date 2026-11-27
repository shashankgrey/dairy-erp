const { ZodError } = require('zod');

// Wraps a Zod schema as Express middleware. Validates the given part of
// the request (body/query/params) and merges the parsed (type-coerced,
// trimmed, defaulted) result back onto it, then calls next(). On
// failure, hands a clean 400 error to the existing errorHandler instead
// of letting a raw ZodError shape leak to the client.
//
// NOTE: this mutates req[source] in place with Object.assign rather
// than reassigning it (e.g. req.query = parsed). That's deliberate --
// on Express 5, req.query is a getter-only property, so a direct
// reassignment throws "Cannot set property query of #<IncomingMessage>
// which has only a getter". Mutating in place works on both Express 4
// and 5 and avoids that trap entirely.
//
// Usage:
//   router.post('/', validate(createCustomerSchema), controller.createCustomer);
//   router.get('/:id/bill', validate(billQuerySchema, 'query'), controller.getMonthlyBill);
function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      Object.assign(req[source], parsed);
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