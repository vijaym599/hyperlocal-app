export class RequestError extends Error {
  constructor(status, message) {
    super(message || 'Request failed.');
    this.name = 'RequestError';
    this.status = Number(status) || 0;
  }
}

export function requestError(response, message) {
  return new RequestError(response?.status, message);
}

export function errorPresentation(error, online = globalThis.navigator?.onLine !== false) {
  const status = Number(error?.status) || 0;

  if (!online || (error?.name === 'TypeError' && !status)) return {
    kind: 'offline', status: 0, title: 'You appear to be offline',
    description: 'Check your internet connection, then try again.'
  };
  if (status === 401) return {
    kind: 'unauthorized', status, title: 'Your session has expired',
    description: 'Sign in again to continue securely.'
  };
  if (status === 403) return {
    kind: 'forbidden', status, title: 'Access denied',
    description: 'Your account does not have permission to complete this action.'
  };
  if (status === 404) return {
    kind: 'not-found', status, title: 'This page could not be found',
    description: 'It may have been removed, renamed, or is no longer available.'
  };
  if (status === 429) return {
    kind: 'rate-limit', status, title: 'Too many requests',
    description: 'Please wait a moment before trying again.'
  };
  if ([500, 502, 503, 504].includes(status)) return {
    kind: 'server', status, title: status === 503 ? 'Service temporarily unavailable' : 'Server error',
    description: 'We could not complete this request right now. Please try again shortly.'
  };

  return {
    kind: 'error', status, title: 'Something went wrong',
    description: error?.message || 'Please try again.'
  };
}
