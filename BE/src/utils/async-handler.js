export function asyncHandler(handler) {
  return function handled(request, response, next) {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

